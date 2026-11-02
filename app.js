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

const MOTION = document.documentElement.classList.contains("motion");

function ringPath(cx, cy, radius, ring) {
  let d = "";
  for (let step = 0; step <= 120; step++) {
    const t = (step / 120) * Math.PI * 2;
    const wobble =
      1 + 0.13 * Math.sin(3 * t + 0.6 + ring * 0.05) + 0.07 * Math.sin(5 * t + ring * 0.21) + 0.03 * Math.sin(9 * t - ring * 0.3);
    d += `${step ? "L" : "M"}${(cx + radius * wobble * 1.25 * Math.cos(t)).toFixed(1)} ${(cy + radius * wobble * Math.sin(t)).toFixed(1)}`;
  }
  return `${d}Z`;
}

// The contour rings radiate from the mascot, as if it were standing in water.
const contourCenter = { x: 0, y: 0, base: 0 };

function drawContours() {
  const svg = $("contours");
  const box = svg.getBoundingClientRect();
  const mascot = $("mascot").getBoundingClientRect();
  const { x: cx, y: cy, base } = Object.assign(contourCenter, {
    x: mascot.left + mascot.width / 2 - box.left,
    y: mascot.top + mascot.height * 0.62 - box.top,
    base: mascot.width * 0.5,
  });
  svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
  const paths = [];
  for (let ring = 1; ring <= 16; ring++) {
    paths.push(`<path d="${ringPath(cx, cy, base + ring * 40, ring)}" fill="none" stroke="currentColor" stroke-width="1"/>`);
  }
  svg.innerHTML = `<g id="rings-move"><g id="rings" style="transform-origin:${cx}px ${cy}px">${paths.join("")}</g></g>`;
}

function ripple() {
  if (!MOTION) return;
  const { x, y, base } = contourCenter;
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("class", "ripple");
  path.setAttribute("d", ringPath(x, y, base, 3));
  path.style.transformOrigin = `${x}px ${y}px`;
  path.addEventListener("animationend", () => path.remove());
  $("contours").append(path);
}

function wireMascot(data) {
  const SLEEP_AFTER = 20000;
  const mascot = $("mascot");
  const bubble = $("mascot-bubble");
  const squish = $("m-squish");
  const parts = { tilt: $("m-tilt"), face: $("m-face"), pupils: $("m-pupils") };
  const target = { x: 0, y: 0 };
  const look = { x: 0, y: 0 };
  let running = false;
  let sleepTimer;
  let stateTimer;
  let bubbleTimer;
  let clicks = 0;

  const apply = () => {
    parts.tilt.setAttribute("transform", `rotate(${(look.x * 5).toFixed(2)} 100 208)`);
    parts.face.setAttribute("transform", `translate(${(look.x * 13).toFixed(2)} ${(look.y * 9).toFixed(2)})`);
    parts.pupils.setAttribute("transform", `translate(${(look.x * 7).toFixed(2)} ${(look.y * 6).toFixed(2)})`);
    if (MOTION) $("rings-move")?.setAttribute("transform", `translate(${(look.x * -10).toFixed(2)} ${(look.y * -6).toFixed(2)})`);
  };
  const frame = () => {
    const ease = MOTION ? 0.13 : 1;
    look.x += (target.x - look.x) * ease;
    look.y += (target.y - look.y) * ease;
    apply();
    if (Math.abs(target.x - look.x) + Math.abs(target.y - look.y) > 0.002) requestAnimationFrame(frame);
    else running = false;
  };
  const lookAt = (clientX, clientY) => {
    const box = mascot.getBoundingClientRect();
    const dx = clientX - (box.left + box.width / 2);
    const dy = clientY - (box.top + box.height * 0.6);
    const distance = Math.hypot(dx, dy);
    const strength = distance < 24 ? 0 : Math.min(1, distance / 280);
    target.x = distance ? (dx / distance) * strength : 0;
    target.y = distance ? (dy / distance) * strength : 0;
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  };

  const setState = (state, duration) => {
    clearTimeout(stateTimer);
    // Re-entering a state restarts its one-shot animations.
    mascot.dataset.state = "idle";
    void mascot.getBoundingClientRect();
    mascot.dataset.state = state;
    if (duration) stateTimer = setTimeout(() => (mascot.dataset.state = "idle"), duration);
  };
  const say = (text, duration = 2600) => {
    clearTimeout(bubbleTimer);
    bubble.textContent = text;
    bubble.classList.add("show");
    bubbleTimer = setTimeout(() => bubble.classList.remove("show"), duration);
  };
  const wake = () => {
    clearTimeout(sleepTimer);
    if (mascot.dataset.state === "sleep") setState("surprised", 700);
    sleepTimer = setTimeout(() => {
      target.x = 0;
      target.y = 0.25;
      if (!running) {
        running = true;
        requestAnimationFrame(frame);
      }
      setState("sleep");
    }, SLEEP_AFTER);
  };
  const blink = () => {
    setTimeout(() => {
      if (mascot.dataset.state === "idle") {
        mascot.classList.add("blink");
        setTimeout(() => mascot.classList.remove("blink"), 130);
      }
      blink();
    }, 2400 + Math.random() * 3600);
  };

  const lines = [
    `มี ${fmt(data.counts.private)} โปรเจกต์ private นะ`,
    `12 เดือนนี้ ${fmt(data.contributions.latest.total)} contributions`,
    `ภาษาที่ใช้มากสุดคือ ${data.languages[0][0]}`,
    "ถนัด Linux, Docker, Cloudflare, DNS และ GIS",
    "ลองกดสลับธีมดูสิ",
  ];
  mascot.addEventListener("click", () => {
    wake();
    setState(clicks % 3 === 2 ? "surprised" : "happy", 1500);
    say(lines[clicks % lines.length]);
    clicks++;
    squish.classList.remove("go");
    void squish.getBoundingClientRect();
    squish.classList.add("go");
    ripple();
  });
  squish.addEventListener("animationend", () => squish.classList.remove("go"));
  addEventListener("pointermove", (e) => {
    wake();
    lookAt(e.clientX, e.clientY);
  }, { passive: true });
  addEventListener("pointerdown", (e) => {
    wake();
    lookAt(e.clientX, e.clientY);
  }, { passive: true });
  addEventListener("scroll", wake, { passive: true });
  addEventListener("keydown", wake);

  wake();
  if (MOTION) blink();
  setTimeout(() => {
    if (!clicks) say("สวัสดี! กดฉันดูสิ");
  }, 900);
}

function wireHeroPause() {
  if (!MOTION) return;
  new IntersectionObserver(([entry]) => {
    document.querySelector(".hero").classList.toggle("off", !entry.isIntersecting);
  }).observe(document.querySelector(".hero"));
}

function countUp() {
  if (!MOTION) return;
  document.querySelectorAll("#stats dd").forEach((dd) => {
    const node = dd.firstChild;
    const final = node.textContent;
    const end = Number(final.replaceAll(",", ""));
    const started = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - started) / 1100);
      node.textContent = t < 1 ? fmt(Math.round(end * (1 - (1 - t) ** 3))) : final;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
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
    ".hero-copy > *", ".stats", "main h2", ".contact p", ".contact .links", "main .section-note", ".skills article", ".also", ".stack h3",
    ".stack-group", ".infra-lede", ".infra-item", ".infra-links", ".impact-item", ".service-item", ".segments", ".heat-scroll", ".heat-foot", ".table-view", ".p-row", ".card", "#public details",
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
    ["Private projects", data.counts.private, `อัปเดตใน 90 วันล่าสุด ${data.counts.privateActive90d} โปรเจกต์`],
    ["Public projects", data.counts.publicShown, "repo ของตัวเอง ไม่นับ fork"],
    ["Contributions 12 เดือน", fmt(c.total), `อยู่ใน private repo ${fmt(c.private)} ครั้ง`],
    ["วันที่มี contributions", fmt(data.contributions.activeDays), `ติดต่อกันนานสุด ${data.contributions.longestStreak} วัน`],
  ];
  $("stats").append(
    ...items.map(([label, value, sub]) =>
      el("div", {}, el("dt", { textContent: label }), el("dd", {}, String(value), el("span", { className: "sub-stat", textContent: sub })))
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

function renderPrivate(data) {
  const { private: total, privateActive90d, privateByAccount, privateComplete } = data.counts;
  $("private-note").textContent = `${total} โปรเจกต์ อัปเดตใน 90 วันล่าสุด ${privateActive90d} โปรเจกต์ โค้ดและชื่อโปรเจกต์ไม่เปิดเผย จึงสรุปเป็นหมวดงาน ตัวเลขนับจาก @siwapanD ${privateByAccount.siwapanD} และ @KhunchayNe ${privateByAccount.KhunchayNe}${privateComplete ? "" : " เฉพาะ repo ที่บัญชีหลักเข้าถึงได้"}`;
  $("private-list").append(
    ...data.private.categories.map((cat) =>
      el("div", { className: `p-row${cat.stack.length ? "" : " muted"}` },
        el("div", { className: "p-count", textContent: cat.count }),
        el("div", {},
          el("h3", { textContent: cat.title }),
          el("p", { textContent: cat.summary }),
          cat.stack.length ? el("p", { className: "tags", textContent: cat.stack.join(" · ") }) : null))
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
      el("article", { className: "card" },
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
  const system = matchMedia("(prefers-color-scheme: dark)");
  const current = () => root.dataset.theme || (system.matches ? "dark" : "light");
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
  system.addEventListener("change", sync);
  sync();
}

function wireNav() {
  const nav = $("topnav-links");
  const links = new Map([...nav.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a]));
  const activate = (id) => {
    links.forEach((a) => a.removeAttribute("aria-current"));
    const active = links.get(id);
    if (!active) return;
    active.setAttribute("aria-current", "true");
    // Keep the active link visible in the phone's scrolling menu, without moving the page.
    nav.scrollTo({ left: active.offsetLeft - nav.offsetLeft - 8, behavior: MOTION ? "smooth" : "auto" });
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) activate(entry.target.id);
    });
  }, { rootMargin: "-35% 0px -60% 0px" });
  links.forEach((_, id) => observer.observe($(id)));
  observer.observe($("top"));
  // The last section is too short to reach the observed band, so the page end selects it.
  addEventListener("scroll", () => {
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) activate("contact");
  }, { passive: true });
}

async function main() {
  wireThemeToggle();
  wireNav();
  drawContours();
  const response = await fetch("data/profile.json");
  const data = await response.json();
  renderStats(data);
  renderActivity(data);
  renderPrivate(data);
  renderPublic(data);
  $("updated").textContent = `ข้อมูลจาก GitHub ณ ${dayLabel(data.generatedAt)}`;
  drawContours();
  wireMascot(data);
  wireHeroPause();
  countUp();
  reveal();
  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawContours, 150);
  });
}

main().catch((error) => {
  console.error(error);
  $("updated").textContent = "โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้าอีกครั้ง";
});
