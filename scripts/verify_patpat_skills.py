#!/usr/bin/env python3
"""Check that Patze's portable Patpat copy matches its checked-out submodule."""

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugins/patpat"
sys.path.insert(0, str(PLUGIN / "scripts"))

from update_skills import UpdateError, inventory, skill_directories, validate_copy_installation  # noqa: E402
from validate import validate_root  # noqa: E402


def verify():
    errors = validate_root(PLUGIN)
    if errors:
        raise UpdateError("invalid Patpat submodule: " + "; ".join(errors))
    source = PLUGIN / "skills"
    target = ROOT / ".agents/skills"
    skills = skill_directories(source)
    installed = validate_copy_installation(target, skills)
    names = {skill.name for skill in skills}
    if set(installed) != names:
        raise UpdateError("Patpat skill names differ from the checked-out submodule")
    for skill in skills:
        if installed[skill.name] != inventory(skill):
            raise UpdateError(f"Patpat skill differs from the checked-out submodule: {skill.name}")
    if not (target / "typesafe-ai/SKILL.md").is_file():
        raise UpdateError("Patze's typesafe-ai skill is missing")
    print(f"Patpat copy verified: {len(skills)} skills match the checked-out submodule; typesafe-ai preserved")


if __name__ == "__main__":
    try:
        verify()
    except (UpdateError, OSError) as error:
        raise SystemExit(f"Patpat skill verification failed: {error}") from error
