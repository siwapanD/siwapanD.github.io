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
    ".hero-copy > *", ".display-stage", ".focus", ".manifesto-text", ".stats > div", ".section-head > *", ".bento > *", ".after-note", ".slide", ".paddles",
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

const STAT_ICONS = {
  "Private projects": "lock",
  "Public projects": "globe",
  "Contributions 12 เดือน": "activity",
  "วันที่มี contributions": "calendar",
};

function renderStats(data) {
  const c = data.contributions.latest;
  const items = [
    ["Private projects", data.counts.private, `อัปเดตใน 90 วันล่าสุด ${data.counts.privateActive90d} โปรเจกต์`],
    ["Public projects", data.counts.publicShown, "repo ของตัวเอง ไม่นับ fork"],
    ["Contributions 12 เดือน", fmt(c.total), `อยู่ใน private repo ${fmt(c.private)} ครั้ง`],
    ["วันที่มี contributions", fmt(data.contributions.activeDays), `ติดต่อกันนานสุด ${data.contributions.longestStreak} วัน`],
  ];
  $("stats").append(
    ...items.map(([label, value, sub]) =>
      el("div", {}, el("dt", {}, icon(STAT_ICONS[label]), label), el("dd", {}, el("span", { className: "num", textContent: String(value) }), el("span", { className: "sub-stat", textContent: sub })))
    )
  );
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
}

main().catch((error) => {
  console.error(error);
  $("updated").textContent = "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง";
});
