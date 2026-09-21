# Patze

English | [中文](README.zh.md)

Patze is a local autonomous-agent engineering host. It runs [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) on [Cordis](https://github.com/cordiverse/cordis), loads [Patpat](https://github.com/goiltpatpat/patpat) skills from `.agents/skills`, and mounts a small System 1 layer (**Jev**) as a Cordis plugin.

The chat model (System 2) is whichever provider you configure. Jev does not replace it. Jev classifies intent, gates unsafe shell-like tool arguments, and scores proof text. Code owns the workflow.

Docs: this README is current. [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) can lag. Also [Patpat guide](plugins/patpat/docs/guide/README.md) · [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/)

## Layout

```text
Patze/
├── bin/patze.js              # launcher (submodules, .env, Cordis overlay)
├── config/cordis.yml         # inserts src/index.js into the engine
├── src/
│   ├── index.js              # Patze core: Jev + Imagine tools
│   ├── jev/                  # System 1: route, safety, proof
│   └── tools/xai-imagine.js  # grok-imagine-image-2.0 / grok-imagine-video-1.5
├── .agents/skills/           # 22 Patpat skills
├── plugins/patpat/           # upstream skill submodule
└── engine/deepseek-harness/  # engine submodule
```

Generated images and videos land in `artifacts/` (gitignored).

## Runtime

```text
Web UI :3080  or  headless CLI
        │
        ▼
Cordis  ←  config/cordis.yml  ←  patze-core (Jev + Imagine tools)
        │
        ├─ tools/pre-execute     Jev safety gate
        ├─ tools/post-execute    Jev proof watcher
        └─ agent/pre-step        Jev route once per turn (no media inject)
```

Jev is a background plugin, not a second chat agent. Media requests use the Imagine tools and the system prompt. Jev logs the route and does not re-inject mid-turn (that previously caused a second video job).

Optional: set `TYPESAFE_API_KEY` to call TypeSafe System One (`Choice` / `Score` / `Noul`). Without it, Jev uses local heuristics.

## Quickstart

Requires Node.js `^22.19 || >=24`, pnpm `>=11.7.0`, Git, and Python `>=3.11`.

```sh
git clone --recursive https://github.com/goiltpatpat/Patze.git
cd Patze
pnpm setup
cp .env.example .env
```

Fill `.env`. When that file exists, the launcher copies aliases (`GEMINI_API_KEY` ↔ `GOOGLE_API_KEY`, `KIMI_API_KEY` ↔ `MOONSHOT_API_KEY`, `TYPESAFE_API_KEY` ↔ `JEV_API_KEY`).

```dotenv
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
XAI_API_KEY=          # Imagine image/video
MOONSHOT_API_KEY=
TYPESAFE_API_KEY=     # optional System One
PORT=3080
HOST=127.0.0.1
```

Providers can also be set in the Web UI under **Settings > Providers**.

### Web UI

```sh
pnpm web
# or: ./bin/patze.js web --no-open
```

The process prints `dsh web: http://127.0.0.1:3080/?token=...`. Open that URL. A bare `http://127.0.0.1:3080` returns 401.

### Headless

```sh
pnpm headless -- "Audit workspace dependencies and report security findings"
./bin/patze.js --profile headless "Analyze repository architecture"
```

### CLI helpers

```sh
./bin/patze.js route "Fix memory leak in background worker queue"
./bin/patze.js guard "rm -rf /var/log/*"
./bin/patze.js evaluate "All 12 tests passed" "all unit tests pass"
./bin/patze.js imagine-video "A red balloon rising against a blue sky"
./bin/patze.js imagine-image "A collie sitting in a sunlit field"
```

`imagine-video` / `imagine-image` call xAI Imagine (`grok-imagine-video-1.5`, `grok-imagine-image-2.0`) and write under `artifacts/`. They need `XAI_API_KEY` and are billed by xAI.

## Patpat skills

Loaded by `@deepseek-ai/dsh-skill-filesystem` from `.agents/skills`: 22 Patpat skills, plus `typesafe-ai`.

| Area | Skills |
|---|---|
| Loop | `patpat`, `patpat-loop` |
| Design | `patpat-architect`, `patpat-plan`, `patpat-impact`, `patpat-inspect` |
| Change | `patpat-change`, `patpat-engineer`, `patpat-debug` |
| Proof | `patpat-verify`, `patpat-verifier`, `patpat-review`, `patpat-eval` |
| Ship | `patpat-ship`, `patpat-run`, `patpat-swarm`, `patpat-arena`, `patpat-perf` |
| Platform | `patpat-learn`, `patpat-skill`, `patpat-automation`, `patpat-setup` |

Loop: `FRAME -> INSPECT -> PROOF CONTRACT -> ACT -> VERIFY -> REVIEW -> REPORT`.

## Maintenance

```sh
pnpm update-skills   # plugins/patpat → .agents/skills
pnpm test            # engine suite
pnpm test:jev        # Jev steer policy
pnpm test:imagine    # Imagine client (mocked fetch)
pnpm build
```

Daily skill sync: [.github/workflows/sync-patpat.yml](.github/workflows/sync-patpat.yml).

## Links

- [Patze](https://github.com/goiltpatpat/Patze) · [Issues](https://github.com/goiltpatpat/Patze/issues)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [Patpat](https://github.com/goiltpatpat/patpat)

## License

[MIT](LICENSE)
