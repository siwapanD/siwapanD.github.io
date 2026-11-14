// SpritePlayer: plays a fixed-grid sprite sheet on a <canvas>.
//
// Every frame is cut from the same grid cell size (naturalWidth / cols × naturalHeight / rows), so
// the desk and the person stay where the artist put them. The player never trims frames to their
// content, which would make the figure jump between frames.
//
// The animation is a list of segments that play in order. A segment with loop: true repeats
// forever, so it must be the last one.
"use strict";

class SpritePlayer {
  constructor({ canvas, image, cols, rows, segments, fps = 8, onFrame = null }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.image = image;
    this.cols = cols;
    this.rows = rows;
    this.segments = segments;
    this.fps = fps;
    this.onFrame = onFrame;
    this.debug = false;
    this.playing = false;
    this.segment = 0;
    this.frame = segments[0].from;
    this.elapsed = 0;
    this.last = 0;
    this.raf = 0;
    this.tick = this.tick.bind(this);
  }

  // Read from the decoded image, not from a hard-coded size: the sheet can be replaced by a
  // larger export without touching the code.
  get frameWidth() { return this.image.naturalWidth / this.cols; }
  get frameHeight() { return this.image.naturalHeight / this.rows; }
  get frameCount() { return this.cols * this.rows; }

  sourceRect(index) {
    return {
      x: (index % this.cols) * this.frameWidth,
      y: Math.floor(index / this.cols) * this.frameHeight,
      w: this.frameWidth,
      h: this.frameHeight,
    };
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
    this.emit();
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.emit();
  }

  restart() {
    this.segment = 0;
    this.frame = this.segments[0].from;
    this.elapsed = 0;
    this.last = 0;
    this.draw();
    this.emit();
  }

  setFps(fps) {
    this.fps = Math.max(1, Math.min(60, fps));
    this.emit();
  }

  // Debug stepping walks the raw sheet 0..15, ignoring the sequence, so every cell can be checked.
  step(delta) {
    this.pause();
    this.frame = (this.frame + delta + this.frameCount) % this.frameCount;
    const owner = this.segments.findIndex((s) => this.frame >= s.from && this.frame <= s.to);
    this.segment = owner === -1 ? 0 : owner;
    this.elapsed = 0;
    this.draw();
    this.emit();
  }

  show(index) {
    this.frame = index;
    const owner = this.segments.findIndex((s) => index >= s.from && index <= s.to);
    this.segment = owner === -1 ? 0 : owner;
    this.draw();
    this.emit();
  }

  setDebug(on) {
    this.debug = on;
    this.draw();
  }

  tick(now) {
    if (!this.playing) return;
    this.raf = requestAnimationFrame(this.tick);
    // A long gap (hidden tab, breakpoint) counts as one frame rather than fast-forwarding the
    // walk-in in a single jump.
    const delta = this.last ? Math.min(now - this.last, 250) : 0;
    this.last = now;
    this.elapsed += delta;
    const duration = 1000 / this.fps;
    let advanced = false;
    while (this.elapsed >= duration) {
      this.elapsed -= duration;
      this.advance();
      advanced = true;
    }
    if (advanced) {
      this.draw();
      this.emit();
    }
  }

  advance() {
    const seg = this.segments[this.segment];
    if (this.frame < seg.to) {
      this.frame += 1;
    } else if (seg.loop) {
      this.frame = seg.from;
    } else if (this.segment < this.segments.length - 1) {
      this.segment += 1;
      this.frame = this.segments[this.segment].from;
    }
  }

  // Match the backing store to the element's CSS size × devicePixelRatio, so the frame is not
  // scaled twice.
  resize() {
    const box = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(box.width * ratio));
    const height = Math.max(1, Math.round(box.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.draw();
  }

  // Contain-fit the cell in the canvas, centred horizontally and sitting on the bottom edge.
  destRect() {
    const { width, height } = this.canvas;
    const scale = Math.min(width / this.frameWidth, height / this.frameHeight);
    const w = this.frameWidth * scale;
    const h = this.frameHeight * scale;
    return { x: (width - w) / 2, y: height - h, w, h };
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!this.image.naturalWidth) return;
    const src = this.sourceRect(this.frame);
    const dst = this.destRect();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(this.image, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h);
    if (this.debug) this.drawDebug(src, dst);
  }

  drawDebug(src, dst) {
    const { ctx } = this;
    const ratio = window.devicePixelRatio || 1;
    ctx.save();
    ctx.lineWidth = ratio;
    ctx.strokeStyle = "#ff3b30";
    ctx.strokeRect(dst.x + ratio / 2, dst.y + ratio / 2, dst.w - ratio, dst.h - ratio);
    const label = `#${this.frame}  sx ${src.x} sy ${src.y}  ${src.w}×${src.h}`;
    ctx.font = `${12 * ratio}px ui-monospace, monospace`;
    const pad = 6 * ratio;
    const textWidth = ctx.measureText(label).width;
    ctx.fillStyle = "rgb(0 0 0 / 0.75)";
    ctx.fillRect(dst.x + pad, dst.y + pad, textWidth + pad * 2, 20 * ratio);
    ctx.fillStyle = "#fff";
    ctx.textBaseline = "middle";
    ctx.fillText(label, dst.x + pad * 2, dst.y + pad + 10 * ratio);
    ctx.restore();
  }

  emit() {
    if (this.onFrame) this.onFrame(this);
  }
}

window.SpritePlayer = SpritePlayer;
