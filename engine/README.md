# Patze Execution Engine Layer

This directory contains the underlying agent execution runtime for the **Patze Platform**.

## Architecture & Submodule Decoupling

Patze employs a decoupled vendor-submodule architecture:

- **[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)** is tracked as a clean Git submodule pointer (`160000` mode).
- This keeps Patze's repository standalone, modular, and lightweight while leveraging DeepSeek Harness's high-performance Cordis-based plugin kernel and multi-provider LLM primitives.

## Quick Initialization

If you cloned Patze without the `--recursive` flag, initialize the engine submodule with:

```bash
# From repository root:
pnpm setup

# Or manually:
git submodule update --init --recursive
pnpm --dir engine/deepseek-harness install
pnpm --dir engine/deepseek-harness run build
```

## Running the Engine via Patze CLI

You do not need to enter this directory manually. Use the root launchers:

```bash
# Launch Web UI Console (:3080)
pnpm web

# Run Headless CLI
pnpm headless

# Direct Patze binary
./bin/patze.js --help
```
