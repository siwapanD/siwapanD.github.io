"""Rebuild animation frames from a fixed prop layer and per-frame person layers.

    python3 scripts/layer_frames.py OUT_DIR --desk desk.png --front-below Y PERSON [PERSON ...]

Each frame is stacked back to front:
  1. the whole desk;
  2. the person;
  3. the part of the desk below row Y (the tabletop's front edge, the legs and the feet), again.
So hands resting on the tabletop stay on top, while the desk's legs and front edge cover the
person standing behind it. Y is in the layers' own pixels. Frames are written as
OUT_DIR/frame-NN.png in the order the person layers are given.
"""

import argparse
import os

import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("out_dir")
p.add_argument("persons", nargs="+")
p.add_argument("--desk", required=True)
p.add_argument("--front-below", type=int, required=True, metavar="Y")
args = p.parse_args()

desk = Image.open(args.desk).convert("RGBA")
front = np.array(desk)
front[: args.front_below, :, 3] = 0
front = Image.fromarray(front, "RGBA")

os.makedirs(args.out_dir, exist_ok=True)
for i, path in enumerate(args.persons):
    person = Image.open(path).convert("RGBA")
    if person.size != desk.size:
        raise SystemExit(f"{path} is {person.size}, desk is {desk.size}")
    frame = Image.new("RGBA", desk.size, (0, 0, 0, 0))
    for layer in (desk, person, front):
        frame.alpha_composite(layer)
    out = os.path.join(args.out_dir, f"frame-{i:02d}.png")
    frame.save(out)
print(f"{len(args.persons)} frames in {args.out_dir}")
