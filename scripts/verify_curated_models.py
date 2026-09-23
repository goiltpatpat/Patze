#!/usr/bin/env python3
"""Verify the opt-in profile against the pinned Harness model resolver."""

import os
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ADAPTER = ROOT / "engine/deepseek-harness/packages/llm/llm-pi-ai"
VERIFY = r"""
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { loadOverlayPatches } from '@deepseek-ai/dsh-app-boot'
import { resolveProfiles } from './src/config.ts'

const file = resolve(process.env.PATZE_ROOT, 'config/curated-models.patch.yml')
const row = loadOverlayPatches('dsh', file).find(entry => entry.id === 'llm-pi-ai')
assert.ok(row, 'llm-pi-ai row')
const routes = resolveProfiles(row.config.providers, 'strict')
assert.deepEqual([...routes.keys()], ['moonshotai', 'openai'])
const expected = {
  moonshotai: ['kimi-k2.6', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k3'],
  openai: ['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna'],
}
for (const [route, ids] of Object.entries(expected)) {
  const entry = routes.get(route)
  assert.ok(entry?.piProvider, `${route} provider`)
  assert.equal(entry.catalogError, undefined)
  assert.equal(entry.modelErrors.size, 0)
  const models = entry.piProvider.getModels()
  assert.deepEqual(models.map(model => model.id), ids)
  if (route === 'openai') {
    for (const model of models) {
      assert.equal(model.api, 'openai-responses')
      assert.equal(model.contextWindow, 1050000)
      assert.equal(model.maxTokens, 128000)
      assert.deepEqual(model.input, ['text', 'image'])
      if (model.id !== 'gpt-6-astra') {
        assert.equal(model.thinkingLevelMap.off, 'none')
        assert.equal(model.thinkingLevelMap.minimal, null)
      }
    }
  }
}
console.log('Curated adapter catalog: 4 Kimi and 3 OpenAI models verified')
"""


def verify():
    with tempfile.TemporaryDirectory(prefix="patze-curated-models-") as temp:
        home = Path(temp) / "dsh"
        env = {**os.environ, "DSH_HOME": str(home), "PATZE_ROOT": str(ROOT), "DSH_TELEMETRY_DISABLED": "1"}
        web = home / "profiles/web"
        web.mkdir(parents=True)
        sentinel = web / "keep-existing-settings"
        sentinel.write_text("unchanged", encoding="utf8")
        subprocess.run(("node", "scripts/init_curated_models.mjs"), cwd=ROOT, env=env, check=True)
        patch = home / "profiles/patze-curated/cordis.patch.yml"
        assert patch.read_bytes() == (ROOT / "config/curated-models.patch.yml").read_bytes()
        retry = subprocess.run(("node", "scripts/init_curated_models.mjs"), cwd=ROOT, env=env, capture_output=True)
        assert retry.returncode != 0 and b"Profile already exists" in retry.stderr
        assert patch.read_bytes() == (ROOT / "config/curated-models.patch.yml").read_bytes()
        assert sentinel.read_text(encoding="utf8") == "unchanged"
        dump = subprocess.run(("pnpm", "dsh", "--profile", "patze-curated", "--patch",
                               str(ROOT / "config/cordis.yml"), "--dump-config"),
                              cwd=ROOT / "engine/deepseek-harness", env=env,
                              capture_output=True, text=True, check=True).stdout
        for model in ("kimi-k2.6", "kimi-k2.7-code", "kimi-k2.7-code-highspeed",
                      "kimi-k3", "gpt-6-astra", "gpt-6-sol", "gpt-6-luna"):
            assert model in dump
        assert "patze-core" in dump
        subprocess.run(("node", "--import", "tsx/esm", "--input-type=module", "-"),
                       cwd=ADAPTER, env=env, input=VERIFY, text=True, check=True)


if __name__ == "__main__":
    verify()
