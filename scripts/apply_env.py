"""Write the sprite version chosen in the repository settings into env.js.

Run by .github/workflows/pages.yml before the site is uploaded. The version comes from
INPUT_VERSION (a manual run's input), else VAR_VERSION (the SPRITE_VERSION repository variable).
If both are empty, env.js is left as committed. An unknown version fails the build instead of
publishing a page with no figure.
"""

import os
import re
import sys

path = sys.argv[1]
version = (os.environ.get("INPUT_VERSION") or os.environ.get("VAR_VERSION") or "").strip()

with open(path, encoding="utf-8") as f:
    source = f.read()

current = re.search(r'SPRITE_VERSION: "([^"]*)"', source)
if not current:
    sys.exit(f"{path}: SPRITE_VERSION not found")

if not version:
    print(f"No setting given, keeping SPRITE_VERSION={current.group(1)} from {path}")
    sys.exit(0)

known = re.findall(r"^  ([A-Za-z0-9_-]+): \{$", source, flags=re.M)
if version not in known:
    sys.exit(f"::error::SPRITE_VERSION={version!r} is not in SPRITES ({', '.join(known)})")

source = source[: current.start(1)] + version + source[current.end(1) :]
with open(path, "w", encoding="utf-8") as f:
    f.write(source)
print(f"SPRITE_VERSION set to {version}")
