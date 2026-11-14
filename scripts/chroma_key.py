"""Turn a green-screen sprite sheet into a transparent one.

    python3 scripts/chroma_key.py IN OUT [--rows N]

Alpha comes from how much greener a pixel is than its red and blue: the flat #00FF00 backdrop
goes fully transparent, the subject stays opaque, and the edge between them is a short ramp.
Green light spilled onto the subject's edges is removed by capping green at max(red, blue).
The height is trimmed to a multiple of --rows so every grid cell is a whole number of pixels.
"""

import argparse

import numpy as np
from PIL import Image

SOLID = 40    # green excess at or below this stays opaque
CLEAR = 140   # green excess at or above this is fully transparent

parser = argparse.ArgumentParser()
parser.add_argument("src")
parser.add_argument("out")
parser.add_argument("--rows", type=int, default=2)
args = parser.parse_args()

rgb = np.asarray(Image.open(args.src).convert("RGB")).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
excess = g - np.maximum(r, b)

alpha = 1 - np.clip((excess - SOLID) / (CLEAR - SOLID), 0, 1)
spill = excess > 12
g = np.where(spill, np.minimum(g, np.maximum(r, b)), g)

out = np.dstack([r, g, b, alpha * 255]).round().clip(0, 255).astype(np.uint8)
out[alpha == 0, :3] = 0
height = out.shape[0] - out.shape[0] % args.rows
image = Image.fromarray(out[:height], "RGBA")
if args.out.endswith(".webp"):
    image.save(args.out, lossless=False, quality=92, alpha_quality=100, method=6)
else:
    image.save(args.out, optimize=True)
print(f"{args.out}: {image.size[0]}x{image.size[1]}")
