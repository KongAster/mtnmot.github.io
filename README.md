
# Maintenance Service Center System

ระบบทะเบียนแจ้งซ่อมและบริหารจัดการงานบำรุงรักษา (Maintenance Registry)

## 🛠 Tech Stack
- **Framework:** React + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL) + Dexie.js (Offline Fallback)
- **Charts:** Recharts
- **Export:** XLSX, jsPDF, html2canvas

## 🚀 Getting Started (สำหรับรันบนเครื่อง)

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   สร้างไฟล์ `.env` ที่ root folder และใส่ค่า Supabase Key ของคุณ:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

## 📦 How to Upload to GitHub

1. **Initialize Git**
   ```bash
   git init
   ```

2. **Add Files**
   ```bash
   git add .
   ```

3. **Commit**
   ```bash
   git commit -m "Initial commit: Maintenance System V1"
   ```

4. **Add Remote & Push**
   (สร้าง Repository บน GitHub ก่อน)
   ```bash
   git remote add origin https://github.com/your-username/your-repo-name.git
   git branch -M main
   git push -u origin main
   ```

## 🗄 Database Setup (Supabase)

ให้ไปที่ `supabase_schema.sql` และนำ Code ไปรันใน SQL Editor ของ Supabase Dashboard เพื่อสร้างตารางที่จำเป็น
