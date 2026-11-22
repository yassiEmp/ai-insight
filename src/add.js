import { loadSource } from "./source.js";
import { extract } from "./extract.js";
import { load, save, merge, writeSkillFile } from "./graph.js";

export async function addSource(input, opts = {}) {
  const source = await loadSource(input, opts);
  const g = await load();
  const extraction = await extract(g, source);
  const result = merge(g, source, extraction);
  await save(g);
  const files = [];
  for (const s of result.skills) files.push(await writeSkillFile(g, s.id));
  return { ...result, source, summary: extraction.summary, files };
}
