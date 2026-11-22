#!/usr/bin/env node
import { addSource } from "../src/add.js";
import { load, search, skills, insightsOf, sourceOf, HOME, slug } from "../src/graph.js";
import { serve } from "../src/mcp.js";

const argv = process.argv.slice(2);
const opts = {};
for (const f of ["text", "title", "author"]) {
  const i = argv.indexOf(`--${f}`);
  if (i > -1) { opts[f] = argv[i + 1]; argv.splice(i, 2); }
}
const [cmd, ...rest] = argv;
const arg = rest.join(" ");
const dim = (s) => (process.stdout.isTTY ? `\x1b[2m${s}\x1b[0m` : s);
const bold = (s) => (process.stdout.isTTY ? `\x1b[1m${s}\x1b[0m` : s);

const HELP = `ai-insight: share a video, it becomes a skill your agent can query.

  ai-insight add <url|file>   learn from a YouTube/Instagram/TikTok link or a text file
        [--text t.txt]        use your own transcript for that URL (--title, --author optional)
  ai-insight ask <question>   answer from the graph in milliseconds (no model call)
  ai-insight skills           list skills and insight counts
  ai-insight show <skill>     print one skill with sources
  ai-insight mcp              run as an MCP server (Claude Code, Cursor, Codex...)

Graph and SKILL.md files live in ${HOME} (set INSIGHT_HOME to change).
Model: OPENROUTER_API_KEY, GROQ_API_KEY or OPENAI_API_KEY (or INSIGHT_BASE_URL + INSIGHT_MODEL for a local model).`;

try {
  if (cmd === "add" && arg) {
    const t = Date.now();
    const r = await addSource(rest[0], opts);
    console.log(`${bold(r.source.title)} ${dim(`(${r.source.kind}${r.source.author ? `, ${r.source.author}` : ""})`)}`);
    if (r.summary) console.log(dim(r.summary));
    for (const s of r.skills) console.log(`  ${s.isNew ? "+ new skill " : "~ improved  "} ${bold(s.name)}  +${s.added} insights`);
    console.log(`${r.added} insights added${r.skippedDuplicates ? `, ${r.skippedDuplicates} already known` : ""} in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  } else if (cmd === "ask" && arg) {
    const t = performance.now();
    const g = await load();
    const r = search(g, arg);
    const ms = (performance.now() - t).toFixed(0);
    if (!r.length) console.log("Nothing yet. Feed it a video: ai-insight add <url>");
    for (const x of r) console.log(`${bold(`[${x.skill?.name}]`)} ${x.insight.text}${x.insight.how ? dim(` ${x.insight.how}`) : ""}\n   ${dim(`↳ ${x.source?.author || x.source?.title || ""} ${x.source?.url || ""}`)}`);
    console.log(dim(`${r.length} insights in ${ms}ms`));
  } else if (cmd === "skills") {
    const g = await load();
    for (const s of skills(g)) console.log(`${String(insightsOf(g, s.id).length).padStart(3)}  ${bold(s.name)} ${dim(s.domain)}`);
  } else if (cmd === "show" && arg) {
    const g = await load();
    const s = g.nodes[`skill:${slug(arg)}`] || skills(g).find((x) => slug(x.name).includes(slug(arg)));
    if (!s) throw new Error("skill not found");
    console.log(bold(s.name));
    for (const i of insightsOf(g, s.id)) console.log(`- ${i.text}  ${dim(sourceOf(g, i.id)?.url || "")}`);
  } else if (cmd === "mcp") {
    serve();
  } else {
    console.log(HELP);
  }
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
