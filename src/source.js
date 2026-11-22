// Turn a URL (YouTube, Instagram, TikTok, any page yt-dlp knows) or a text file into plain text.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = promisify(execFile);

async function ytdlp(args) {
  const bins = [["yt-dlp", []], ["python3", ["-m", "yt_dlp"]], ["python", ["-m", "yt_dlp"]]];
  let lastErr;
  for (const [bin, pre] of bins) {
    try {
      const extra = (process.env.INSIGHT_YTDLP_ARGS || "").split(" ").filter(Boolean);
      return await run(bin, [...pre, ...extra, ...args], { maxBuffer: 64 * 1024 * 1024 });
    } catch (e) {
      lastErr = e;
      if (e.code !== "ENOENT" && !/No module named/.test(String(e.stderr))) throw e;
    }
  }
  throw new Error("yt-dlp not found. Install it: pipx install yt-dlp (or brew install yt-dlp)." + (lastErr ? "" : ""));
}

// Strip VTT timing/markup and collapse the rolling duplicate lines YouTube auto-captions produce.
export function vttToText(vtt) {
  const out = [];
  for (const raw of vtt.split(/\r?\n/)) {
    const line = raw.replace(/<[^>]+>/g, "").trim();
    if (!line || line === "WEBVTT" || /-->/.test(line) || /^(Kind|Language|NOTE)\b/.test(line) || /^\d+$/.test(line)) continue;
    if (out[out.length - 1] === line) continue;
    out.push(line);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

async function transcribe(audioPath) {
  // Any OpenAI-compatible Whisper endpoint (OpenAI, Groq free tier...).
  const key = process.env.INSIGHT_WHISPER_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) return null;
  const base = process.env.INSIGHT_WHISPER_URL ||
    (process.env.GROQ_API_KEY && !process.env.INSIGHT_WHISPER_KEY ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1");
  const model = process.env.INSIGHT_WHISPER_MODEL || (base.includes("groq") ? "whisper-large-v3-turbo" : "whisper-1");
  const form = new FormData();
  form.append("file", new Blob([await readFile(audioPath)]), "audio.m4a");
  form.append("model", model);
  const res = await fetch(`${base}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!res.ok) throw new Error(`transcription failed: ${res.status} ${await res.text()}`);
  return (await res.json()).text;
}

export async function loadSource(input, opts = {}) {
  if (opts.text) {
    // Bring your own transcript: keeps the URL as the source.
    const text = await readFile(opts.text, "utf8");
    return { url: input, title: opts.title || input, author: opts.author || null, text, kind: "transcript" };
  }
  if (!/^https?:\/\//.test(input)) {
    const text = await readFile(input, "utf8");
    return { url: `file:${input}`, title: input, author: null, text, kind: "text" };
  }
  const dir = await mkdtemp(join(tmpdir(), "ai-insight-"));
  try {
    const { stdout } = await ytdlp(["-J", "--no-warnings", "--skip-download", input]);
    const meta = JSON.parse(stdout);
    const base = { url: input, title: meta.title || meta.fulltitle || input, author: meta.uploader || meta.channel || null };
    const caption = [meta.description].filter(Boolean).join("\n");

    // 1) subtitles (YouTube manual or auto captions)
    try {
      await ytdlp(["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", "en.*,fr.*,en,fr", "--sub-format", "vtt", "-o", join(dir, "s.%(ext)s"), "--no-warnings", input]);
      const vtt = (await readdir(dir)).find((f) => f.endsWith(".vtt"));
      if (vtt) {
        const text = vttToText(await readFile(join(dir, vtt), "utf8"));
        if (text.length > 80) return { ...base, text: caption ? `${text}\n\n[caption] ${caption}` : text, kind: "subtitles" };
      }
    } catch {}

    // 2) audio → Whisper (Instagram/TikTok reels rarely have captions)
    try {
      await ytdlp(["-f", "bestaudio/best", "-x", "--audio-format", "m4a", "-o", join(dir, "a.%(ext)s"), "--no-warnings", input]);
      const audio = (await readdir(dir)).find((f) => f.startsWith("a."));
      if (audio) {
        const text = await transcribe(join(dir, audio));
        if (text) return { ...base, text: caption ? `${text}\n\n[caption] ${caption}` : text, kind: "transcript" };
      }
    } catch (e) {
      if (process.env.DEBUG) console.error(e);
    }

    // 3) caption only
    if (caption.length > 40) return { ...base, text: caption, kind: "caption" };
    throw new Error("No transcript found. Set GROQ_API_KEY (free) or OPENAI_API_KEY for audio transcription, or pass a text file.");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
