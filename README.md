# siwapanD.github.io

เว็บโปรไฟล์ที่ https://siwapand.github.io เป็นไฟล์ static ล้วน ไม่มีขั้นตอน build

```bash
python3 scripts/build_data.py     # ดึงข้อมูลใหม่จาก GitHub ผ่าน gh CLI
python3 -m http.server 8000       # ดูตัวอย่างที่ http://localhost:8000
```

- `data/profile.json` สร้างจากสคริปต์ ห้ามแก้เอง private repo จะมีแค่ตัวเลขรวม
- `data/private-overview.json` สรุปหมวด private repo เขียนเอง และเผยแพร่สู่สาธารณะ ห้ามใส่ชื่อ repo หรือชื่อลูกค้า
- `scripts/public_notes.json` คำอธิบาย public repo และรายการที่ซ่อน

ถ้าต้องการให้อัปเดตทุกวัน ให้ตั้ง secret `PROFILE_TOKEN` เป็น classic token ที่มีสิทธิ์ `repo`
