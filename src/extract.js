import { chatJSON } from "./llm.js";
import { skills } from "./graph.js";

const SYSTEM = `You turn videos and articles into reusable know-how for AI agents.
Extract only concrete, actionable insights a practitioner could apply today: tactics, rules of thumb, tools with what they are for, numbers, step orders, mistakes to avoid.
Skip intros, self-promotion, "follow for more", calls to comment, and vague motivation.
Group insights into skills (a skill = a reusable capability, e.g. "Writing short-form video hooks", "Local SEO for small businesses", "Picking fonts for landing pages").
Merging matters more than naming: if an insight is about the same goal as one of the EXISTING SKILLS (even loosely, e.g. "design inspiration sources" vs "giving AI design taste"), you MUST reuse that exact existing skill name and domain so it improves that skill. Create a new skill only when no existing skill covers the goal. Keep skill names broad and reusable, not tied to one video.
Each insight: one sentence, imperative, specific. "how" = optional one-line detail or example. "quote" = optional short verbatim phrase from the source backing it.
Answer in the language of the source unless it is mixed; keep tool and product names exact.
Return JSON: {"summary": string, "skills": [{"domain": string, "skill": string, "description": string, "insights": [{"text": string, "how": string|null, "quote": string|null, "tags": string[]}]}]}`;

export async function extract(graph, source) {
  const existing = skills(graph).map((s) => `- ${s.name} (${s.domain}): ${s.description || ""}`).join("\n") || "(none yet)";
  const user = `EXISTING SKILLS:\n${existing}\n\nSOURCE: ${source.title}${source.author ? ` by ${source.author}` : ""}\nURL: ${source.url}\n\nCONTENT:\n${source.text.slice(0, 60000)}`;
  return chatJSON(SYSTEM, user);
}
