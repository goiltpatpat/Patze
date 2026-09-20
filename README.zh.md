# Patze

[English](README.md) | 中文

**Patze** 是一个以证据为驱动的自主智能体工程平台（Evidence-Driven Autonomous Agent Engineering Platform），采用**双脑认知架构（System 1 + System 2）**。它将 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（基于 [Cordis](https://github.com/cordiverse/cordis)）的热重载微内核、**Jev (TypeSafe AI)** 的亚毫秒级启发式安全与意图路由引擎，以及 [Patpat](https://github.com/goiltpatpat/patpat) 的严格验证工程协议深度整合。

文档：[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) · [Patpat 指南](plugins/patpat/docs/guide/README.md) · [DeepSeek Harness 官方文档](https://deepseek-harness.github.io/deepseek-harness/)

---

## 架构原则

Patze 将生产级软件工程规范注入自主 AI 系统：

1. **双脑认知拓扑（System 1 + System 2）**：
   - **System 1 (Jev 快速启发式引擎 — <5ms)**：提供确定性的意图与技能路由、基于模式匹配的实时安全防护栏（拦截破坏性命令、高危文件操作与畸变调用），不消耗任何模型推理 Token。
   - **System 2 (深度推理基础模型)**：基于 DeepSeek-R1/V3、Claude、OpenAI 等大模型进行高阶架构设计、多阶段状态机规划、假设验证与复杂代码合成。
2. **证据优于代理（Proof over Proxy）**：
   - 严格遵循 Patpat 验证协议，禁止智能体仅凭内部推测或模拟测试宣布任务完成。每一项变更都必须在权威真实表面（如实际 HTTP 响应、编译器精准输出、真实测试退出码）获得可复现的运行证据。
3. **微内核插件总线（Cordis 引擎）**：
   - 时空解耦的运行时环境。工具集、模型连接器、沙箱执行器与文件监听器均作为独立的微服务，通过 `ctx.provide()` 与声明式 YAML 补丁实现热重载与按需加载。
4. **弹性开发者体验**：
   - 提供自愈型智能启动器（`./bin/patze.js`），在首次启动时自动初始化缺失的子模块与依赖项。

---

## 系统拓扑

```text
+-------------------------------------------------------------------------------+
|                             Patze 运行时表现层                                  |
|   Web UI 控制台 (Vite / Node :3080)         Headless 命令行运行器 (--profile)     |
+-------------------------------------------------------------------------------+
                                       │
                                       ▼
+-------------------------------------------------------------------------------+
|                        System 1: 快速反射引擎 (Jev)                            |
|   • 意图与技能路由 (<5ms)                  • 实时指令与沙箱执行防护栏            |
|   • 语法与模式先验校验                     • 零推理消耗极速路径                  |
+-------------------------------------------------------------------------------+
                                       │
                                       ▼
+-------------------------------------------------------------------------------+
|                          Cordis 微内核与插件加载器                             |
|   • 服务注册中心 (`ctx.provide`)          • 隔离化上下文上下文域                 |
|   • 动态热重载机制                         • config/cordis.yml 声明式补丁覆盖   |
+-------------------------------------------------------------------------------+
         │                                  │                                  │
         ▼                                  ▼                                  ▼
+--------------------+            +--------------------+            +--------------------+
|    模型连接适配器    |            | System 2 深度推理   |            |    执行沙箱与工具    |
| DeepSeek / OpenAI  | <========> | Patpat Loop (22)   | <========> | 隔离 Shell 环境    |
| Claude / OpenRouter|            | 严格证据闭环协议    |            | Subagents / MCP    |
+--------------------+            +--------------------+            +--------------------+
```

---

## Patpat 22 项工程技能矩阵

Patze 通过 `@deepseek-ai/dsh-skill-filesystem` 原生注入 22 项证据驱动的专业工程技能：

| 阶段 / 类别 | 核心技能 | 职责说明 |
|---|---|---|
| **核心工程闭环** | `patpat`, `patpat-loop` | 标准工程循环：`FRAME -> INSPECT -> PROOF CONTRACT -> ACT -> VERIFY -> REVIEW -> REPORT` |
| **架构与规划** | `patpat-architect`, `patpat-plan`, `patpat-impact`, `patpat-inspect` | 实施前接口契约设计、多阶段状态机规划、非侵入式架构诊断与改动爆炸半径追踪 |
| **精准实现** | `patpat-change`, `patpat-engineer`, `patpat-debug` | 最小化 Diff 变更、边界受控的任务交付，以及可复现的缺陷根因消除 |
| **验证与质量闸门** | `patpat-verify`, `patpat-verifier`, `patpat-review`, `patpat-eval` | 权威真实表面观察、自动化冒烟验证器生成、独立审慎的代码评审与技能评估 |
| **交付与规模化** | `patpat-ship`, `patpat-run`, `patpat-swarm`, `patpat-arena`, `patpat-perf` | 经证据闭环的 PR 交付与合并、可断点恢复的长流程机、多代理并发集群、方案竞争竞技场与性能调优 |
| **平台与沉淀** | `patpat-learn`, `patpat-skill`, `patpat-automation`, `patpat-setup` | 故障约束固化、智能体技能演进与编写、外部自动化脚手架与环境就绪验证 |

---

## 快速入门

### 环境准备

- **Node.js**: `^22.19 || >=24`
- **pnpm**: `>=11.7.0`
- **Git** 与 **Python**: `>=3.11`

### 1. 克隆与初始化

```sh
# 递归克隆代码仓库与子模块
git clone --recursive https://github.com/goiltpatpat/Patze.git
cd Patze

# 初始化子模块、安装引擎依赖并完成构建
pnpm setup
```

> **自愈特性：** CLI 启动脚本 `./bin/patze.js` 会在检测到子模块或依赖缺失时自动执行修复并就绪。

### 2. 配置环境凭证

复制示例环境配置文件并填入 API Key：

```sh
cp .env.example .env
```

核心配置项：
```dotenv
DEEPSEEK_API_KEY="your-deepseek-api-key"
# 可选模型供应商：
# OPENAI_API_KEY="your-openai-api-key"
# ANTHROPIC_API_KEY="your-anthropic-api-key"
```
*(亦可在 Web UI 控制台中的 **Settings > Providers** 交互式配置)*

### 3. 启动 Web 控制台

```sh
pnpm web
# 或通过执行器启动：
./bin/patze.js web
```

* 浏览器访问 `http://127.0.0.1:3080`
* 远程云服务器无界面模式请附带参数 `./bin/patze.js web --no-open`

### 4. Headless 命令行自动化

在终端或 CI/CD 流水线中直接执行自主工程任务：

```sh
pnpm headless -- "Audit workspace dependencies and report security findings"
# 或：
./bin/patze.js --profile headless "Analyze repository architecture and report findings"
```

### 5. Jev System 1 极速决策工具

享受亚毫秒级、零 Token 消耗的本地快速路由与安全防御：

```sh
# 极速意图路由 (<5ms)
./bin/patze.js route "Fix memory leak in background worker queue"

# 极速命令安全防护栏 (<5ms)
./bin/patze.js guard "rm -rf /var/log/*"
```

---

## 同步与维护

### 同步最新 Patpat 技能

Patze 将 Patpat 作为 Git 子模块追踪上游 `main` 分支，一键即可同步最新技能：

```sh
pnpm update-skills
```

此命令将拉取最新 commit 并将所有技能同步至 `.agents/skills`。仓库同时配置了 GitHub Actions ([.github/workflows/sync-patpat.yml](.github/workflows/sync-patpat.yml)) 进行自动化巡检更新。

### 质量验证

```sh
# 运行测试套件
pnpm test

# 重新构建引擎包
pnpm build
```

---

## 生产部署与团队协作

Patze 支持多用户团队协作部署：

### 方案 A：云 VPS 反向代理（推荐生产使用）
1. 使用进程守护启动 Patze：
   ```sh
   pm2 start ./bin/patze.js --name patze -- web --host 0.0.0.0 --port 3080 --no-open
   ```
2. 配置 **Caddy** 或 **Nginx** 反向代理至自定义域名（`https://patze.yourdomain.com`）并启用自动 SSL 证书。
3. 团队成员凭系统生成的 Auth Token 访问控制台。

### 方案 B：Cloudflare Zero Trust 隧道（极速私密、免开端口）
1. 建立本机安全穿透：
   ```sh
   cloudflared tunnel --url http://localhost:3080
   ```
2. 结合 Cloudflare 访问控制策略，无需公网开放端口即可安全协作。

---

## 社区与生态

- **主仓库**：[https://github.com/goiltpatpat/Patze](https://github.com/goiltpatpat/Patze)
- **问题反馈**：[https://github.com/goiltpatpat/Patze/issues](https://github.com/goiltpatpat/Patze/issues)
- **上游引擎**：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- **上游技能库**：[Patpat](https://github.com/goiltpatpat/patpat)

---

## 开源协议

基于 [MIT License](LICENSE) 开源。
