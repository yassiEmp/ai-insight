// The insight graph: plain files you can read, grep, diff and commit.
//   <home>/graph.json                 nodes (domain, skill, insight, source) + edges
//   <home>/skills/<skill>/SKILL.md    one Agent Skill per skill, regenerated on every change
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

export const HOME = process.env.INSIGHT_HOME || join(homedir(), ".ai-insight");
const GRAPH = join(HOME, "graph.json");

export const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const id = (...p) => createHash("sha1").update(p.join("|")).digest("hex").slice(0, 10);

export async function load() {
  if (!existsSync(GRAPH)) return { version: 1, nodes: {}, edges: [] };
  return JSON.parse(await readFile(GRAPH, "utf8"));
}

export async function save(g) {
  await mkdir(HOME, { recursive: true });
  await writeFile(GRAPH, JSON.stringify(g, null, 2));
}

function node(g, type, key, data) {
  const nid = `${type}:${key}`;
  g.nodes[nid] = { ...(g.nodes[nid] || {}), id: nid, type, ...data };
  return nid;
}
function edge(g, from, rel, to) {
  if (!g.edges.some((e) => e.from === from && e.rel === rel && e.to === to)) g.edges.push({ from, rel, to });
}

export const skills = (g) => Object.values(g.nodes).filter((n) => n.type === "skill");
export const insightsOf = (g, skillId) =>
  g.edges.filter((e) => e.rel === "part_of" && e.to === skillId).map((e) => g.nodes[e.from]).filter(Boolean);
export const sourceOf = (g, insightId) => {
  const e = g.edges.find((e) => e.from === insightId && e.rel === "from");
  return e ? g.nodes[e.to] : null;
};

/** Merge one extraction into the graph. Returns { added, skippedDuplicates, skills: [{id, isNew}] } */
export function merge(g, source, extraction) {
  const srcId = node(g, "source", id(source.url), { url: source.url, title: source.title, author: source.author, kind: source.kind, addedAt: new Date().toISOString() });
  const touched = new Map();
  let added = 0, dup = 0;
  for (const s of extraction.skills || []) {
    const domainId = node(g, "domain", slug(s.domain), { name: s.domain });
    const key = slug(s.skill);
    const isNew = !g.nodes[`skill:${key}`];
    const skillId = node(g, "skill", key, { name: s.skill, domain: s.domain, description: s.description || g.nodes[`skill:${key}`]?.description, updatedAt: new Date().toISOString() });
    edge(g, skillId, "in", domainId);
    if (!touched.has(skillId)) touched.set(skillId, { id: skillId, name: s.skill, isNew, added: 0 });
    for (const ins of s.insights || []) {
      const iid = `insight:${id(slug(ins.text))}`;
      if (g.nodes[iid]) { dup++; edge(g, iid, "from", srcId); continue; }
      node(g, "insight", iid.split(":")[1], { text: ins.text, how: ins.how || null, quote: ins.quote || null, at: ins.timestamp || null, tags: ins.tags || [] });
      edge(g, iid, "part_of", skillId);
      edge(g, iid, "from", srcId);
      touched.get(skillId).added++;
      added++;
    }
  }
  return { added, skippedDuplicates: dup, skills: [...touched.values()] };
}

export async function writeSkillFile(g, skillId) {
  const s = g.nodes[skillId];
  const items = insightsOf(g, skillId);
  const lines = items.map((i) => {
    const src = sourceOf(g, i.id);
    const ref = src ? ` ([${src.author || "source"}](${src.url}))` : "";
    return `- **${i.text}**${i.how ? ` ${i.how}` : ""}${ref}`;
  });
  const md = `---
name: ${slug(s.name)}
description: ${(s.description || `What works for ${s.name}`).replace(/\n/g, " ").replace(/\.+$/, "")}. Use when the task involves ${s.name.toLowerCase()} (${s.domain}).
---

# ${s.name}

Insights collected by [AI Insight](https://github.com/yassiEmp/ai-insight) from videos and pages, each with its source. Apply them; cite the source when it matters.

${lines.join("\n")}
`;
  const dir = join(HOME, "skills", slug(s.name));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "SKILL.md"), md);
  return join(dir, "SKILL.md");
}

// Fast local retrieval: no model call, works offline. Scores insights by term overlap with skill/domain boosts.
export function search(g, query, limit = 8) {
  const STOP = new Set(["the","and","for","how","what","with","make","my","your","less","more","look","get","can","does","should","want","need","use","into","from","that","this"]);
  const stem = (t) => t.replace(/(ing|ers|er|es|s)$/, "");
  const terms = slug(query).split("-").filter((t) => t.length > 2 && !STOP.has(t)).map(stem);
  if (!terms.length) return [];
  const results = [];
  for (const n of Object.values(g.nodes)) {
    if (n.type !== "insight") continue;
    const skillEdge = g.edges.find((e) => e.from === n.id && e.rel === "part_of");
    const sk = skillEdge ? g.nodes[skillEdge.to] : null;
    const hay = slug(`${n.text} ${n.how || ""} ${(n.tags || []).join(" ")}`);
    const ctx = slug(`${sk?.name || ""} ${sk?.domain || ""} ${sk?.description || ""}`);
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += 2;
      if (ctx.includes(t)) score += 3;
    }
    if (score) results.push({ score, insight: n, skill: sk, source: sourceOf(g, n.id) });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
