# Patze: 证据驱动的自主智能体工程平台

[English](README.md) | 中文

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22%20%7C%2024-green.svg)](https://nodejs.org/)
[![Architecture](https://img.shields.io/badge/Architecture-Cordis%20Microkernel-blue.svg)](https://cordis.moe/)
[![Engine](https://img.shields.io/badge/Engine-DeepSeek%20Harness-purple.svg)](https://github.com/deepseek-ai/deepseek-harness)
[![Skills](https://img.shields.io/badge/Skills-22%20Patpat%20Workflows-orange.svg)](https://github.com/goiltpatpat/patpat)

**Patze** 是面向专业软件开发人员与工程团队的**证据驱动自主智能体工程平台**。它将 [Cordis](https://github.com/cordiverse/cordis) 上的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 可扩展微内核架构，与 22 项严谨的 [Patpat](https://github.com/goiltpatpat/patpat) 软件工程工作流、亚 2 毫秒 **TypeSafe Jev System 1** 决策闸门以及原生多模态生成媒体能力融为一体。

平台将高速确定性意图路由与安全守卫，与重量级推理大模型分层解耦，在最大化 GPU KV Cache 命中率的同时，严格执行“先证明后合并”的代码工程契约。

---

## 核心工程支柱

| 核心支柱 | Patze 的具体实现 | 团队收益 |
| :--- | :--- | :--- |
| **Token 极致经济性** | • 冻结系统提示词前缀（保持 90%+ KV Cache 命中）<br>• `@deepseek-ai/dsh-spill` 将 >50KB 的工具输出自动转储到磁盘<br>• Jev System 1 以 <2ms 速度路由意图，消耗 **0 LLM Token** | 降低 API 支出高达 90%；彻底杜绝超大代码库的上下文膨胀。 |
| **严谨证据驱动闭环** | • 22 项专业 Patpat 工作流（`architect`, `debug`, `verify`, `ship`）<br>• 正式 5 要素证明契约（`Claim`, `Surface`, `Action`, `Expect`, `Cleanup`） | 消除模型幻觉与未验证声明；所有代码变更必须在真实运行时环境得到验证。 |
| **双引擎协同架构** | • **System 1 (Jev Engine)**：主动 `tools/pre-execute` AgentShield 与 `tools/post-execute` 诊断监控<br>• **System 2 (基座 LLM)**：DeepSeek V3/R1, Grok 4.6, Claude, Gemini 或 Kimi | 本地高速运行安全防护，拦截高危指令后再调用昂贵模型。 |
| **原生自主多模态生成** | • 原生 `xai_imagine_image` (Grok Imagine Image 2.0)<br>• 异步轮询 `xai_imagine_video` (Grok Imagine Video 1.5)<br>• 媒体产物自动持久化至 `artifacts/` 目录 | 团队可在聊天中直接生成生产级架构图、设计资产与 UI 动态片段。 |

---

## 平台架构

```text
                      ┌─────────────────────────────────┐
                      │      操作员 / 软件工程团队      │
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
                     Cordis 微内核与 Patze Core 核心层
    ══════════════════════════════════════════════════════════════════════════
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
  [Jev System 1]               [智能体循环 (Loop)]           [DeepSeek 引擎]
  • tools/pre-execute          • Prompt 汇编装配             • 磁盘溢出转储 (>50KB)
    (AgentShield 安全门)       • 作用域父链继承               • 历史自动紧缩压缩
  • tools/post-execute         • 事件溯源日志                 • 预设 Standing 挂载
    (诊断监视器)                 (SQLite / 内存)              • 插件管理器
  • agent/pre-step             
    (0-Token 意图引导)         
        │                              │                              │
        └──────────────────────────────┼──────────────────────────────┘
                                       ▼
    ══════════════════════════════════════════════════════════════════════════
                                执行层
    ══════════════════════════════════════════════════════════════════════════
        │                              │                              │
        ▼                              ▼                              ▼
  [基座大模型]                 [22 项 Patpat 技能]           [生成式工具集]
  • DeepSeek V3 / R1           • .agents/skills/             • grok-imagine-image-2.0
  • xAI Grok 4.6               • Architect, Plan, Impact     • grok-imagine-video-1.5
  • Anthropic Claude           • Debug, Change, Verify       • 产物自动保存至
  • Google Gemini / Kimi       • Ship, Run, Swarm, Arena       artifacts/ 目录
```

---

## 代码目录

```text
Patze/
├── bin/patze.js              # 平台 CLI 启动器（子模块引导、.env 处理、Cordis 补丁）
├── config/cordis.yml         # Cordis 配置补丁（注入 patze-core 与技能目录）
├── src/
│   ├── index.js              # 平台核心入口：挂载 Jev、AgentShield 与 Imagine 工具
│   ├── index.ts              # TypeScript 类型声明与导出
│   ├── jev/                  # System 1 决策层
│   │   ├── engine.js         # 意图分类器 (<2ms)、AgentShield 与证明评估器
│   │   ├── plugin.js         # Cordis 主动钩子 (pre-execute, post-execute, pre-step)
│   │   ├── steer.js          # Turn 边界引导策略
│   │   └── types.ts          # 决策类型契约
│   └── tools/
│       ├── xai-imagine.js    # xAI Imagine 套件（Image 2.0 与异步 Video 1.5）
│       └── xai-imagine.test.js # 单元测试套件（11/11 测试全数通过）
├── .agents/skills/           # 22 项活跃 Patpat 工程技能 + typesafe-ai
├── plugins/patpat/           # 上游 Patpat 子模块
├── engine/deepseek-harness/  # DeepSeek Harness 子模块 (v0.1.7-rc.1)
└── artifacts/                # 本地生成媒体产物（图片/视频，已 gitignore）
```

---

## 快速开始

### 环境依赖
- **Node.js**: `^22.19.0 || >=24.0.0`
- **包管理器**: `pnpm >=11.7.0`
- **操作系统**: Linux, macOS 或 Windows WSL2
- **Python**: `>=3.11`（用于测试与技能辅助）
- **Git**: `>=2.30`

### 1. 克隆与初始化

```sh
git clone --recursive https://github.com/goiltpatpat/Patze.git
cd Patze
pnpm setup
cp .env.example .env
```

### 2. 配置凭据

在 `.env` 中填入你的 API Key。Patze 会自动规范化别名（如 `GEMINI_API_KEY` ↔ `GOOGLE_API_KEY`, `KIMI_API_KEY` ↔ `MOONSHOT_API_KEY`, `TYPESAFE_API_KEY` ↔ `JEV_API_KEY`）：

```dotenv
# 主模型供应商
DEEPSEEK_API_KEY=
XAI_API_KEY=              # 用于 Grok 4.6, Imagine Image 2.0 及 Imagine Video 1.5
GEMINI_API_KEY=           # 或 GOOGLE_API_KEY
MOONSHOT_API_KEY=         # 或 KIMI_API_KEY
ANTHROPIC_API_KEY=        # Claude 模型
OPENAI_API_KEY=           # GPT 模型

# System 1 优化（可选）
TYPESAFE_API_KEY=         # TypeSafe System One (Choice / Score / Noul)

# 网络端口
PORT=3080
HOST=127.0.0.1
```

*(也可在启动后的 Web UI 中，通过 **Settings > Providers** 进行动态设置)*

---

## 运行模式

### 模式 A: 交互式 Web UI

```sh
pnpm web
# 或: ./bin/patze.js web --no-open
```

启动完成后，控制台将输出带认证令牌的访问地址：
```text
dsh web: http://127.0.0.1:3080/?token=Mx3lLUFF0ty3zw9d4mIBnhBIBL_vZCKoyinpRuCFG5g
```
在浏览器中打开该 URL。直接访问裸地址 `http://127.0.0.1:3080` 将被安全拦截并返回 401。

### 模式 B: 无头批处理与 CI/CD 流水线

直接在终端或 CI/CD 流程中执行自主任务：

```sh
pnpm headless -- "Audit workspace dependencies and report security findings"
./bin/patze.js --profile headless "Analyze repository architecture"
```

### 模式 C: 高速 CLI 工具链

Patze 提供用于快速 System 1 验证和媒体生成的确定性命令行工具：

```sh
# System 1 意图路由 (0 LLM Token, < 2ms)
./bin/patze.js route "Fix memory leak in background worker queue"

# AgentShield 安全闸门审查
./bin/patze.js guard "rm -rf /var/log/*"

# 证据证明契约评估
./bin/patze.js evaluate "All 12 tests passed" "all unit tests pass"

# Grok Imagine Video 1.5 视频生成（轮询集群并在完成后写入 .mp4）
./bin/patze.js imagine-video "A robotic arm assembling high precision circuits in a clean room"

# Grok Imagine Image 2.0 图像生成（写入 .png）
./bin/patze.js imagine-image "Isometric architectural diagram of a distributed microkernel"
```

生成的文件将保存在本地 `artifacts/videos/` 与 `artifacts/images/` 目录中。

---

## Patpat 软件工程技能矩阵

Patze 搭载了由 `.agents/skills` 提供的 22 项官方工程技能：

| 领域 | 技能集合 | 核心职责 |
| :--- | :--- | :--- |
| **核心循环** | `patpat`, `patpat-loop` | 标准证据驱动工程闭环。 |
| **设计与架构** | `patpat-architect`, `patpat-plan`, `patpat-impact`, `patpat-inspect` | 高阶系统设计、多阶段契约规划、影响面分析、只读深度调研。 |
| **代码变更** | `patpat-change`, `patpat-engineer`, `patpat-debug` | 严格有界的最小 Diff 修改、受限工作切片执行、缺陷根因复现。 |
| **证明与核验** | `patpat-verify`, `patpat-verifier`, `patpat-review`, `patpat-eval` | 权威运行时真实断言、专用验证器编写、独立怀疑论代码审查。 |
| **交付与扩展** | `patpat-ship`, `patpat-run`, `patpat-swarm`, `patpat-arena`, `patpat-perf` | PR 发版交付、可恢复状态机长任务、多工作器并行、竞合嫁接、性能数学校准。 |
| **知识与沉淀** | `patpat-learn`, `patpat-skill`, `patpat-automation`, `patpat-setup` | 周期性错误沉淀为硬约束、可复用 SKILL.md 编写、外部自动化集成。 |

### 证据工程循环

```text
FRAME (界定) ──► INSPECT (审查) ──► PROOF CONTRACT (证明契约) ──► ACT (执行) ──► VERIFY (核验证明) ──► REVIEW (挑战审查) ──► REPORT / SHIP (发版)
```

---

## 质量保证与测试验证

```sh
# 运行 Patze 原生单元测试套件（Jev 路由、导向策略与 Imagine 套件）
pnpm run test:unit

# 从上游同步并更新 Patpat 技能
pnpm update-skills

# 核心模块语法静态校验
node --check src/index.js && node --check src/jev/engine.js && node --check src/jev/router.js && node --check src/tools/xai-imagine.js

# 完整引擎测试套件
pnpm test
```

技能库通过 [.github/workflows/sync-patpat.yml](.github/workflows/sync-patpat.yml) 保持每日自动同步。

---

## 技术架构文档与资源

- **Jev System 1 决策架构与可控重排序**: [`docs/resources/jev-system1-architecture.md`](docs/resources/jev-system1-architecture.md)
- **底层引擎**: [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- **工程技能**: [Patpat](https://github.com/goiltpatpat/patpat)
- **微内核**: [Cordis Core](https://cordis.moe/)
- **TypeSafe AI**: [TypeSafe AI 官方文档](https://docs.typesafe.ai/)

## 许可证

基于 [MIT 许可证](LICENSE) 发布。
