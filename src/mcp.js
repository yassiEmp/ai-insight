// Tiny MCP server over stdio (JSON-RPC 2.0, newline-delimited). No SDK needed.
import { createInterface } from "node:readline";
import { load, search, skills, insightsOf, sourceOf, slug } from "./graph.js";
import { addSource } from "./add.js";

const TOOLS = [
  {
    name: "insight_search",
    description: "Search the user's insight graph for know-how relevant to the current task. Call it before writing copy, designing, planning a launch, or any task where learned tactics help. Returns insights with their sources.",
    inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] },
  },
  {
    name: "insight_skill",
    description: "Get every insight in one skill, by name (see insight_list_skills).",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
  },
  { name: "insight_list_skills", description: "List the skills in the insight graph with how many insights each holds.", inputSchema: { type: "object", properties: {} } },
  {
    name: "insight_add",
    description: "Learn from a video or page URL (YouTube, Instagram, TikTok...): extract insights and merge them into skills.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
];

const fmt = (g, i) => {
  const s = sourceOf(g, i.id);
  return `- ${i.text}${i.how ? ` (${i.how})` : ""}${s ? ` [source: ${s.author || s.title} ${s.url}]` : ""}`;
};

async function call(name, args) {
  const g = await load();
  if (name === "insight_search") {
    const r = search(g, args.query, args.limit || 8);
    return r.length ? r.map((x) => `[${x.skill?.name}] ${fmt(g, x.insight).slice(2)}`).join("\n") : "No matching insights yet.";
  }
  if (name === "insight_list_skills") return skills(g).map((s) => `- ${s.name} (${s.domain}): ${insightsOf(g, s.id).length} insights`).join("\n") || "Empty graph.";
  if (name === "insight_skill") {
    const s = g.nodes[`skill:${slug(args.name)}`] || skills(g).find((x) => slug(x.name).includes(slug(args.name)));
    return s ? `# ${s.name}\n${insightsOf(g, s.id).map((i) => fmt(g, i)).join("\n")}` : "Skill not found.";
  }
  if (name === "insight_add") {
    const r = await addSource(args.url);
    return `Added ${r.added} insights from "${r.source.title}" into: ${r.skills.map((s) => `${s.name}${s.isNew ? " (new)" : ""}`).join(", ")}`;
  }
  throw new Error(`unknown tool ${name}`);
}

export function serve() {
  const send = (m) => process.stdout.write(JSON.stringify(m) + "\n");
  createInterface({ input: process.stdin }).on("line", async (line) => {
    if (!line.trim()) return;
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    const { id, method, params } = msg;
    if (id === undefined) return; // notification
    try {
      if (method === "initialize")
        return send({ jsonrpc: "2.0", id, result: { protocolVersion: params?.protocolVersion || "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "ai-insight", version: "0.1.0" } } });
      if (method === "tools/list") return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
      if (method === "tools/call") {
        const text = await call(params.name, params.arguments || {});
        return send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } });
      }
      if (method === "ping") return send({ jsonrpc: "2.0", id, result: {} });
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
    } catch (e) {
      send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true } });
    }
  });
}
