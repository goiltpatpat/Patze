# Patze: Evidence-Driven Autonomous Agent Engineering Platform

English | [中文](README.zh.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22%20%7C%2024-green.svg)](https://nodejs.org/)
[![Architecture](https://img.shields.io/badge/Architecture-Cordis%20Microkernel-blue.svg)](https://cordis.moe/)
[![Engine](https://img.shields.io/badge/Engine-DeepSeek%20Harness-purple.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Skills](https://img.shields.io/badge/Skills-22%20Patpat%20Workflows-orange.svg)](https://github.com/goiltpatpat/patpat)

**Patze** is an evidence-driven autonomous agent engineering platform designed for professional software developers and engineering organizations. It unifies the extensible microkernel architecture of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) on [Cordis](https://github.com/cordiverse/cordis) with 22 disciplined [Patpat](https://github.com/goiltpatpat/patpat) engineering workflows, sub-2ms **TypeSafe Jev System 1** decision gates, and native multimodal generative media execution.

The platform separates fast deterministic routing and safety from heavy reasoning models, maximizing GPU KV cache hits and enforcing strict proof contracts before committing any code changes.

---

## Core Engineering Pillars

| Pillar | How Patze Implements It | Benefit for Teams |
| :--- | :--- | :--- |
| **Token Economy & Zero Bloat** | • Frozen System Prompt Prefix (90%+ KV Cache hit rate)<br>• `@deepseek-ai/dsh-spill` spills tool outputs >50KB to disk<br>• Jev System 1 routes intents in <2ms with **0 LLM tokens** | Reduces API expenditure by up to 90%; eliminates context-window runaway on large repositories. |
| **Disciplined Evidence Loop** | • 22 specialized Patpat workflows (`architect`, `debug`, `verify`, `ship`)<br>• Formal 5-field proof contracts (`Claim`, `Surface`, `Action`, `Expect`, `Cleanup`) | Prevents hallucinations and unverified claims; every diff must be proven on real runtime surfaces. |
| **Dual-Engine Architecture** | • **System 1 (Jev Engine)**: Active `tools/pre-execute` AgentShield and `tools/post-execute` proof watcher<br>• **System 2 (Foundation LLM)**: DeepSeek V3/R1, Grok 4.6, Claude, Gemini, or Kimi | Fast, non-blocking guardrails run locally before expensive model calls are dispatched. |
| **Autonomous Generative Media** | • Native `xai_imagine_image` (Grok Imagine Image 2.0)<br>• Asynchronous polling `xai_imagine_video` (Grok Imagine Video 1.5)<br>• Artifact persistence under `artifacts/` | Teams can generate production diagrams, visual designs, and UI motion clips directly from chat. |

---

## Architecture

```text
                      ┌─────────────────────────────────┐
                      │    Operator / Developer Team    │
                      └────────────────┬────────────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  ▼                                         ▼
       ┌──────────────────────┐                  ┌──────────────────────┐
       │   Web UI (:3080)     │                  │  Headless / CI CLI   │
       └──────────┬───────────┘                  └──────────┬───────────┘
                  │                                         │
                  └────────────────────┬────────────────────┘
                                       ▼
    ══════════════════════════════════════════════════════════════════════════
                     Cordis Microkernel & Patze Core
    ══════════════════════════════════════════════════════════════════════════
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
  [Jev System 1]               [Agent Loop]                  [DeepSeek Engine]
  • tools/pre-execute          • Prompt Assembly             • Disk Spill (>50KB)
    (AgentShield Gate)         • Scope Parent Chain          • History Compaction
  • tools/post-execute         • Event-Sourced Log           • Preset Mounts
    (Diagnostic Watcher)         (SQLite / In-Memory)        • Plugin Manager
  • agent/pre-step             
    (0-Token Intent Steer)     
        │                              │                              │
        └──────────────────────────────┼──────────────────────────────┘
                                       ▼
    ══════════════════════════════════════════════════════════════════════════
                              Execution Layer
    ══════════════════════════════════════════════════════════════════════════
        │                              │                              │
        ▼                              ▼                              ▼
  [Foundation Models]          [22 Patpat Skills]            [Generative Tools]
  • DeepSeek V3 / R1           • .agents/skills/             • grok-imagine-image-2.0
  • xAI Grok 4.6               • Architect, Plan, Impact     • grok-imagine-video-1.5
  • Anthropic Claude           • Debug, Change, Verify       • Artifacts saved to
  • Google Gemini / Kimi       • Ship, Run, Swarm, Arena       artifacts/images & videos
```

---

## Repository Layout

```text
Patze/
├── bin/patze.js              # Platform CLI launcher (submodule bootstrap, .env, Cordis patch)
├── config/cordis.yml         # Cordis configuration patch (injects patze-core and skill path)
├── src/
│   ├── index.js              # Core platform entry: mounts Jev, AgentShield, and Imagine tools
│   ├── index.ts              # TypeScript declaration and module exports
│   ├── jev/                  # System 1 Decision Layer
│   │   ├── engine.js         # Intent classifier (<2ms), AgentShield, and proof evaluator
│   │   ├── plugin.js         # Cordis active hooks (pre-execute, post-execute, pre-step)
│   │   ├── steer.js          # Turn-boundary steering policy
│   │   └── types.ts          # Structured decision contracts
│   └── tools/
│       ├── xai-imagine.js    # xAI Imagine Suite (Image 2.0 & asynchronous Video 1.5)
│       └── xai-imagine.test.js # Unit test suite (11/11 passing tests)
├── .agents/skills/           # 22 active Patpat engineering workflows + typesafe-ai
├── plugins/patpat/           # Upstream Patpat submodule
├── engine/deepseek-harness/  # DeepSeek Harness submodule (v0.1.6-alpha.2)
└── artifacts/                # Local generated media outputs (images/videos, gitignored)
```

---

## Quickstart

### Prerequisites
- **Node.js**: `^22.19.0 || >=24.0.0`
- **Package Manager**: `pnpm >=11.7.0`
- **Environment**: Linux, macOS, or Windows WSL2
- **Python**: `>=3.11` (for test runners and skill tooling)
- **Git**: `>=2.30`

### 1. Clone & Bootstrap

```sh
git clone --recursive https://github.com/goiltpatpat/Patze.git
cd Patze
pnpm setup
cp .env.example .env
```

### 2. Configure Credentials

Edit `.env` with your API keys. Patze normalizes provider aliases automatically (e.g. `GEMINI_API_KEY` ↔ `GOOGLE_API_KEY`, `KIMI_API_KEY` ↔ `MOONSHOT_API_KEY`, `TYPESAFE_API_KEY` ↔ `JEV_API_KEY`):

```dotenv
# Primary LLM Providers
DEEPSEEK_API_KEY=
XAI_API_KEY=              # For Grok 4.6, Imagine Image 2.0 & Imagine Video 1.5
GEMINI_API_KEY=           # Or GOOGLE_API_KEY
MOONSHOT_API_KEY=         # Or KIMI_API_KEY
ANTHROPIC_API_KEY=        # For Claude models
OPENAI_API_KEY=           # For GPT models

# System 1 Optimization (Optional)
TYPESAFE_API_KEY=         # For TypeSafe System One (Choice / Score / Noul)

# Network & Server
PORT=3080
HOST=127.0.0.1
```

*(Credentials can also be modified live inside the Web UI under **Settings > Providers**).*

---

## Execution Modes

### Mode A: Interactive Web UI

```sh
pnpm web
# or: ./bin/patze.js web --no-open
```

At startup, Patze outputs an authenticated loopback address:
```text
dsh web: http://127.0.0.1:3080/?token=Mx3lLUFF0ty3zw9d4mIBnhBIBL_vZCKoyinpRuCFG5g
```
Open this URL in your browser. Raw unauthenticated requests to `http://127.0.0.1:3080` are rejected with HTTP 401 for security.

### Mode B: Headless & CI/CD Pipeline

Run autonomous tasks directly from terminal or CI workflows:

```sh
pnpm headless -- "Audit workspace dependencies and report security findings"
./bin/patze.js --profile headless "Analyze repository architecture"
```

### Mode C: High-Speed CLI Utilities

Patze exposes deterministic CLI subcommands for rapid System 1 verification and media generation:

```sh
# System 1 Intent Routing (0 LLM tokens, < 2ms)
./bin/patze.js route "Fix memory leak in background worker queue"

# AgentShield Safety Gate Inspection
./bin/patze.js guard "rm -rf /var/log/*"

# Proof Contract Evaluation
./bin/patze.js evaluate "All 12 tests passed" "all unit tests pass"

# Autonomous Video Generation via Grok Imagine Video 1.5 (polls cluster and writes .mp4)
./bin/patze.js imagine-video "A robotic arm assembling high precision circuits in a clean room"

# Autonomous Image Generation via Grok Imagine Image 2.0 (writes .png)
./bin/patze.js imagine-image "Isometric architectural diagram of a distributed microkernel"
```

Generated media files are saved locally to `artifacts/videos/` and `artifacts/images/`.

---

## The Patpat Engineering Skill Matrix

Patze bundles 22 authoritative engineering workflows loaded from `.agents/skills`:

| Domain | Skills | Primary Focus |
| :--- | :--- | :--- |
| **Core Loop** | `patpat`, `patpat-loop` | Standard evidence-driven engineering cycle. |
| **Design & Architecture** | `patpat-architect`, `patpat-plan`, `patpat-impact`, `patpat-inspect` | High-level system design, multi-phase contracts, blast radius analysis, and read-only audits. |
| **Code Mutation** | `patpat-change`, `patpat-engineer`, `patpat-debug` | Bounded minimal-diff modifications, delegated work slices, and defect root-cause reproduction. |
| **Proof & Verification** | `patpat-verify`, `patpat-verifier`, `patpat-review`, `patpat-eval` | Authoritative runtime surface assertions, custom verifier generators, skeptical peer reviews. |
| **Delivery & Scale** | `patpat-ship`, `patpat-run`, `patpat-swarm`, `patpat-arena`, `patpat-perf` | Pull request releases, resumable state machines, worker fan-out, competitive grafting, numeric optimization. |
| **Platform Knowledge** | `patpat-learn`, `patpat-skill`, `patpat-automation`, `patpat-setup` | Recurring mistake encoding, reusable SKILL.md authoring, external webhook automation. |

### The Evidence Loop

```text
FRAME ──► INSPECT ──► PROOF CONTRACT ──► ACT ──► VERIFY ──► REVIEW ──► REPORT / SHIP
```
1. **FRAME**: Define scope boundary and classify risk.
2. **INSPECT**: Read live repository evidence before assuming root causes.
3. **PROOF CONTRACT**: Define `Claim`, `Surface`, `Action`, `Expect`, `Cleanup` prior to editing.
4. **ACT**: Execute the smallest safe mutation.
5. **VERIFY**: Assert behavior against real compilers, test suites, or live HTTP endpoints.
6. **REVIEW / SHIP**: Independent challenge before PR submission or deployment.

---

## Quality Assurance & Verification

```sh
# Run Patze native unit test suite (Jev steer policy + Imagine client)
node --test src/tools/xai-imagine.test.js src/jev/steer.test.js

# Update and synchronize Patpat skills from upstream
pnpm update-skills

# Syntax validation across all core modules
node --check src/index.js && node --check src/jev/engine.js && node --check src/tools/xai-imagine.js

# Full engine test suite
pnpm test
```

Automated daily skill synchronization is maintained via [.github/workflows/sync-patpat.yml](.github/workflows/sync-patpat.yml).

---

## Enterprise Compatibility & Links

- **Repository**: [https://github.com/goiltpatpat/Patze](https://github.com/goiltpatpat/Patze)
- **Engine**: [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- **Workflows**: [Patpat](https://github.com/goiltpatpat/patpat)
- **Microkernel**: [Cordis Core](https://cordis.moe/)

## License

Released under the [MIT License](LICENSE).
