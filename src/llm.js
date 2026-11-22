// Minimal OpenAI-compatible chat client. Works with OpenAI, OpenRouter, Groq, Ollama, LM Studio...
export function llmConfig() {
  const e = process.env;
  if (e.INSIGHT_API_KEY || e.INSIGHT_BASE_URL)
    return { base: e.INSIGHT_BASE_URL || "https://api.openai.com/v1", key: e.INSIGHT_API_KEY || "none", model: e.INSIGHT_MODEL || "gpt-4o-mini" };
  if (e.OPENROUTER_API_KEY) return { base: "https://openrouter.ai/api/v1", key: e.OPENROUTER_API_KEY, model: e.INSIGHT_MODEL || "google/gemini-2.5-flash" };
  if (e.GROQ_API_KEY) return { base: "https://api.groq.com/openai/v1", key: e.GROQ_API_KEY, model: e.INSIGHT_MODEL || "llama-3.3-70b-versatile" };
  if (e.OPENAI_API_KEY) return { base: "https://api.openai.com/v1", key: e.OPENAI_API_KEY, model: e.INSIGHT_MODEL || "gpt-4o-mini" };
  throw new Error("No model configured. Set OPENROUTER_API_KEY, GROQ_API_KEY or OPENAI_API_KEY (or INSIGHT_BASE_URL for a local model).");
}

export async function chatJSON(system, user) {
  const { base, key, model } = llmConfig();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`model call failed: ${res.status} ${await res.text()}`);
  const content = (await res.json()).choices[0].message.content;
  const m = content.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : content);
}
