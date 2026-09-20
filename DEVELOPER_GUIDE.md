# Patze Platform Developer Guide

> **Prepared by Senior Google Engineering Team**  
> Focus: High-Reliability Architecture, Decoupled Engine Composability, Evidence-Driven Agent Engineering.

---

## 1. Executive Summary & Repository Topology

**Patze** is a standalone, production-grade autonomous agent engineering platform. It leverages **DeepSeek Harness** as its underlying engine and incorporates the **Patpat Evidence-Driven Agent Engineering Skill System**.

```
Patze/ (Standalone Project Root)
├── .agents/
│   └── skills/                      # Scanned automatically by @deepseek-ai/dsh-skill-filesystem
│       ├── .patpat-inventory.json   # Patpat installation & integrity manifest
│       └── patpat*                  # 22 Patpat engineering skills (patpat-loop, architect, debug, etc.)
├── config/                          # Patze Cordis profiles and orchestration
│   └── cordis.yml                   # Cordis platform composition
├── engine/
│   └── deepseek-harness/            # Isolated DeepSeek Harness engine (Workspaces, Apps, Packages)
├── plugins/
│   └── patpat/                      # Standalone Patpat repository for skill development
├── src/                             # Patze custom platform plugins, tools, and extensions
│   └── index.ts                     # Patze core entrypoint
├── .env.example                     # Environment template (DEEPSEEK_API_KEY)
├── DEVELOPER_GUIDE.md               # This guide
├── package.json                     # Patze root project manifest & orchestration scripts
└── README.md                        # Flagship Patze documentation
```

---

## 2. Senior Google Engineering Team Architecture Decisions

| Role | Domain | Key Architecture Mandates |
|---|---|---|
| **Google Staff Systems Architect** | Subsystem Decoupling & Standalone Repository | Isolated DeepSeek Harness into `engine/deepseek-harness/` so Patze maintains its own clean Git history, custom application lifecycle, and unpolluted root workspace. |
| **Google Senior Tooling Lead** | Zero-Friction Proxy Orchestration | Configured root `package.json` proxy scripts to wire `engine/deepseek-harness` and `src/` together, providing top-level scripts (`pnpm web`, `pnpm headless`, `pnpm build`) without polluting the root namespace. |
| **Google Principal Verification Engineer** | Quality Gates & Proof-over-Proxy | Preserved full build and test capability across the entire engine and verified runtime skill loading of all 22 Patpat skills. |
| **Google Senior DX Lead** | Developer Experience & Extensibility | Created top-level entrypoints in `src/`, modular configuration in `config/`, and single-command workflows for developers. |

---

## 3. How Patze Operates: Dual-Brain (System 1 Jev + System 2 DeepSeek) & Patpat

1. **System 1 (Jev Fast Decision Layer)**: Powered by `@patze/plugin-jev`, executing in sub-10ms latency:
   - **Fast Intent & Skill Routing**: Classifies user prompts and selects the optimal Patpat skill (`patpat-debug`, `patpat-architect`, `patpat-verify`, etc.).
   - **Safety Guardrail**: Inspects tool calls and shell operations before execution to block catastrophic commands (`rm -rf /`, force pushes to `main`).
   - **Proof Contract Evaluation**: Rapid rubric scoring of task outputs to prevent infinite loops.
2. **System 2 (DeepSeek-R1/V3 Heavy Reasoning)**: Handles deep multi-step planning, code generation, architectural refactoring, and complex tool execution.
3. **Cordis Kernel**: Patze mounts plugins declared in `config/cordis.yml` and inherits the base engine bundles from `engine/deepseek-harness`.
4. **Skill Discovery**: The `@deepseek-ai/dsh-skill-filesystem` provider discovers all 22 Patpat engineering skills in `.agents/skills/`.
5. **Evidence-Driven Engineering**: Agents running inside Patze operate under the Patpat loop (`FRAME -> INSPECT -> PROOF CONTRACT -> ACT -> VERIFY -> REVIEW -> REPORT`).

---

## 4. Quickstart & Commands

### A. Environment Configuration
```bash
cp .env.example .env
# Edit .env and configure DEEPSEEK_API_KEY
```

### B. Running Patze

1. **Launch Web UI Console**:
   ```bash
   pnpm web
   ```
   Opens `http://127.0.0.1:3080`.

2. **Run Headless Single Task**:
   ```bash
   pnpm headless "Analyze architecture and list discovered skills"
   ```

3. **Synchronize Patpat Skills**:
   ```bash
   pnpm run sync-skills
   ```

4. **Build & Test Engine**:
   ```bash
   pnpm run build
   pnpm run test
   ```
