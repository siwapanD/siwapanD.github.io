const LOCALE = "th-TH-u-ca-gregory";
const fmt = (n) => n.toLocaleString("en-US");
const parseDay = (s) => new Date(`${s}T00:00:00Z`);
const dayLabel = (s) =>
  parseDay(s).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthShort = (d) => d.toLocaleDateString(LOCALE, { month: "short", timeZone: "UTC" });
const monthLong = (d) => d.toLocaleDateString(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });

// Repo descriptions come from GitHub, including other people's forks: always set as text.
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "dataset") Object.assign(node.dataset, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}
const $ = (id) => document.getElementById(id);

function icon(name, className = "icon") {
  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(svgNS, "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

const MOTION = document.documentElement.classList.contains("motion");

// The hero screen: the last 364 days as pixels, two weeks per column, oldest on the left.
function renderDisplay(data) {
  const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const ROWS = 14;
  const COLUMNS = 26;
  const latest = data.contributions.latest;
  const days = latest.days.filter((d) => d.d <= data.generatedAt).slice(-ROWS * COLUMNS);
  const pixels = $("pixels");
  pixels.append(
    ...days.map((day, i) => {
      const column = Math.floor(i / ROWS);
      return el("i", { className: "px", style: `--c:${column};--h:${Math.round(205 + (column / (COLUMNS - 1)) * 130)}`, dataset: { l: LEVELS[day.l] ?? 0 } });
    })
  );
  $("display-caption").textContent = `${fmt(latest.total)} contributions ใน 12 เดือนล่าสุด · หนึ่งจุดคือหนึ่งวัน`;
  if (!MOTION) return;
  pixels.classList.add("wait");
  requestAnimationFrame(() => pixels.classList.replace("wait", "play"));
}

// Scroll-linked effects share one rAF-throttled listener.
function wireScroll() {
  if (!MOTION) return;
  const display = $("display");
  const manifesto = $("manifesto");
  const words = [...manifesto.querySelectorAll(".w")];
  manifesto.classList.add("dimmed");
  let queued = false;
  const draw = () => {
    queued = false;
    // The screen grows to full size as it rises from the bottom edge to mid-viewport.
    const box = display.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (innerHeight - box.top) / (innerHeight * 0.6)));
    display.style.setProperty("--s", (0.88 + 0.12 * p).toFixed(4));
    display.style.setProperty("--p", p.toFixed(3));
    // Words light up one by one while the paragraph crosses the middle of the viewport.
    const text = manifesto.getBoundingClientRect();
    const start = innerHeight * 0.85;
    const end = innerHeight * 0.35;
    const read = Math.max(0, Math.min(1, (start - text.top) / (start - end + text.height * 0.6)));
    const lit = Math.round(read * words.length);
    words.forEach((word, i) => word.classList.toggle("lit", i < lit));
  };
  const request = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(draw);
  };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  draw();
}

// Thai has no spaces between words, so the paragraph is split with Intl.Segmenter.
function splitManifesto() {
  const node = $("manifesto");
  if (!MOTION || !("Segmenter" in Intl)) return;
  const text = node.textContent;
  node.replaceChildren(
    ...[...new Intl.Segmenter("th", { granularity: "word" }).segment(text)].map((part) =>
      part.isWordLike ? el("span", { className: "w", textContent: part.segment }) : part.segment
    )
  );
}

// One topic is open at a time; opening one also moves the portrait to that topic's framing.
function wireExplorer() {
  const photo = $("explorer-photo");
  const items = [...document.querySelectorAll(".explorer-item")];
  let current = -1;
  const open = (index) => {
    current = (index + items.length) % items.length;
    items.forEach((item, i) => {
      const on = i === current;
      item.classList.toggle("open", on);
      item.querySelector(".explorer-pill").setAttribute("aria-expanded", String(on));
      item.querySelector(".explorer-text").hidden = !on;
    });
    photo.style.setProperty("--origin", items[current].dataset.origin);
    photo.style.setProperty("--zoom", items[current].dataset.zoom);
  };
  items.forEach((item, i) => item.querySelector(".explorer-pill").addEventListener("click", () => open(i)));
  $("explorer-prev").addEventListener("click", () => open(current - 1));
  $("explorer-next").addEventListener("click", () => open(current + 1));
  open(0);

  // The portrait is a single photo, so "rotating" it is a 3D tilt: it leans toward the mouse, and a
  // drag (the only input on touch screens) swings it further before it springs back.
  if (!MOTION) return;
  const explorer = $("explorer");
  const figure = $("explorer-figure");
  const tilt = { rx: 0, ry: 0 };
  const target = { rx: 0, ry: 0 };
  let drag = null;
  let frameId = 0;
  const frame = () => {
    tilt.rx += (target.rx - tilt.rx) * 0.09;
    tilt.ry += (target.ry - tilt.ry) * 0.09;
    explorer.style.setProperty("--rx", tilt.rx.toFixed(2));
    explorer.style.setProperty("--ry", tilt.ry.toFixed(2));
    const settled = Math.abs(target.rx - tilt.rx) + Math.abs(target.ry - tilt.ry) < 0.02;
    frameId = settled ? 0 : requestAnimationFrame(frame);
  };
  const aim = (rx, ry) => {
    target.rx = rx;
    target.ry = ry;
    if (!frameId) frameId = requestAnimationFrame(frame);
  };
  explorer.addEventListener("pointermove", (e) => {
    if (drag) {
      aim(Math.max(-10, Math.min(10, (drag.y - e.clientY) * 0.08)), Math.max(-32, Math.min(32, (e.clientX - drag.x) * 0.22)));
    } else if (e.pointerType === "mouse") {
      const box = explorer.getBoundingClientRect();
      aim(((e.clientY - box.top) / box.height - 0.5) * -8, ((e.clientX - box.left) / box.width - 0.5) * 34);
    }
  }, { passive: true });
  explorer.addEventListener("pointerleave", () => !drag && aim(0, 0));
  figure.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY };
    figure.classList.add("dragging");
    figure.setPointerCapture(e.pointerId);
  });
  const release = () => {
    if (!drag) return;
    drag = null;
    figure.classList.remove("dragging");
    aim(0, 0);
  };
  figure.addEventListener("pointerup", release);
  figure.addEventListener("pointercancel", release);
}

function wireGallery() {
  const gallery = $("gallery");
  const prev = $("gallery-prev");
  const next = $("gallery-next");
  const step = () => gallery.querySelector(".slide").getBoundingClientRect().width + 20;
  const sync = () => {
    prev.disabled = gallery.scrollLeft <= 2;
    next.disabled = gallery.scrollLeft >= gallery.scrollWidth - gallery.clientWidth - 2;
  };
  const move = (direction) => gallery.scrollBy({ left: direction * step(), behavior: MOTION ? "smooth" : "auto" });
  prev.addEventListener("click", () => move(-1));
  next.addEventListener("click", () => move(1));
  gallery.addEventListener("scroll", sync, { passive: true });
  addEventListener("resize", sync);
  sync();
}

function countUp() {
  if (!MOTION) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      const node = entry.target;
      const final = node.textContent;
      const end = Number(final.replaceAll(",", ""));
      const started = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - started) / 1400);
        node.textContent = t < 1 ? fmt(Math.round(end * (1 - (1 - t) ** 3))) : final;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll("#stats .num").forEach((node) => observer.observe(node));
}

function reveal() {
  if (!MOTION) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("in");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -6% 0px" });
  const groups = [
    ".hero-copy > *", ".display-stage", ".focus", ".manifesto-text", ".explorer", ".numbers h2", ".stats > div", ".section-head > *", ".bento > *", ".after-note", ".slide", ".paddles",
    ".also", ".stack", ".forks",
  ];
  groups.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node, index) => {
      node.classList.add("reveal");
      node.style.setProperty("--i", Math.min(index % 6, 5));
      observer.observe(node);
    });
  });
  const heat = $("heat");
  heat.classList.add("wait");
  const heatObserver = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    heat.classList.replace("wait", "play");
    heatObserver.disconnect();
  }, { threshold: 0.2 });
  heatObserver.observe(heat);
}

function renderStats(data) {
  const c = data.contributions.latest;
  const items = [
    ["Private projects", data.counts.private, ""],
    ["Public projects ไม่นับ fork", data.counts.publicShown, ""],
    ["Contributions ใน 12 เดือน", c.total, ""],
    ["อยู่ใน private repo", c.private, " ครั้ง"],
    ["วันที่มี contributions", data.contributions.activeDays, " วัน"],
    ["ติดต่อกันนานสุด", data.contributions.longestStreak, " วัน"],
  ];
  $("stats").append(
    ...items.map(([label, value, unit]) => el("div", {}, el("dt", { textContent: label }), el("dd", {}, el("span", { className: "num", textContent: fmt(value) }), unit)))
  );
}

// Subpixels light up under a moving pointer and fade behind it. Each cell holds an energy level; blue
// responds to the least energy, so the edge of the patch and its fading trail turn blue first.
function wireSubpixels() {
  if (!MOTION) return;
  const PITCH = 10;
  const SIGMA_X = 118;
  const SIGMA_Y = 92;
  const FADE = 0.55; // seconds for energy to fall to about a third
  const section = $("numbers");
  const canvas = $("subpixels");
  const ctx = canvas.getContext("2d");
  let columns = 0;
  let rows = 0;
  let energy = new Float32Array(0);
  let scale = 1;
  // Runs on every size notification, so it only resets the grid when the size really changed.
  const resize = () => {
    const box = section.getBoundingClientRect();
    scale = Math.min(2, devicePixelRatio || 1);
    const width = Math.round(box.width * scale);
    const height = Math.round(box.height * scale);
    if (width === canvas.width && height === canvas.height) return;
    canvas.width = width;
    canvas.height = height;
    columns = Math.ceil(box.width / PITCH);
    rows = Math.ceil(box.height / PITCH);
    energy = new Float32Array(columns * rows);
    last.known = false;
  };

  // Raise cells around a point to a soft elliptical falloff; never lowers a cell.
  const stamp = (x, y, strength) => {
    const c0 = Math.max(0, Math.floor((x - SIGMA_X * 2.6) / PITCH));
    const c1 = Math.min(columns - 1, Math.ceil((x + SIGMA_X * 2.6) / PITCH));
    const r0 = Math.max(0, Math.floor((y - SIGMA_Y * 2.6) / PITCH));
    const r1 = Math.min(rows - 1, Math.ceil((y + SIGMA_Y * 2.6) / PITCH));
    for (let r = r0; r <= r1; r++) {
      const dy = (r * PITCH + PITCH / 2 - y) / SIGMA_Y;
      for (let c = c0; c <= c1; c++) {
        const dx = (c * PITCH + PITCH / 2 - x) / SIGMA_X;
        const value = strength * Math.exp(-0.5 * (dx * dx + dy * dy));
        const i = r * columns + c;
        if (value > energy[i]) energy[i] = value;
      }
    }
  };

  const ramp = (value, from, to) => {
    const t = value <= from ? 0 : value >= to ? 1 : (value - from) / (to - from);
    return t * t * (3 - 2 * t);
  };
  // [colour, x, y, width, height, energy where it starts to glow, energy where it is fully lit]
  const SUBPIXELS = [
    ["#1818f2", 0.5, 0.5, 5.6, 8.6, 0.05, 0.62],
    ["#3df05a", 6.9, 0.5, 2.7, 4.7, 0.2, 0.8],
    ["#f5302c", 6.9, 5.8, 2.7, 3.3, 0.27, 0.86],
  ];
  const ROUNDED = typeof ctx.roundRect === "function";
  const draw = () => {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, columns * PITCH, rows * PITCH);
    // A blue wash across the whole cell fills the gaps, so lit pixels bloom into each other.
    ctx.fillStyle = "#1414c8";
    for (let i = 0; i < energy.length; i++) {
      if (energy[i] <= 0.1) continue;
      ctx.globalAlpha = 0.36 * ramp(energy[i], 0.1, 1);
      ctx.fillRect((i % columns) * PITCH, Math.floor(i / columns) * PITCH, PITCH, PITCH);
    }
    for (const [colour, x, y, width, height, from, to] of SUBPIXELS) {
      ctx.fillStyle = colour;
      for (let i = 0; i < energy.length; i++) {
        if (energy[i] <= from) continue;
        ctx.globalAlpha = ramp(energy[i], from, to);
        const left = (i % columns) * PITCH + x;
        const top = Math.floor(i / columns) * PITCH + y;
        if (ROUNDED) {
          ctx.beginPath();
          ctx.roundRect(left, top, width, height, 1);
          ctx.fill();
        } else {
          ctx.fillRect(left, top, width, height);
        }
      }
    }
    ctx.globalAlpha = 1;
  };

  // The light appears only while the pointer is moving; a resting pointer lets it fade out.
  const pointer = { x: 0, y: 0, moved: false };
  const last = { x: 0, y: 0, known: false };
  let visible = false;
  let frameId = 0;
  let previous = 0;
  const frame = (now) => {
    const dt = Math.min(0.05, (now - previous) / 1000 || 0.016);
    previous = now;
    const decay = Math.exp(-dt / FADE);
    let lit = false;
    for (let i = 0; i < energy.length; i++) {
      if (energy[i] === 0) continue;
      energy[i] = energy[i] < 0.02 ? 0 : energy[i] * decay;
      lit = true;
    }
    if (pointer.moved) {
      pointer.moved = false;
      const box = section.getBoundingClientRect();
      const x = pointer.x - box.left;
      const y = pointer.y - box.top;
      // Stamp along the path since the last frame so a fast pointer leaves a continuous trail.
      const steps = last.known ? Math.min(12, Math.ceil(Math.hypot(x - last.x, y - last.y) / 24)) || 1 : 1;
      for (let step = 1; step <= steps; step++) {
        const t = step / steps;
        stamp(last.known ? last.x + (x - last.x) * t : x, last.known ? last.y + (y - last.y) * t : y, 1);
      }
      Object.assign(last, { x, y, known: true });
      lit = true;
    }
    // Schedule first: a drawing error must never leave the loop marked as running.
    frameId = visible && lit ? requestAnimationFrame(frame) : 0;
    draw();
  };
  const wake = () => {
    if (frameId || !visible) return;
    previous = performance.now();
    frameId = requestAnimationFrame(frame);
  };

  // Listens on the window and hit-tests the section, so nothing layered over it can swallow the event.
  const follow = (e) => {
    const box = section.getBoundingClientRect();
    if (e.clientY < box.top || e.clientY > box.bottom || e.clientX < box.left || e.clientX > box.right) {
      last.known = false;
      return;
    }
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.moved = true;
    wake();
  };
  addEventListener("PointerEvent" in window ? "pointermove" : "mousemove", follow, { passive: true });
  addEventListener("resize", resize);
  new ResizeObserver(resize).observe(section);
  resize();
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    wake();
  }).observe(section);
}

function renderHeat(range, today) {
  const heat = $("heat");
  const days = range.days.filter((d) => d.d <= today);
  heat.replaceChildren();

  let week = 1;
  let lastMonth = -1;
  let lastLabelWeek = -10;
  const monthly = new Map();
  days.forEach((day, i) => {
    const date = parseDay(day.d);
    const weekday = date.getUTCDay();
    if (i && weekday === 0) week++;
    heat.append(el("div", {
      className: "cell",
      style: `grid-column:${week};grid-row:${weekday + 2};--w:${week}`,
      dataset: { l: day.l, d: day.d, n: day.n },
    }));
    const key = monthLong(date);
    monthly.set(key, (monthly.get(key) || 0) + day.n);
    if (date.getUTCMonth() !== lastMonth) {
      lastMonth = date.getUTCMonth();
      // A short leading month would collide with the next label.
      if (week - lastLabelWeek >= 3 && date.getUTCDate() <= 21) {
        heat.append(el("div", { className: "month", style: `grid-column:${week} / span 3`, textContent: monthShort(date) }));
        lastLabelWeek = week;
      }
    }
  });
  [["จ", 1], ["พ", 3], ["ศ", 5]].forEach(([label, weekday]) => {
    heat.append(el("span", { className: "dow", style: `top:calc(20px + var(--gap) + ${weekday} * (var(--cell) + var(--gap)))`, textContent: label }));
  });

  const total = days.reduce((sum, d) => sum + d.n, 0);
  const active = days.filter((d) => d.n > 0).length;
  heat.setAttribute("aria-label", `มี ${fmt(total)} contributions ใน ${active} วัน ตั้งแต่ ${dayLabel(days[0].d)} ถึง ${dayLabel(days.at(-1).d)}`);
  $("heat-total").textContent = `${fmt(total)} contributions ใน ${active} วัน · อยู่ใน private repo ${fmt(range.private)} ครั้ง`;
  $("heat-table").replaceChildren(
    ...[...monthly].map(([month, n]) => el("tr", {}, el("td", { textContent: month }), el("td", { textContent: fmt(n) })))
  );
  const scroller = $("heat-scroll");
  scroller.scrollLeft = scroller.scrollWidth;
}

function wireHeatTooltip() {
  const tip = $("tip");
  const heat = $("heat");
  let current = null;
  const hide = () => {
    tip.hidden = true;
    current?.classList.remove("on");
    current = null;
  };
  const show = (cell) => {
    current?.classList.remove("on");
    current = cell;
    cell.classList.add("on");
    tip.textContent = `${dayLabel(cell.dataset.d)}: ${cell.dataset.n === "0" ? "ไม่มี contributions" : `${cell.dataset.n} contributions`}`;
    tip.hidden = false;
    const box = cell.getBoundingClientRect();
    const half = tip.offsetWidth / 2;
    const left = Math.min(innerWidth - half - 8, Math.max(half + 8, box.left + box.width / 2));
    tip.style.left = `${left - half}px`;
    tip.style.top = `${Math.max(8, box.top - tip.offsetHeight - 8)}px`;
  };
  heat.addEventListener("pointerover", (e) => e.target.classList.contains("cell") && show(e.target));
  heat.addEventListener("pointerleave", hide);
  heat.addEventListener("click", (e) => e.target.classList.contains("cell") && show(e.target));
  addEventListener("scroll", hide, { passive: true });
  $("heat-scroll").addEventListener("scroll", hide, { passive: true });
}

function renderActivity(data) {
  const { latest, years, allTime } = data.contributions;
  $("activity-note").textContent = `รวม ${fmt(allTime)} ครั้งจาก 2 บัญชี ระดับสีคำนวณใหม่จากยอดรวมต่อวัน นับรวมกิจกรรมใน private repo โดยแสดงเฉพาะจำนวน`;
  const ranges = [["12 เดือนล่าสุด", latest], ...Object.keys(years).filter((y) => years[y].total).sort().reverse().map((y) => [y, years[y]])];
  const buttons = ranges.map(([label, range], i) => {
    const button = el("button", { type: "button", textContent: label });
    button.setAttribute("aria-pressed", String(i === 0));
    button.addEventListener("click", () => {
      buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      renderHeat(range, data.generatedAt);
    });
    return button;
  });
  $("ranges").append(...buttons);
  renderHeat(latest, data.generatedAt);
  wireHeatTooltip();
}

const CATEGORY_ICONS = {
  "โครงสร้างพื้นฐานและข้อมูล": "server",
  "ระบบงานธุรกิจและองค์กร": "briefcase",
  "AI และเครื่องมือสำหรับ agent": "cpu",
  "ภูมิสารสนเทศและข้อมูลน้ำ": "map",
  "แอป native และ mobile": "phone",
  "ต้นแบบและงานทดลอง": "flask",
  "ยังไม่มีเนื้อหา": "inbox",
};

function renderPrivate(data) {
  const { private: total, privateActive90d, privateByAccount, privateComplete } = data.counts;
  $("private-note").textContent = `${total} โปรเจกต์ อัปเดตใน 90 วันล่าสุด ${privateActive90d} โปรเจกต์ โค้ดและชื่อโปรเจกต์ไม่เปิดเผย จึงสรุปเป็นหมวดงาน ตัวเลขนับจาก @siwapanD ${privateByAccount.siwapanD} และ @KhunchayNe ${privateByAccount.KhunchayNe}${privateComplete ? "" : " เฉพาะ repo ที่บัญชีหลักเข้าถึงได้"}`;
  $("private-list").append(
    ...data.private.categories.map((cat) =>
      el("div", { className: `tile p-row${cat.stack.length ? "" : " muted"}` },
        el("div", { className: "p-count", textContent: cat.count }),
        el("h3", { className: "with-icon" }, icon(CATEGORY_ICONS[cat.title] || "help", "icon icon-accent"), cat.title),
        el("p", { textContent: cat.summary }),
        cat.stack.length ? el("p", { className: "tags", textContent: cat.stack.join(" · ") }) : null)
    )
  );
}

function pushedLabel(s) {
  return `อัปเดต ${parseDay(s).toLocaleDateString(LOCALE, { month: "short", year: "numeric", timeZone: "UTC" })}`;
}

function renderPublic(data) {
  const featured = data.public.filter((p) => p.group === "featured");
  const learning = data.public.filter((p) => p.group === "learning");
  $("public-cards").append(
    ...featured.map((p) =>
      el("article", { className: "tile card" },
        el("h3", {}, el("a", { href: p.url, textContent: p.name })),
        el("p", { textContent: p.note }),
        el("div", { className: "meta", textContent: [`@${p.owner}`, p.language, pushedLabel(p.pushedAt)].filter(Boolean).join(" · ") }))
    )
  );
  $("public-note").textContent = `${data.counts.publicShown} repo จาก 2 บัญชี แสดงโปรเจกต์เด่น ${featured.length} รายการ ไม่นับ repo ว่างและ repo ตั้งค่าโปรไฟล์`;
  $("learning-summary").textContent = `ตัวอย่างและงานฝึก ${learning.length} รายการ`;
  $("public-learning").append(
    ...learning.map((p) =>
      el("li", {},
        el("a", { href: p.url, textContent: p.name }),
        el("span", { className: "desc", textContent: p.note }),
        el("span", { className: "lang", textContent: p.language || "" }))
    )
  );
  $("forks-summary").textContent = `Repo ที่ fork มา ${data.counts.forksShown} รายการ`;
  $("forks-note").textContent = `เก็บไว้ศึกษาหรือใช้ต่อ เป็นผลงานของเจ้าของต้นทาง ยกเว้นรายการที่ระบุว่ามี commit ของตัวเอง ${data.counts.forksWithOwnCommits} รายการ`;
  $("fork-list").append(
    ...data.forks.map((f) =>
      el("li", {},
        el("a", { href: f.url, textContent: f.name }),
        el("span", { className: "desc" }, f.ownCommits ? el("strong", { className: "own", textContent: "มี commit ของตัวเอง " }) : null, f.description),
        el("span", { className: "lang", textContent: f.language || "" }))
    )
  );
}

const THEME_ICONS = {
  light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11z"/></svg>',
};

function wireThemeToggle() {
  const button = $("theme-toggle");
  const root = document.documentElement;
  const current = () => (root.dataset.theme === "light" ? "light" : "dark");
  // The icon shows the theme a click switches to.
  const sync = () => {
    const next = current() === "dark" ? "light" : "dark";
    button.innerHTML = THEME_ICONS[next];
    button.setAttribute("aria-label", next === "dark" ? "เปลี่ยนเป็นโหมดมืด" : "เปลี่ยนเป็นโหมดสว่าง");
    button.title = button.getAttribute("aria-label");
  };
  button.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
    sync();
  });
  sync();
}

function wireNav() {
  const bar = $("localnav");
  const toggle = $("menu-toggle");
  const nav = $("topnav-links");
  const setOpen = (open) => {
    bar.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "ปิดเมนู" : "เปิดเมนู");
  };
  toggle.addEventListener("click", () => setOpen(!bar.classList.contains("open")));
  nav.addEventListener("click", (e) => e.target.closest("a") && setOpen(false));
  addEventListener("keydown", (e) => e.key === "Escape" && setOpen(false));

  const links = new Map([...nav.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a]));
  const activate = (id) => {
    links.forEach((a) => a.removeAttribute("aria-current"));
    links.get(id)?.setAttribute("aria-current", "true");
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) activate(entry.target.id);
    });
  }, { rootMargin: "-35% 0px -60% 0px" });
  links.forEach((_, id) => observer.observe($(id)));
  observer.observe($("top"));
}

async function main() {
  wireThemeToggle();
  wireNav();
  wireGallery();
  wireExplorer();
  splitManifesto();
  const response = await fetch("data/profile.json");
  const data = await response.json();
  renderDisplay(data);
  renderStats(data);
  renderActivity(data);
  renderPrivate(data);
  renderPublic(data);
  $("updated").textContent = `ข้อมูลจาก GitHub ณ ${dayLabel(data.generatedAt)}`;
  countUp();
  reveal();
  wireScroll();
  wireSubpixels();
}

main().catch((error) => {
  console.error(error);
  $("updated").textContent = "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง";
});
