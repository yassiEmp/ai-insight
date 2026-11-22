# AI Insight

**Share a video. It becomes a skill your agent can query.**

You save 10 reels a day about marketing, design and AI. Your agent knows none of it.
AI Insight watches the video for you, pulls out the tactics that actually work, and files them into **skills** inside a small knowledge graph. Every insight keeps its source. Your agent (Claude Code, Cursor, Codex, anything that speaks MCP) can then ask the graph before it writes copy, designs a page or plans a launch.

```
$ ai-insight add https://www.instagram.com/reel/DfGhqQvpiIR/
  + new skill  Local SEO for small businesses  +12 insights

$ ai-insight add https://www.instagram.com/reel/Dfk9FlGP7DY/
  ~ improved   Local SEO for small businesses  +3 insights

$ ai-insight ask "local seo tools"
[Local SEO for small businesses] Analyze competitor Google Business Profiles with PlePer
   to see their primary/secondary categories, services and photo count.
   ↳ @camden.weup https://www.instagram.com/reel/DfGhqQvpiIR/
...
8 insights in 2ms
```

The second video didn't create a duplicate. It **improved the skill you already had**. That's the whole idea: your knowledge compounds instead of piling up in a "saved" tab.

## What you get

- **`add <url>`**: YouTube, Instagram, TikTok and anything [yt-dlp](https://github.com/yt-dlp/yt-dlp) can open. Captions first, Whisper transcription when there are none, the post caption as a last resort.
- **Skills that merge**: new insights land in the closest existing skill, duplicates are skipped.
- **Real files, not a black box**: `~/.ai-insight/skills/<skill>/SKILL.md` in the [Agent Skills](https://docs.claude.com/en/docs/agents-and-tools/agent-skills/overview) format, plus `graph.json` (domains → skills → insights → sources). Grep it, diff it, commit it, share it.
- **Instant answers**: `ask` reads the local graph. No model call, works offline, milliseconds.
- **MCP server**: `ai-insight mcp` exposes `insight_search`, `insight_skill`, `insight_list_skills`, `insight_add` to any agent.
- **Zero dependencies**: plain Node 18+. Bring any OpenAI-compatible model (OpenRouter, Groq, OpenAI, Ollama, LM Studio).

## Quick start

```bash
git clone https://github.com/yassiEmp/ai-insight && cd ai-insight
npm link                      # gives you the ai-insight command
pipx install yt-dlp           # or: brew install yt-dlp

export OPENROUTER_API_KEY=... # or GROQ_API_KEY (free tier, also used for Whisper) or OPENAI_API_KEY
ai-insight add "https://www.youtube.com/watch?v=..."
ai-insight skills
ai-insight ask "how do I write a hook"
```

Already have a transcript? `ai-insight add <url> --text transcript.txt --author @someone`

Instagram or YouTube blocking you? Pass cookies to yt-dlp: `export INSIGHT_YTDLP_ARGS="--cookies-from-browser chrome"`

### Plug it into your agent

Claude Code:

```bash
claude mcp add ai-insight -- ai-insight mcp
```

Cursor / any MCP client (`mcp.json`):

```json
{ "mcpServers": { "ai-insight": { "command": "ai-insight", "args": ["mcp"] } } }
```

Or skip MCP and copy the generated skills: `cp -r ~/.ai-insight/skills/* ~/.claude/skills/`

## Configuration

| Variable | What it does |
| --- | --- |
| `OPENROUTER_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY` | Model used to extract insights (first one found wins) |
| `INSIGHT_BASE_URL`, `INSIGHT_API_KEY`, `INSIGHT_MODEL` | Any OpenAI-compatible endpoint, e.g. Ollama at `http://localhost:11434/v1` |
| `INSIGHT_WHISPER_KEY`, `INSIGHT_WHISPER_URL` | Transcription for videos with no captions (defaults to Groq or OpenAI) |
| `INSIGHT_HOME` | Where the graph lives (default `~/.ai-insight`) |
| `INSIGHT_YTDLP_ARGS` | Extra yt-dlp flags (cookies, proxy) |

## Example graph

[`examples/`](examples) holds a real graph built from 4 Instagram reels on local SEO and AI design: 4 videos, 2 skills, 29 insights, each linked to its source.

## Roadmap

Built in public, one feature per post. Follow [@yassi_yari](https://x.com/yassi_yari).

- [x] v0.1: share a link → insights → skills that merge → agent query (CLI + MCP)
- [ ] Semantic search (embeddings) next to the keyword index
- [ ] Domain detection: read what your agent is working on, name the domains, and research YouTube, the web and GitHub to fill the gaps on its own
- [ ] Share from your phone (share sheet / Telegram bot → your graph)
- [ ] Public graphs: publish a skill pack, fork someone else's

## Standing on

[mem0](https://github.com/mem0ai/mem0), [Graphiti](https://github.com/getzep/graphiti), [Cognee](https://github.com/topoteretes/cognee), [LightRAG](https://github.com/HKUDS/LightRAG), [GraphRAG](https://github.com/microsoft/graphrag), [GPT Researcher](https://github.com/assafelovic/gpt-researcher), [STORM](https://github.com/stanford-oval/storm), [fabric](https://github.com/danielmiessler/fabric) (its `extract_wisdom` pattern), [yt-dlp](https://github.com/yt-dlp/yt-dlp) and Anthropic's Agent Skills format. AI Insight is the small, opinionated version: videos in, skills out, files you own.

## License

MIT
