# siwapanD.github.io

เว็บโปรไฟล์ที่ https://siwapand.github.io เป็นไฟล์ static ล้วน ไม่มีขั้นตอน build

```bash
python3 scripts/build_data.py     # ดึงข้อมูลใหม่จาก GitHub ผ่าน gh CLI
python3 -m http.server 8000       # ดูตัวอย่างที่ http://localhost:8000
```

- `data/profile.json` สร้างจากสคริปต์ ห้ามแก้เอง private repo จะมีแค่ตัวเลขรวม
- `data/private-overview.json` สรุปหมวด private repo เขียนเอง และเผยแพร่สู่สาธารณะ ห้ามใส่ชื่อ repo หรือชื่อลูกค้า
- `scripts/public_notes.json` คำอธิบาย public repo และรายการที่ซ่อน
- บัญชีที่รวมอยู่ในตัวแปร `ACCOUNTS` ของ `scripts/build_data.py`

ถ้าต้องการให้อัปเดตทุกวัน ให้ตั้ง secret `PROFILE_TOKEN` เป็น classic token ที่มีสิทธิ์ `repo` และตั้ง `PROFILE_TOKEN_KHUNCHAYNE` เป็น token แบบเดียวกันของบัญชี KhunchayNe

## Deploy and settings

`.github/workflows/pages.yml` publishes the site on every push to `main`.
Settings → Pages → Source must be set to **GitHub Actions**.

The About section's sprite sheet is chosen by the repository variable `SPRITE_VERSION`
(Settings → Secrets and variables → Actions → Variables), for example `v1` or `v2`.
The versions are listed in `SPRITES` in `env.js`; without the variable, `env.js` decides.
Changing the variable does not redeploy: run **Deploy site** from the Actions tab
(it also takes a one-off `sprite_version` input).

### Sprite sheets

- `scripts/pack_frames.py` packs separate frames (best: one image per frame, 600 × 800 or larger) into a sheet without trimming them.
- `scripts/chroma_key.py` turns a green-screen sheet transparent.
- `scripts/stabilize.py` re-cuts a sheet whose cells drift (an object that should stay put slides between frames).
- `scripts/upscale.js` upscales a green-screen sheet 3× with ESRGAN.
- `sprite.html` plays any version from `env.js` and checks the image: haze, cell size, frames touching cell edges, and drift.
