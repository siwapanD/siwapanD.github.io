// Site settings.
//
// SPRITE_VERSION picks a key from SPRITES below. It is only the default: when the repository
// variable SPRITE_VERSION is set (Settings → Secrets and variables → Actions → Variables), the
// "Deploy site" workflow writes that value here before publishing. To try another version without
// editing anything, add ?sprite=<key> to the page URL, for example https://siwapand.github.io/?sprite=v1
//
// To add a sheet, put the image in assets/ and add an entry to SPRITES:
//   src       image path; must be a grid of cols × rows equal cells
//   cols/rows grid size
//   fps       starting playback speed
//   still     frame to show when the visitor prefers reduced motion
//   segments  play in order; only the last one may loop
//   alt       description for screen readers
//   desc      one line shown on sprite.html
"use strict";

window.SITE_ENV = {
  SPRITE_VERSION: "v6",
};

window.SPRITES = {
  v1: {
    src: "assets/sprite-desk.webp",
    cols: 8,
    rows: 2,
    fps: 8,
    still: 12,
    segments: [
      { name: "เดินเข้าโต๊ะ", from: 0, to: 7, loop: false },
      { name: "เตรียมพิมพ์", from: 8, to: 9, loop: false },
      { name: "พิมพ์งาน (วน)", from: 10, to: 15, loop: true },
    ],
    alt: "ภาพเจ้าของเว็บไซต์ในชุดสูทเดินเข้ามาที่โต๊ะปรับระดับแล้วพิมพ์งานบน MacBook",
    desc: "ยืน: เดินเข้าโต๊ะ (0–7) → เตรียมพิมพ์ (8–9) → พิมพ์วนซ้ำ (10–15)",
  },
  v2: {
    src: "assets/sprite-desk-v2.webp",
    cols: 8,
    rows: 2,
    fps: 8,
    still: 0,
    segments: [{ name: "นั่งพิมพ์งาน (วน)", from: 0, to: 15, loop: true }],
    alt: "ภาพเจ้าของเว็บไซต์นั่งเก้าอี้หันหลัง พิมพ์งานหน้าจอโค้งที่แสดง Music, Code และ Claude แล้วหันมองจอซ้ายและขวา",
    desc: "นั่ง: พิมพ์งาน หันมองจอซ้าย-ขวา วนทั้ง 16 เฟรม (0–15)",
  },
  v3: {
    src: "assets/sprite-desk-v3.webp",
    cols: 8,
    rows: 2,
    fps: 8,
    still: 0,
    segments: [{ name: "นั่งพิมพ์งาน (วน)", from: 0, to: 15, loop: true }],
    alt: "ภาพเจ้าของเว็บไซต์ในชุดสูทนั่งเก้าอี้ทำงาน พิมพ์งานหน้าจอโค้งที่แสดง Music, Code และ Claude แล้วหันมองหน้าจอ",
    desc: "นั่งมุมข้างหลัง พื้นเขียวลบแล้ว: พิมพ์งานและหันมองจอ วนทั้ง 16 เฟรม (0–15)",
  },
  v4: {
    src: "assets/sprite-desk-v4.webp",
    cols: 8,
    rows: 2,
    fps: 8,
    still: 0,
    segments: [{ name: "นั่งพิมพ์งาน (วน)", from: 0, to: 15, loop: true }],
    alt: "ภาพเจ้าของเว็บไซต์ในชุดสูทนั่งเก้าอี้ทำงาน พิมพ์งานหน้าจอโค้งที่แสดง Music, Code และ Claude แล้วหันมองหน้าจอ",
    desc: "v3 ขยาย 3 เท่าด้วย AI (ESRGAN) แล้วลบพื้นเขียว: เฟรมละ 750×999",
  },
  v5: {
    src: "assets/sprite-desk-v5.webp",
    cols: 8,
    rows: 2,
    fps: 8,
    still: 12,
    segments: [
      { name: "เดินเข้าโต๊ะ", from: 0, to: 7, loop: false },
      { name: "เตรียมพิมพ์", from: 8, to: 9, loop: false },
      { name: "พิมพ์งาน (วน)", from: 10, to: 15, loop: true },
    ],
    alt: "ภาพเจ้าของเว็บไซต์ในชุดสูทเดินเข้ามาที่โต๊ะปรับระดับแล้วยืนพิมพ์งานบน MacBook",
    desc: "ยืน: เดินเข้าโต๊ะ (0–7) → เตรียมพิมพ์ (8–9) → พิมพ์วนซ้ำ (10–15) · จัดโต๊ะให้ตรงทุกเฟรมและขยาย 3 เท่า",
  },
  v6: {
    src: "assets/sprite-desk-v6.webp?v=2",
    cols: 8,
    rows: 2,
    fps: 8,
    still: 12,
    segments: [
      { name: "เดินเข้าโต๊ะ", from: 0, to: 7, loop: false },
      { name: "เตรียมพิมพ์", from: 8, to: 9, loop: false },
      { name: "พิมพ์งาน (วน)", from: 10, to: 15, loop: true },
    ],
    alt: "ภาพเจ้าของเว็บไซต์ในชุดสูทเดินเข้ามาที่โต๊ะปรับระดับแล้วยืนพิมพ์งานบน MacBook",
    desc: "ยืน: สร้างทีละเฟรม 1200×1600 โต๊ะชั้นเดียวกันทุกเฟรม คนอยู่หลังโต๊ะ · เดินเข้าโต๊ะ (0–7) → เตรียมพิมพ์ (8–9) → พิมพ์วนซ้ำ (10–15)",
  },
};

// The version to use on this page: ?sprite=<key> if that key exists, else SPRITE_VERSION.
window.spriteVersion = function spriteVersion() {
  const asked = new URLSearchParams(location.search).get("sprite");
  if (asked && Object.hasOwn(window.SPRITES, asked)) return asked;
  if (Object.hasOwn(window.SPRITES, window.SITE_ENV.SPRITE_VERSION)) return window.SITE_ENV.SPRITE_VERSION;
  return Object.keys(window.SPRITES)[0];
};
