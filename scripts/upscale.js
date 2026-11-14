// Upscale a green-screen sprite sheet 3× with ESRGAN (UpscalerJS esrgan-thick weights).
//
//   mkdir /tmp/sr && cd /tmp/sr && npm i @tensorflow/tfjs-node@4.22.0 @upscalerjs/esrgan-thick
//   NODE_PATH=/tmp/sr/node_modules node scripts/upscale.js in.png out.png
//   python3 scripts/chroma_key.py out.png assets/sprite-desk-vN.webp
//
// Reads and writes PNG through Python/Pillow (raw RGB in between) so no image package is needed.
// The input is padded with backdrop green first: the model invents junk on the image's own edge,
// and that junk would otherwise survive the chroma key as specks touching the cell borders.
"use strict";

const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const tf = require("@tensorflow/tfjs-node");

const SCALE = 3;
const TILE = 160;
const OVERLAP = 12;
const PAD = 8;

class MultiplyBeta extends tf.layers.Layer {
  constructor() { super({}); this.beta = 0.2; }
  call(inputs) { return tf.mul(Array.isArray(inputs) ? inputs[0] : inputs, this.beta); }
  static get className() { return "MultiplyBeta"; }
}
class PixelShuffle3x extends tf.layers.Layer {
  constructor() { super({}); }
  computeOutputShape(shape) { return [shape[0], shape[1], shape[2], 3]; }
  call(inputs) { return tf.depthToSpace(Array.isArray(inputs) ? inputs[0] : inputs, SCALE, "NHWC"); }
  static get className() { return "PixelShuffle3x"; }
}
tf.serialization.registerClass(MultiplyBeta);
tf.serialization.registerClass(PixelShuffle3x);

const py = (code, ...args) => execFileSync("python3", ["-c", code, ...args], { encoding: "utf8" }).trim();

async function main() {
  const [src, out] = process.argv.slice(2);
  if (!src || !out) throw new Error("usage: node scripts/upscale.js IN.png OUT.png");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "upscale-"));
  const rawIn = path.join(tmp, "in.rgb");
  const rawOut = path.join(tmp, "out.rgb");
  const [W, H] = py(
    "import sys; from PIL import Image\n" +
    "im = Image.open(sys.argv[1]).convert('RGB')\n" +
    `p = Image.new('RGB', (im.width + ${2 * PAD}, im.height + ${2 * PAD}), (4, 248, 4)); p.paste(im, (${PAD}, ${PAD}))\n` +
    "open(sys.argv[2], 'wb').write(p.tobytes()); print(p.width, p.height)",
    src, rawIn,
  ).split(" ").map(Number);

  // The package's "exports" hide its weights from require.resolve, so look in node_modules directly.
  const modelPath = (process.env.NODE_PATH || "").split(path.delimiter).concat(module.paths)
    .filter(Boolean)
    .map((dir) => path.join(dir, "@upscalerjs", "esrgan-thick", "models", "x3", "model.json"))
    .find((file) => fs.existsSync(file));
  if (!modelPath) throw new Error("@upscalerjs/esrgan-thick is not installed (set NODE_PATH)");
  const model = await tf.loadLayersModel(`file://${modelPath}`);
  const input = tf.tensor3d(new Uint8Array(fs.readFileSync(rawIn)), [H, W, 3], "int32").toFloat().div(255);
  const result = new Uint8Array(W * SCALE * H * SCALE * 3);

  for (let y = 0; y < H; y += TILE) {
    for (let x = 0; x < W; x += TILE) {
      const x0 = Math.max(0, x - OVERLAP), y0 = Math.max(0, y - OVERLAP);
      const x1 = Math.min(W, x + TILE + OVERLAP), y1 = Math.min(H, y + TILE + OVERLAP);
      const tile = tf.tidy(() => model.predict(input.slice([y0, x0, 0], [y1 - y0, x1 - x0, 3]).expandDims(0))
        .squeeze().clipByValue(0, 1).mul(255).round().toInt());
      const data = await tile.data();
      tile.dispose();
      const rowWidth = (x1 - x0) * SCALE;
      const ox = (x - x0) * SCALE, oy = (y - y0) * SCALE;
      const tw = Math.min(TILE, W - x) * SCALE, th = Math.min(TILE, H - y) * SCALE;
      for (let r = 0; r < th; r++) {
        const from = ((oy + r) * rowWidth + ox) * 3;
        result.set(data.subarray(from, from + tw * 3), ((y * SCALE + r) * W * SCALE + x * SCALE) * 3);
      }
    }
    process.stdout.write(`\rrows ${Math.min(H, y + TILE)}/${H}`);
  }
  fs.writeFileSync(rawOut, result);
  const cut = PAD * SCALE;
  py(
    "import sys; from PIL import Image\n" +
    `im = Image.frombytes('RGB', (${W * SCALE}, ${H * SCALE}), open(sys.argv[1], 'rb').read())\n` +
    `im.crop((${cut}, ${cut}, ${(W - PAD) * SCALE}, ${(H - PAD) * SCALE})).save(sys.argv[2])`,
    rawOut, out,
  );
  fs.rmSync(tmp, { recursive: true });
  console.log(`\n${out}: ${(W - 2 * PAD) * SCALE}x${(H - 2 * PAD) * SCALE}`);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
