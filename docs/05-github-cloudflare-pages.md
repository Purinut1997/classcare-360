# GitHub + Cloudflare Pages Workflow

เป้าหมายของโปรเจกต์นี้คือให้ GitHub เป็นที่ดูแล source code และให้ Cloudflare Pages เป็นเว็บ production หลักของ ClassCare 360

## โครงทางที่ต้องใช้

1. Local workspace นี้เป็นต้นทางแก้โค้ด
2. Push โค้ดขึ้น GitHub repository
3. Cloudflare Pages เชื่อมกับ GitHub repository
4. ทุกครั้งที่ push branch `main` Cloudflare จะ build และ deploy เว็บใหม่

## ค่า Cloudflare Pages

เลือก Framework preset เป็น `Vite` หรือใส่เองตามนี้:

```text
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
```

Environment variables ฝั่ง Cloudflare Pages ต้องตั้งเฉพาะค่า public browser-safe:

```text
VITE_SUPABASE_URL=https://lxsvssszqrtlorcffdhm.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
VITE_APP_NAME=ClassCare 360
VITE_APP_TIMEZONE=Asia/Bangkok
```

ห้ามใส่ secret ฝั่ง browser เช่น:

```text
SUPABASE_SERVICE_ROLE_KEY
TELEGRAM_BOT_TOKEN
LINE_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET
GOOGLE_DRIVE_CLIENT_SECRET
ENCRYPTION_KEY
```

## GitHub repository

ถ้าใช้ GitHub CLI:

```bash
gh auth login
gh repo create classcare-360 --private --source=. --remote=github --push
```

ถ้าสร้าง repo จากหน้าเว็บ GitHub:

```bash
git remote rename origin sites-backup
git remote add origin https://github.com/<your-username>/classcare-360.git
git push -u origin main
```

ถ้าต้องเก็บ remote เดิมของ Sites ไว้ด้วย ให้ใช้ชื่อ `sites-backup` ตามตัวอย่างด้านบน

## Cloudflare Pages setup

1. เข้า Cloudflare Dashboard
2. ไปที่ Workers & Pages
3. Create application
4. Pages
5. Import an existing Git repository
6. เลือก GitHub repo `classcare-360`
7. ตั้งค่า build ตามหัวข้อด้านบน
8. เพิ่ม Environment variables
9. Save and Deploy

## Supabase Auth redirects

หลังได้ Cloudflare Pages URL แล้ว ให้เพิ่มใน Supabase Authentication > URL Configuration:

```text
Site URL:
https://<cloudflare-pages-domain>

Redirect URLs:
https://<cloudflare-pages-domain>/auth/complete-profile
https://<cloudflare-pages-domain>/app/select-workspace
https://<cloudflare-pages-domain>/app/dashboard
```

## วิธีอัปเดทระบบหลังจากนี้

```bash
git status
git add .
git commit -m "Describe the change"
git push origin main
```

Cloudflare Pages จะ deploy อัตโนมัติจาก GitHub เมื่อ push สำเร็จ
