"""Pack separate frame images into one sprite sheet.

    python3 scripts/pack_frames.py OUT FRAME [FRAME ...] --cols 8 --cell 750x1000

Frames go left to right, top row first, in the order given. Each frame is resized to the cell
size as a whole (never trimmed to its content), so anything that stays put across frames, like
the desk, stays put in the sheet. All frames must share one size and aspect ratio. Alpha is kept.
"""

import argparse

from PIL import Image

p = argparse.ArgumentParser()
p.add_argument("out")
p.add_argument("frames", nargs="+")
p.add_argument("--cols", type=int, default=8)
p.add_argument("--cell", default="750x1000", help="WIDTHxHEIGHT of each cell")
args = p.parse_args()

cw, ch = (int(n) for n in args.cell.lower().split("x"))
images = [Image.open(f).convert("RGBA") for f in args.frames]
sizes = {im.size for im in images}
if len(sizes) != 1:
    raise SystemExit(f"frames differ in size: {sorted(sizes)}")
(fw, fh), = sizes
if abs(fw / fh - cw / ch) > 0.002:
    raise SystemExit(f"frame aspect {fw}x{fh} does not match cell {cw}x{ch}; refusing to stretch")

rows = -(-len(images) // args.cols)
sheet = Image.new("RGBA", (cw * args.cols, ch * rows), (0, 0, 0, 0))
for i, im in enumerate(images):
    if im.size != (cw, ch):
        im = im.resize((cw, ch), Image.LANCZOS)
    sheet.paste(im, ((i % args.cols) * cw, (i // args.cols) * ch))

if args.out.endswith(".webp"):
    sheet.save(args.out, lossless=False, quality=92, alpha_quality=100, method=6)
else:
    sheet.save(args.out, optimize=True)
print(f"{args.out}: {sheet.width}x{sheet.height}, {len(images)} frames, cells {cw}x{ch}")
