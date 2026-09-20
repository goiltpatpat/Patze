# Patze

[English](README.md) | 中文

**Patze** 是一个以证据为驱动的自主智能体工程平台（Evidence-Driven Autonomous Agent Engineering Platform）。它结合了 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的模块化插件架构（由 [Cordis](https://github.com/cordiverse/cordis) 驱动）与 [Patpat](https://github.com/goiltpatpat/patpat) 的严格验证协议及 22 项专业工程技能。

文档：[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) · [Patpat 指南](plugins/patpat/docs/guide/README.md) · [DeepSeek Harness 官方文档](https://deepseek-harness.github.io/deepseek-harness/)

---

## Overview

Patze 将先进的智能体编排与生产级软件工程规范相结合：

- **一切皆插件（Everything-is-a-Plugin）**：基于 Cordis 的时空可组合性，工具、模型提供者及工作流皆为可热重载的模块化插件。
- **证据优于代理（Proof over Proxy）**：内置践行 Patpat 工程原则，智能体必须在权威真实表面验证行为，杜绝凭空推测或假造测试。
- **22 项证据驱动技能**：原生发现并加载专业工程技能（`patpat-loop`、`patpat-architect`、`patpat-debug`、`patpat-verify`、`patpat-review`、`patpat-ship` 等）。
- **双运行模式**：提供用于人机协同的完整 Web UI 控制台，以及适用于自动化任务的 Headless CLI 执行器。

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

Patze 在 `.agents/skills` 目录中为会话加载 22 项证据驱动的工程技能：

| 技能分类 | 主要技能 | 描述 |
|---|---|---|
| **核心循环** | `patpat`, `patpat-loop` | 标准工程闭环：`FRAME -> INSPECT -> PROOF CONTRACT -> ACT -> VERIFY -> REVIEW -> REPORT` |
| **架构与规划** | `patpat-architect`, `patpat-plan` | 实施前的契约设计、状态机规划及影响范围推导 |
| **工程实现** | `patpat-change`, `patpat-engineer` | 具名证据契约的最小受控代码修改 |
| **诊断与修复** | `patpat-debug`, `patpat-inspect` | 根因隔离、缺陷复现与非破坏性系统检查 |
| **验证与质量** | `patpat-verify`, `patpat-verifier` | 权威表面观测与项目级验证套件构建 |
| **评审与交付** | `patpat-review`, `patpat-ship` | 怀疑论代码评审与授权 Pull Request 提交/合入 |
| **并发与缩放** | `patpat-run`, `patpat-swarm`, `patpat-arena` | 可恢复的多阶段工作流与隔离并行任务 |

---

## Quickstart

### Prerequisites

- **Node.js**：`^22.19 || >=24`
- **pnpm**：`>=11.7.0`
- **Python**：`>=3.11`（用于可选 Python SDK 及运行时脚本）

### Installation

```sh
git clone git@github.com:goiltpatpat/Patze.git
cd Patze
pnpm install
pnpm run build
```

### Configure Environment

```sh
cp .env.example .env
```

### Launch Web Console

```sh
pnpm dsh web
```

Web UI 将运行在 `http://127.0.0.1:3080`。在远程或 SSH 环境下可附加 `--no-open` 参数。

### Headless Execution

```sh
pnpm dsh --profile headless "Analyze repository architecture and report findings"
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

如需从 `plugins/patpat` 同步更新技能：

```sh
python3 plugins/patpat/scripts/install_skills.py --target .agents/skills --mode copy
```

---

## Community & Support

- 仓库地址：[https://github.com/goiltpatpat/Patze](https://github.com/goiltpatpat/Patze)
- 问题反馈与讨论：[https://github.com/goiltpatpat/Patze/issues](https://github.com/goiltpatpat/Patze/issues)
- 上游 DeepSeek Harness：[https://github.com/deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
- Patpat 技能仓库：[https://github.com/goiltpatpat/patpat](https://github.com/goiltpatpat/patpat)

---

## License

[MIT](LICENSE)
