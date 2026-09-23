#!/usr/bin/env python3
"""Boot Patze on an isolated Harness home and verify the authenticated Web UI."""

import os
import re
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENGINE = ROOT / "engine/deepseek-harness"
MARKERS = (
    "Initialized Patze Autonomous Agent Platform",
    "Jev System 1 Decision, Tool Router & Proof Watcher online",
    "Registered xAI Imagine Suite",
)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def smoke():
    if (ENGINE / ".env").exists():
        raise RuntimeError("Engine .env must be absent for the isolated smoke test")
    with tempfile.TemporaryDirectory(prefix="patze-engine-smoke-") as temp:
        home = Path(temp)
        log_path = home / "boot.log"
        env = {
            "PATH": os.environ["PATH"],
            "HOME": str(home),
            "DSH_HOME": str(home / "dsh"),
            "DSH_AGENTS_HOME": str(ROOT / ".agents"),
            "DSH_TELEMETRY_DISABLED": "1",
            "NO_COLOR": "1",
        }
        command = (
            "node", "--import", "tsx/esm", "apps/cli/src/bin.ts",
            "--profile", "web", "--patch", str(ROOT / "config/cordis.yml"),
            "--host", "127.0.0.1", "--port", "0", "--no-open",
        )
        with log_path.open("w") as log:
            process = subprocess.Popen(command, cwd=ENGINE, env=env, stdout=log, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 180
                login_url = None
                while time.monotonic() < deadline and process.poll() is None:
                    output = re.sub(r"\x1b\[[0-9;]*m", "", log_path.read_text(errors="replace"))
                    match = re.search(r"dsh web:\s+(http://127\.0\.0\.1:\d+/\?token=[^\s]+)", output)
                    if match:
                        login_url = match.group(1)
                        break
                    time.sleep(1)

                output = re.sub(r"\x1b\[[0-9;]*m", "", log_path.read_text(errors="replace"))
                if login_url is None or not all(marker in output for marker in MARKERS):
                    raise RuntimeError("Patze Web startup or plugin registration was not observed")

                opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect)
                try:
                    opener.open(login_url, timeout=5)
                except urllib.error.HTTPError as response:
                    if response.code != 303:
                        raise RuntimeError(f"Web login returned HTTP {response.code}") from response
                    cookie = response.headers.get("Set-Cookie", "").split(";", 1)[0]
                else:
                    raise RuntimeError("Web login did not redirect")
                if not cookie:
                    raise RuntimeError("Web login did not set a cookie")

                request = urllib.request.Request(login_url.split("?", 1)[0], headers={"Cookie": cookie})
                with opener.open(request, timeout=5) as response:
                    if response.status != 200:
                        raise RuntimeError(f"Authenticated Web returned HTTP {response.status}")
                print("Patze core, Jev, Imagine, and authenticated Web: verified")
            finally:
                if process.poll() is None:
                    process.terminate()
                    try:
                        process.wait(timeout=10)
                    except subprocess.TimeoutExpired:
                        process.kill()
                        process.wait(timeout=5)


if __name__ == "__main__":
    smoke()
