# Patze

[English](README.md) | 中文

Patze 是本机自主智能体工程宿主。它在 [Cordis](https://github.com/cordiverse/cordis) 上运行 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，从 `.agents/skills` 加载 [Patpat](https://github.com/goiltpatpat/patpat) 技能，并以 Cordis 插件形式挂载一层 System 1（**Jev**）。

对话模型（System 2）由你配置的供应商决定。Jev 不替代它。Jev 负责意图分类、拦截危险的类 shell 工具参数、以及给 proof 文本打分。工作流由代码掌握。

文档：以本 README 为准。[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) 可能滞后。另见 [Patpat 指南](plugins/patpat/docs/guide/README.md) · [DeepSeek Harness](https://deepseek-harness.github.io/deepseek-harness/)

## 目录

```text
Patze/
├── bin/patze.js              # 启动器（子模块、.env、Cordis overlay）
├── config/cordis.yml         # 把 src/index.js 插入引擎
├── src/
│   ├── index.js              # Patze core：Jev + Imagine 工具
│   ├── jev/                  # System 1：路由、安全、proof
│   └── tools/xai-imagine.js  # grok-imagine-image-2.0 / grok-imagine-video-1.5
├── .agents/skills/           # 22 项 Patpat 技能
├── plugins/patpat/           # 上游技能子模块
└── engine/deepseek-harness/  # 引擎子模块
```

生成的图片和视频写在 `artifacts/`（已 gitignore）。

## 运行时

```text
Web UI :3080  或  headless CLI
        │
        ▼
Cordis  ←  config/cordis.yml  ←  patze-core（Jev + Imagine 工具）
        │
        ├─ tools/pre-execute     Jev 安全闸门
        ├─ tools/post-execute    Jev proof 观察
        └─ agent/pre-step        每轮只路由一次（不向媒体请求 inject）
```

Jev 是后台插件，不是第二个聊天智能体。媒体请求走 Imagine 工具和 system prompt。Jev 只记路由，不在同一轮中途再次 inject（此前会导致第二次视频任务）。

可选：设置 `TYPESAFE_API_KEY` 以调用 TypeSafe System One（`Choice` / `Score` / `Noul`）。未设置时使用本地启发式。

## 快速开始

需要 Node.js `^22.19 || >=24`、pnpm `>=11.7.0`、Git、Python `>=3.11`。

```sh
git clone --recursive https://github.com/goiltpatpat/Patze.git
cd Patze
pnpm setup
cp .env.example .env
```

填写 `.env`。当该文件存在时，启动器会同步别名（`GEMINI_API_KEY` ↔ `GOOGLE_API_KEY`，`KIMI_API_KEY` ↔ `MOONSHOT_API_KEY`，`TYPESAFE_API_KEY` ↔ `JEV_API_KEY`）。

```dotenv
DEEPSEEK_API_KEY=
GEMINI_API_KEY=
XAI_API_KEY=          # Imagine 图像/视频
MOONSHOT_API_KEY=
TYPESAFE_API_KEY=     # 可选 System One
PORT=3080
HOST=127.0.0.1
```

也可在 Web UI 的 **Settings > Providers** 配置供应商。

### Web UI

```sh
pnpm web
# 或：./bin/patze.js web --no-open
```

进程会打印 `dsh web: http://127.0.0.1:3080/?token=...`。请打开该 URL。直接访问 `http://127.0.0.1:3080` 会得到 401。

### Headless

```sh
pnpm headless -- "Audit workspace dependencies and report security findings"
./bin/patze.js --profile headless "Analyze repository architecture"
```

### CLI

```sh
./bin/patze.js route "Fix memory leak in background worker queue"
./bin/patze.js guard "rm -rf /var/log/*"
./bin/patze.js evaluate "All 12 tests passed" "all unit tests pass"
./bin/patze.js imagine-video "A red balloon rising against a blue sky"
./bin/patze.js imagine-image "A collie sitting in a sunlit field"
```

`imagine-video` / `imagine-image` 调用 xAI Imagine（`grok-imagine-video-1.5`、`grok-imagine-image-2.0`），结果写入 `artifacts/`。需要 `XAI_API_KEY`，并由 xAI 计费。

## Patpat 技能

由 `@deepseek-ai/dsh-skill-filesystem` 从 `.agents/skills` 加载：22 项 Patpat 技能，另有 `typesafe-ai`。

| 类别 | 技能 |
|---|---|
| 循环 | `patpat`, `patpat-loop` |
| 设计 | `patpat-architect`, `patpat-plan`, `patpat-impact`, `patpat-inspect` |
| 变更 | `patpat-change`, `patpat-engineer`, `patpat-debug` |
| 证明 | `patpat-verify`, `patpat-verifier`, `patpat-review`, `patpat-eval` |
| 交付 | `patpat-ship`, `patpat-run`, `patpat-swarm`, `patpat-arena`, `patpat-perf` |
| 平台 | `patpat-learn`, `patpat-skill`, `patpat-automation`, `patpat-setup` |

循环：`FRAME -> INSPECT -> PROOF CONTRACT -> ACT -> VERIFY -> REVIEW -> REPORT`。

## 维护

```sh
pnpm update-skills   # plugins/patpat → .agents/skills
pnpm test            # 引擎测试
pnpm test:jev        # Jev 路由策略
pnpm test:imagine    # Imagine 客户端（mock fetch）
pnpm build
```

每日技能同步：[.github/workflows/sync-patpat.yml](.github/workflows/sync-patpat.yml)。

## 链接

- [Patze](https://github.com/goiltpatpat/Patze) · [Issues](https://github.com/goiltpatpat/Patze/issues)
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
- [Patpat](https://github.com/goiltpatpat/patpat)

## 许可证

[MIT](LICENSE)
