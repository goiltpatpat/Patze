# Patze

English | [中文](README.zh.md)

**Patze** is an evidence-driven autonomous agent engineering platform. It combines the modular plugin architecture of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (powered by [Cordis](https://github.com/cordiverse/cordis)) with the rigorous verification protocols and 22 engineering skills of [Patpat](https://github.com/goiltpatpat/patpat).

Documentation: [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) · [Patpat Guide](plugins/patpat/docs/guide/README.md) · [DeepSeek Harness Docs](https://deepseek-harness.github.io/deepseek-harness/)

---

## Overview

Patze bridges advanced agent orchestration with production-grade software engineering discipline:

- **Everything-is-a-Plugin**: Dynamic spatiotemporal composability via Cordis. Every tool, model provider, and workflow is a modular, hot-reloadable plugin.
- **Proof over Proxy**: Built-in adherence to Patpat engineering principles. Agents observe the authoritative surface rather than relying on plausible guesses or mock proxies.
- **22 Evidence-Driven Skills**: Native discovery of specialized engineering skills (`patpat-loop`, `patpat-architect`, `patpat-debug`, `patpat-verify`, `patpat-review`, `patpat-ship`, and more).
- **Dual Runtime Interface**: Full-featured Web UI console for human-in-the-loop workflows and headless CLI execution for automation.

---

## Architecture

```text
+-------------------------------------------------------------------------+
|                              Patze Platform                             |
+-------------------------------------------------------------------------+
       |                                                 |
       v                                                 v
[ Web UI Console :3080 ]                      [ Headless CLI : dsh ]
       |                                                 |
       +-----------------------+-------------------------+
                               |
                               v
               +-------------------------------+
               |     Cordis Plugin Kernel      |
               +-------------------------------+
                               |
            +------------------+------------------+
            |                  |                  |
            v                  v                  v
     [ Agent Loop ]     [ LLM Providers ]  [ Sandboxed FS/Shell ]
            |           (DeepSeek / Pi)
            v
     [ Skill Registry & Filesystem Discovery ]
            |
            +--> .agents/skills/ (22 Patpat Skills + Native DSH Skills)
            |
            +--> plugins/patpat/ (Extensible Skill Source Repository)
```

---

## Patpat Engineering Skills

Patze loads 22 evidence-driven engineering skills directly into agent sessions from `.agents/skills`:

| Skill Category | Primary Skills | Description |
|---|---|---|
| **Core Loop** | `patpat`, `patpat-loop` | Standard engineering cycle: `FRAME -> INSPECT -> PROOF CONTRACT -> ACT -> VERIFY -> REVIEW -> REPORT` |
| **Architecture & Planning** | `patpat-architect`, `patpat-plan` | Pre-implementation contract design, state-machine planning, and blast-radius tracing |
| **Implementation** | `patpat-change`, `patpat-engineer` | Bounded modifications with minimal diffs and declared proof contracts |
| **Diagnostics & Fixes** | `patpat-debug`, `patpat-inspect` | Root-cause isolation, defect reproduction, and non-destructive inspection |
| **Verification & Quality** | `patpat-verify`, `patpat-verifier` | Authoritative surface observation and project verifier generation |
| **Review & Delivery** | `patpat-review`, `patpat-ship` | Skeptical independent code review and authorized PR creation / landing |
| **Execution Scaling** | `patpat-run`, `patpat-swarm`, `patpat-arena` | Resumable multi-phase workflows and isolated parallel workers |

---

## Quickstart

### Prerequisites

- **Node.js**: `^22.19 || >=24`
- **pnpm**: `>=11.7.0`
- **Python**: `>=3.11` (for optional Python SDK and runtime scripts)

### Installation

Patze includes DeepSeek Harness and Patpat skills as decoupled submodules. You can install via either method:

**Method 1: Recursive Clone (Fastest)**
```sh
git clone --recursive https://github.com/goiltpatpat/Patze.git
cd Patze
pnpm setup
```

**Method 2: Standard Clone (Auto-Bootstrapped)**
```sh
git clone https://github.com/goiltpatpat/Patze.git
cd Patze
# pnpm setup automatically initializes submodules, installs dependencies, and builds
pnpm setup
```

> **Smart Launcher:** The CLI binary `./bin/patze.js` automatically self-heals uninitialized submodules and missing dependencies when executed!

### Configure Environment

```sh
cp .env.example .env
```

### Launch Web Console

```sh
pnpm web
# Or run with the standalone binary:
./bin/patze.js web
```

The Web UI launches at `http://127.0.0.1:3080`. Pass `--no-open` for remote or headless environments.

### Headless CLI Execution

```sh
pnpm headless -- "Analyze repository architecture and report findings"
# Or:
./bin/patze.js --profile headless "Analyze repository architecture and report findings"
```

---

## Development & Verification

### Running Quality Gates

```sh
pnpm run test
pnpm run lint
pnpm run typecheck
pnpm run verify-translation-pairing
```

### Updating Patpat Skills

To update or synchronize skills from `plugins/patpat`:

```sh
python3 plugins/patpat/scripts/install_skills.py --target .agents/skills --mode copy
```

---

## Community & Support

- Repository: [https://github.com/goiltpatpat/Patze](https://github.com/goiltpatpat/Patze)
- Issues & Discussions: [https://github.com/goiltpatpat/Patze/issues](https://github.com/goiltpatpat/Patze/issues)
- Upstream DeepSeek Harness: [https://github.com/deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- Patpat Skills Repository: [https://github.com/goiltpatpat/patpat](https://github.com/goiltpatpat/patpat)

---

## License

[MIT](LICENSE)
