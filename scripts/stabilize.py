"""Re-cut a sprite sheet whose cells are not evenly spaced.

    python3 scripts/stabilize.py IN OUT --cols 8 --rows 2 --ref 3 --anchor X0 Y0 X1 Y1 [--green]

Some generated sheets drift: an object that should stay put (the desk) slides a few pixels from
cell to cell. Equal cells cannot fix that, so this script:
  1. finds, for each cell, the shift (dx, dy) that best lines up the anchor box (cell-relative
     pixels around something that must not move) with the same box in the reference cell;
  2. cuts each frame from a window moved by that shift, so the anchor sits at the same pixel in
     every output cell;
  3. drops connected blobs that mostly belong to a neighbouring cell (an arm or a shoe that
     crossed the grid line), and clears faint alpha haze below --haze;
  4. writes a sheet with whole-pixel cells, transparent, or on flat green with --green so it can
     go through scripts/upscale.js and scripts/chroma_key.py.
It prints the shift per frame so the result can be checked.
"""

import argparse

import numpy as np
from PIL import Image
from scipy import ndimage

p = argparse.ArgumentParser()
p.add_argument("src")
p.add_argument("out")
p.add_argument("--cols", type=int, default=8)
p.add_argument("--rows", type=int, default=2)
p.add_argument("--ref", type=int, default=0)
p.add_argument("--anchor", type=int, nargs=4, required=True, metavar=("X0", "Y0", "X1", "Y1"))
p.add_argument("--search", type=int, default=30, help="largest shift tried, in pixels")
p.add_argument("--haze", type=int, default=16, help="alpha below this becomes 0")
p.add_argument("--green", action="store_true")
args = p.parse_args()

img = np.asarray(Image.open(args.src).convert("RGBA")).astype(np.float32)
H, W = img.shape[:2]
fw, fh = W // args.cols, H // args.rows          # output cells: whole pixels
pw, ph = W / args.cols, H / args.rows            # source pitch: may be fractional
alpha = img[..., 3] / 255
alpha[alpha < args.haze / 255] = 0

ax0, ay0, ax1, ay1 = args.anchor
S = args.search


def origin(i):
    return round((i % args.cols) * pw), round((i // args.cols) * ph)


def window(a, x, y, w, h):
    """a[y:y+h, x:x+w] with zero padding outside the image."""
    out = np.zeros((h, w) + a.shape[2:], a.dtype)
    sx0, sy0, sx1, sy1 = max(x, 0), max(y, 0), min(x + w, a.shape[1]), min(y + h, a.shape[0])
    if sx1 > sx0 and sy1 > sy0:
        out[sy0 - y:sy1 - y, sx0 - x:sx1 - x] = a[sy0:sy1, sx0:sx1]
    return out


rx, ry = origin(args.ref)
ref = window(alpha, rx + ax0, ry + ay0, ax1 - ax0, ay1 - ay0)
shifts = []
for i in range(args.cols * args.rows):
    ox, oy = origin(i)
    best = None
    for dy in range(-S // 3, S // 3 + 1):
        for dx in range(-S, S + 1):
            cand = window(alpha, ox + ax0 + dx, oy + ay0 + dy, ax1 - ax0, ay1 - ay0)
            err = float(np.abs(cand - ref).mean())
            if best is None or err < best[0]:
                best = (err, dx, dy)
    shifts.append(best)

# Every blob in the sheet, labelled once, so a blob can be traced back to the cell it belongs to.
labels, count = ndimage.label(ndimage.binary_dilation(alpha > 0, iterations=2))
centres = ndimage.center_of_mass(alpha > 0, labels, range(1, count + 1))
owner = np.zeros(count + 1, int) - 1
for k, (cy, cx) in enumerate(centres, start=1):
    if not np.isnan(cx):
        owner[k] = min(int(cy // ph), args.rows - 1) * args.cols + min(int(cx // pw), args.cols - 1)

backdrop = np.array([4, 248, 4], np.float32)
sheet = np.zeros((fh * args.rows, fw * args.cols, 4), np.float32)
for i, (err, dx, dy) in enumerate(shifts):
    ox, oy = origin(i)
    x, y = ox + dx, oy + dy
    rgb = window(img[..., :3], x, y, fw, fh)
    a = window(alpha, x, y, fw, fh)
    lab = window(labels, x, y, fw, fh)
    a = np.where((lab == 0) | (owner[lab] == i), a, 0)
    tx, ty = (i % args.cols) * fw, (i // args.cols) * fh
    sheet[ty:ty + fh, tx:tx + fw, :3] = rgb
    sheet[ty:ty + fh, tx:tx + fw, 3] = a
    print(f"frame {i:2d}: shift dx {dx:+3d} dy {dy:+3d}  anchor error {err:.3f}")

if args.green:
    a = sheet[..., 3:4]
    out = (sheet[..., :3] * a + backdrop * (1 - a)).round().clip(0, 255).astype(np.uint8)
    Image.fromarray(out, "RGB").save(args.out)
else:
    sheet[..., 3] *= 255
    Image.fromarray(sheet.round().clip(0, 255).astype(np.uint8), "RGBA").save(args.out)
print(f"{args.out}: {sheet.shape[1]}x{sheet.shape[0]}, cells {fw}x{fh}")
