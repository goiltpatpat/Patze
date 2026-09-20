# Patze

English | [中文](README.zh.md)

**Patze** is an evidence-driven autonomous agent engineering platform engineered with a **Dual-Brain Cognitive Architecture (System 1 + System 2)**. It orchestrates the hot-reloadable micro-kernel of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (powered by [Cordis](https://github.com/cordiverse/cordis)), the sub-millisecond heuristic safety & routing engine of **Jev (TypeSafe AI)**, and the rigorous verification protocols of [Patpat](https://github.com/goiltpatpat/patpat).

Documentation: [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) · [Patpat Guide](plugins/patpat/docs/guide/README.md) · [DeepSeek Harness Docs](https://deepseek-harness.github.io/deepseek-harness/)

---

## Architectural Principles

Patze enforces production-grade software engineering discipline on autonomous AI systems:

1. **Dual-Brain Cognitive Topology (System 1 + System 2)**:
   - **System 1 (Jev Fast Heuristics — <5ms)**: Sub-millisecond deterministic intent routing, pattern-based safety guardrails (intercepting destructive commands like unvetted deletions or malformed state transitions), and schema validation without consuming model inference tokens.
   - **System 2 (Deep Reasoning LLMs)**: Deep reasoning, architectural synthesis, state-machine generation, and hypothesis testing powered by DeepSeek-R1/V3, Claude, OpenAI, or OpenRouter.
2. **Proof over Proxy (Patpat Evidence Protocol)**:
   - Agents are forbidden from claiming task completion based on internal speculation or mock proxies. Every modification requires verified proof observed on the authoritative runtime surface (live HTTP response, exact compiler output, or test exit code).
3. **Micro-Kernel Plugin Fabric (Cordis Engine)**:
   - Spatiotemporally decoupled runtime. Tooling, model providers, execution sandboxes, and file watchers operate as hot-reloadable, isolated services registered via `ctx.provide()` and declarative YAML overlays.
4. **Resilient Developer Experience**:
   - Zero-friction auto-healing launcher (`./bin/patze.js`) that automatically initializes missing submodules and engine dependencies upon boot.

---

## System Architecture

```text
+-------------------------------------------------------------------------------+
|                             Patze Runtime Layer                               |
|   Web UI Console (Vite / Node :3080)       Headless CLI Runner (--profile)    |
+-------------------------------------------------------------------------------+
                                       │
                                       ▼
+-------------------------------------------------------------------------------+
|                       System 1: Fast Heuristic Engine (Jev)                   |
|   • Intent & Skill Routing (<5ms)         • Command & Execution Guardrails    |
|   • Syntax & Policy Pre-validation        • Zero-Inference Fast Path          |
+-------------------------------------------------------------------------------+
                                       │
                                       ▼
+-------------------------------------------------------------------------------+
|                         Cordis Micro-Kernel & Loader                          |
|   • Service Registry (`ctx.provide`)      • Isolated Context Scopes           |
|   • Dynamic Hot Reloading                 • config/cordis.yml Patch Overlay   |
+-------------------------------------------------------------------------------+
         │                                  │                                  │
         ▼                                  ▼                                  ▼
+--------------------+            +--------------------+            +--------------------+
|  Model Connectors  |            | System 2 Reasoning |            | Execution Surfaces |
| DeepSeek / OpenAI  | <========> | Patpat Loop (22)   | <========> | Sandboxed Bash     |
| Claude / OpenRouter|            | Evidence Protocol  |            | Subagents / MCP    |
+--------------------+            +--------------------+            +--------------------+
```

---

## Patpat Engineering Skills Matrix

Patze bundles 22 specialized, evidence-driven engineering skills loaded directly into the AI context via `@deepseek-ai/dsh-skill-filesystem`:

| Phase / Category | Skills | Functional Responsibility |
|---|---|---|
| **Core Engineering Loop** | `patpat`, `patpat-loop` | Standard disciplined cycle: `FRAME -> INSPECT -> PROOF CONTRACT -> ACT -> VERIFY -> REVIEW -> REPORT` |
| **Architecture & Analysis** | `patpat-architect`, `patpat-plan`, `patpat-impact`, `patpat-inspect` | Pre-implementation contracts, multi-phase state machine design, non-destructive diagnosis, and blast-radius tracing |
| **Bounded Implementation** | `patpat-change`, `patpat-engineer`, `patpat-debug` | Minimal diff mutations, bounded integration tasks, and reproducible root-cause defect elimination |
| **Verification & Quality** | `patpat-verify`, `patpat-verifier`, `patpat-review`, `patpat-eval` | Authoritative surface observation, verifiable smoke generation, independent skeptical review, and skill evaluation |
| **Delivery & Orchestration** | `patpat-ship`, `patpat-run`, `patpat-swarm`, `patpat-arena`, `patpat-perf` | Verified PR landing, resumable multi-stage state machines, parallel worker swarms, competing solution arenas, and numeric optimization |
| **Platform & Metacognition**| `patpat-learn`, `patpat-skill`, `patpat-automation`, `patpat-setup` | Durable constraint capture, custom skill authoring, external automation scaffolding, and host verification |

---

## Quickstart

### Prerequisites

- **Node.js**: `^22.19 || >=24`
- **pnpm**: `>=11.7.0`
- **Git** & **Python**: `>=3.11`

### 1. Clone & Bootstrap

```sh
# Clone repository with submodules
git clone --recursive https://github.com/goiltpatpat/Patze.git
cd Patze

# Initialize submodules, install engine dependencies, and build
pnpm setup
```

> **Smart Launcher:** The CLI binary `./bin/patze.js` automatically detects uninitialized submodules or missing dependencies and self-heals in-place.

### 2. Configure Environment

Copy the example environment file and insert your API credentials:

```sh
cp .env.example .env
```

Key configuration variables:
```dotenv
DEEPSEEK_API_KEY="your-deepseek-api-key"
# Optional overrides:
# OPENAI_API_KEY="your-openai-api-key"
# ANTHROPIC_API_KEY="your-anthropic-api-key"
```
*(Alternatively, credentials can be configured interactively in the Web UI under **Settings > Providers**).*

### 3. Launch Web UI Console

```sh
pnpm web
# Or execute directly with launcher:
./bin/patze.js web
```

* Navigate to `http://127.0.0.1:3080`
* For headless remote servers, use `./bin/patze.js web --no-open`

### 4. Headless CLI Mode

Run autonomous tasks directly from terminal or CI/CD pipelines:

```sh
pnpm headless -- "Audit workspace dependencies and report security findings"
# Or:
./bin/patze.js --profile headless "Analyze repository architecture and report findings"
```

### 5. Jev System 1 Decision CLI

Utilize ultra-fast, zero-token deterministic routing and safety validation:

```sh
# Sub-millisecond skill intent routing (<5ms)
./bin/patze.js route "Fix memory leak in background worker queue"

# Sub-millisecond execution safety guardrail (<5ms)
./bin/patze.js guard "rm -rf /var/log/*"
```

---

## Synchronization & Maintenance

### Keeping Patpat Skills Up-to-Date

Patze integrates Patpat as an active submodule tracking the upstream `main` branch. Synchronize all skills with a single command:

```sh
pnpm update-skills
```

This updates `plugins/patpat` to the latest commit and synchronizes all skill bundles into `.agents/skills`. Automated daily sync is also maintained via [.github/workflows/sync-patpat.yml](.github/workflows/sync-patpat.yml).

### Quality Verification

```sh
# Run engine test suite
pnpm test

# Rebuild engine packages
pnpm build
```

---

## Production Deployment & Collaboration

Patze is ready for multi-user, team-based collaboration:

### Option A: Cloud VPS with Reverse Proxy (Recommended for Teams)
1. Run Patze via process manager:
   ```sh
   pm2 start ./bin/patze.js --name patze -- web --host 0.0.0.0 --port 3080 --no-open
   ```
2. Configure **Caddy** or **Nginx** reverse proxy to your custom domain (`https://patze.yourdomain.com`) with automated SSL.
3. Access collaboratively using the session authentication token generated at startup.

### Option B: Cloudflare Zero Trust Tunnel (Instant & Private)
1. Run local tunnel without opening firewall ports:
   ```sh
   cloudflared tunnel --url http://localhost:3080
   ```
2. Route traffic securely through Cloudflare Access for your organization or team members.

---

## Community & Ecosystem

- **Main Repository**: [https://github.com/goiltpatpat/Patze](https://github.com/goiltpatpat/Patze)
- **Issue Tracker**: [https://github.com/goiltpatpat/Patze/issues](https://github.com/goiltpatpat/Patze/issues)
- **Upstream Engine**: [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- **Upstream Skills**: [Patpat](https://github.com/goiltpatpat/patpat)

---

## License

Released under the [MIT License](LICENSE).
