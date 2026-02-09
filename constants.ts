
import { Technician, BudgetItem } from './types';

// Theme Palettes matching Tailwind Shades (50, 100, 500, 600, 700, 900)
export const THEME_PALETTES: Record<string, { name: string; colors: { 50: string; 100: string; 500: string; 600: string; 700: string; 900: string } }> = {
  'INDIGO': { 
    name: 'สีคราม (Indigo - Default)', 
    colors: { 50: '#eef2ff', 100: '#e0e7ff', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 900: '#312e81' } 
  },
  'BLUE': { 
    name: 'สีน้ำเงิน (Blue)', 
    colors: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 900: '#1e3a8a' } 
  },
  'EMERALD': { 
    name: 'สีเขียว (Emerald)', 
    colors: { 50: '#ecfdf5', 100: '#d1fae5', 500: '#10b981', 600: '#059669', 700: '#047857', 900: '#064e3b' } 
  },
  'ROSE': { 
    name: 'สีแดงกุหลาบ (Rose)', 
    colors: { 50: '#fff1f2', 100: '#ffe4e6', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 900: '#881337' } 
  },
  'ORANGE': { 
    name: 'สีส้ม (Orange)', 
    colors: { 50: '#fff7ed', 100: '#ffedd5', 500: '#f97316', 600: '#ea580c', 700: '#c2410c', 900: '#7c2d12' } 
  },
  'VIOLET': { 
    name: 'สีม่วง (Violet)', 
    colors: { 50: '#f5f3ff', 100: '#ede9fe', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 900: '#4c1d95' } 
  },
  'TEAL': { 
    name: 'สีเขียวน้ำทะเล (Teal)', 
    colors: { 50: '#f0fdfa', 100: '#ccfbf1', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 900: '#134e4a' } 
  },
  'SLATE': { 
    name: 'สีเทา (Slate)', 
    colors: { 50: '#f8fafc', 100: '#f1f5f9', 500: '#64748b', 600: '#475569', 700: '#334155', 900: '#0f172a' } 
  }
};

export const DEPARTMENTS = [
  "แผนกผสมกากเชื้อเพลิงของแข็ง 1 (RDF1)",
  "แผนกผสมกากเชื้อเพลิงของแข็ง 2 (RDF2)",
  "แผนกเตรียมวัตถุดิบและ N5 (SMP)",
  "แผนกปรับปรุงคุณภาพกาก เตรียมกาก (SPE)",
  "แผนกปรับปรุงคุณภาพกาก บำบัดกาก (STA)",
  "แผนกกำจัดกากปนเปื้อน (HAZ)",
  "แผนกกำจัดกาทั่วไป (NON)",
  "แผนกระบบปรับปรุงคุณภาพน้ำ HAZ (PLH)",
  "แผนกระบบปรับปรุงคุณภาพน้ำ NON (PLN)",
  "แผนกวิชาการสิ่งแวดล้อมและความปลอดภัย (ENV)",
  "แผนกบริหารทรัพยากรบุคคล (HRM)",
  "แผนกผสมกากเชื้อเพลิงของเหลว (LBL)",
  "แผนกจัดการรถขนส่งและภาชนะบรรจุ (CON)",
  "แผนกวิศวกรรมซ่อมบำรุง (MTN)",
  "แผนกสื่อสารองค์กร (COC)",
  "แผนกปฏิบัติการ (OPE)",
  "แผนกตรวจสอบคุณภาพ (QCI)",
  "แผนกวางแผนการผลิตและขาย (PPS)",
  "แผนกโครงการพิเศษฯ (PRO)",
  "แผนกธุรการขนส่ง (ADD)",
  "แผนกซ่อมบำรุง RDF (MER)",
  "แผนกวิศวกรรมยานยนต์ (MOT)",
  "แผนกบริหารสินทรัพย์ (ASM)",
  "แผนกปฏิบัติการวิเคราะห์ (LAB)",
  "แผนกข้อมูลตรวจรับกาก (CIW)",
  "แผนกดรอส (DROSS)",
  "แผนกก่อสร้าง (CST)",
  "แผนกเทคโนโลยีสารสนเทศ (IT)",
  "แผนกวิจัยและพัฒนา (RD)"
];

export const INITIAL_TECHNICIANS: Technician[] = [
  { id: '1', firstName: 'วรพัน ธิสงค์', nickName: 'อั๋น', position: 'ช่าง', category: 'ไฟฟ้า', schedule: {} },
  { id: '2', firstName: 'สุริโย ท้วมเลี้ยง', nickName: 'โย', position: 'ช่าง', category: 'ไฟฟ้า', schedule: {} },
  { id: '3', firstName: 'ณัฐวุฒิ ศิรินุช', nickName: 'ณัฐ', position: 'ช่าง', category: 'ไฟฟ้า', schedule: {} },
  { id: '4', firstName: 'ชัยวัฒน์ สุวรรณธาดา', nickName: 'เอฟ', position: 'ช่าง', category: 'ไฟฟ้า', schedule: {} },
  { id: '5', firstName: 'เฉลิมเดช จันทวงษ์', nickName: 'รส', position: 'ช่าง', category: 'ไฟฟ้า', schedule: {} },
  { id: '6', firstName: 'ชัยวุฒิ ปลื้มสุข', nickName: 'โอ๊ต', position: 'ช่าง', category: 'ไฟฟ้า', schedule: {} },
  { id: '7', firstName: 'กฤษณะ รุกชาติ', nickName: 'โอ๊ต', position: 'ช่าง', category: 'ประปา', schedule: {} },
  { id: '8', firstName: 'ถิรวัฒน์ มีทอง', nickName: 'เบียร์', position: 'ช่าง', category: 'ประปา', schedule: {} },
  { id: '9', firstName: 'ศราวุฒิ วิจิตร', nickName: 'เบียร์', position: 'ช่าง', category: 'ไฟฟ้า', schedule: {} },
  { id: '10', firstName: 'ธวัชชัย วงษ์น้อยศรี', nickName: 'อ๊อฟ', position: 'ช่าง', category: 'ประปา', schedule: {} },
  { id: '11', firstName: 'สมบุญ สมฤทธิ์', nickName: 'บุญ', position: 'ช่าง', category: 'ยานยนต์', schedule: {} },
  { id: '12', firstName: 'รัตนพล บัวทอง', nickName: 'ยัน', position: 'ช่าง', category: 'ยานยนต์', schedule: {} },
  { id: '13', firstName: 'เกียรติศักดิ์ สมวงษ์', nickName: 'กวาง', position: 'ช่าง', category: 'ยานยนต์', schedule: {} },
  { id: '14', firstName: 'อัครพงษ์ ชานตะมะ', nickName: 'หลิว', position: 'ช่าง', category: 'ยานยนต์', schedule: {} },
  { id: '15', firstName: 'วิฑูรย์ โยธานารถ', nickName: 'โก้', position: 'หัวหน้าแผนก', schedule: {} },
  { id: '16', firstName: 'เบญมาศ แก้วเกลี้ยง', nickName: 'กระถิน', position: 'แอดมิน', schedule: {} },
  { id: '17', firstName: 'ธิดารัตน์ กรุณา', nickName: 'บิว', position: 'แอดมิน', schedule: {} },
];

// Helper to distribute budget evenly
const distribute = (total: number) => {
  const avg = Math.floor(total / 12);
  const rem = total % 12;
  const arr = Array(12).fill(avg);
  arr[11] += rem;
  return arr;
};

// Initial Budget Data for Year 2569
export const INITIAL_BUDGETS_2569: BudgetItem[] = [
  // หมวด 1
  { id: 'seed-1-1', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.1', name: 'ค่าบำรุงรักษาและซ่อมแซมเครื่องมือ เครื่องใช้ในแผนก และกรณีชำรุดสูญหาย', totalBudget: 240000, monthlyPlan: distribute(240000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-2', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.2', name: 'อุปกรณ์เครื่องมือ ซื้อเพิ่มเติมเหมาะกับประเภทงาน', totalBudget: 240000, monthlyPlan: distribute(240000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-3', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.3', name: 'ค่าบำรุงรักษา/ซ่อมแซม/ระบบน้ำใช้/งานซ่อมทั่วไป เชื่อมและอะไหล่ ที่ใช้งานซ่อมทั้งศูนย์', totalBudget: 240000, monthlyPlan: distribute(240000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-4', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.4', name: 'ค่าบำรุงรักษา/ซ่อมแซม/ระบบไฟฟ้า ภายในแผนก', totalBudget: 100000, monthlyPlan: distribute(100000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-5', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.5', name: 'ค่าบำรุงรักษา/ซ่อมแซม/เครื่องปรับอากาศในศูนย์ (การล้าง/การซ่อมตามแผงประจำปี)', totalBudget: 90000, monthlyPlan: distribute(90000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-6', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.6', name: 'ค่าบำรุงรักษา/ซ่อมแซม/ปรับปรุงหม้อแปลงไฟฟ้าภายในศูนย์', totalBudget: 80000, monthlyPlan: distribute(80000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-7', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.7', name: 'ค่าบำรุงรักษา/การสอบเทียบเครื่องมือ เมกโอมท์/วัดอุณหภูมิ (กุมภาพันธ์)', totalBudget: 10000, monthlyPlan: distribute(10000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-8', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.8', name: 'ค่าบำรุงรักษาและซ่อมแซมรถจักรยานยนต์/รถสามล้อ/รถกระเช้า ซ่อมภายนอก', totalBudget: 150000, monthlyPlan: distribute(150000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-9', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.9', name: 'ค่าซื้ออะไหล่ซ่อมแซมรถจักรยานยนต์/รถสามล้อ/รถกระเช้า รวมถึงอะไหล่ชิ้นเล็กที่อยู่ในสโตร์', totalBudget: 144000, monthlyPlan: distribute(144000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-10', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.10', name: 'ค่าซื้อยางรถสิบล้อใหม่ ยาง % (รถทอย รถน้ำ รถดับเพลิง) พร้อมกะทะล้อ', totalBudget: 120000, monthlyPlan: distribute(120000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-11', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.11', name: 'ค่าปะยางเครื่องจักรเคลื่อนที่และรถยนต์ที่ใช้ในศูนย์ (รถทอย รถน้ำ รถดับเพลิง รถกระบะ)', totalBudget: 96000, monthlyPlan: distribute(96000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-12', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.12', name: 'ค่าบำรุกรักษาอุปกรณ์คอมพิวเตอร์ สำนักงาน/เครือข่ายIT /ซื้อทดแทน', totalBudget: 30000, monthlyPlan: distribute(30000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-13', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.13', name: 'ซื้อรถจักรยานยนต์ ทดแทนที่แผนกก่อสร้างนำไปใช้งาน 1 คัน', totalBudget: 42000, monthlyPlan: distribute(42000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-14', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.14', name: 'ซื้อรถสามล้อแชมป์ สำหรับงานซ่อมภายนอกแผนกและล้างเครื่องปรับอากาศ', totalBudget: 80000, monthlyPlan: distribute(80000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-1-15', year: 2569, category: 'หมวด 1 อุปกรณ์เครื่องจักร', itemCode: '1.15', name: 'ซื้อเครื่องปรับอากาศ ทดแทนของเดิมที่ชำรุด 2 เครื่อง ห้องพักช่าง', totalBudget: 50000, monthlyPlan: distribute(50000), monthlyActual: Array(12).fill(0) },
  
  // หมวด 2
  { id: 'seed-2-1', year: 2569, category: 'หมวด 2 สารเคมี', itemCode: '2.1', name: 'ทินเนอร์ / LPG / CO2 /กาว 3K ที่ใช้ในการซ่อมภายในศูนย์', totalBudget: 30000, monthlyPlan: distribute(30000), monthlyActual: Array(12).fill(0) },
  
  // หมวด 3
  { id: 'seed-3-1', year: 2569, category: 'หมวด 3 ค่านำมันเชื้อเพลิง', itemCode: '3.1', name: 'ค่าน้ำมันเชื้อเพลิง เบนซิน รถจักรยานยนต์ รถสามล้อ เครื่องปั่นไฟ', totalBudget: 49000, monthlyPlan: distribute(49000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-3-2', year: 2569, category: 'หมวด 3 ค่านำมันเชื้อเพลิง', itemCode: '3.2', name: 'ค่าน้ำมันเชื้อเพลิง ดีเซล เครื่องปั่นไฟ 2 เครื่อง เครื่องยนดับเพลิง รถกระเช้า', totalBudget: 132000, monthlyPlan: distribute(132000), monthlyActual: Array(12).fill(0) },
  
  // หมวด 4
  { id: 'seed-4-1', year: 2569, category: 'หมวด 4 อุปกรณ์ PPE', itemCode: '4.1', name: 'อุปกรณ์', totalBudget: 34000, monthlyPlan: distribute(34000), monthlyActual: Array(12).fill(0) },
  
  // หมวด 5
  { id: 'seed-5-1', year: 2569, category: 'หมวด 5 อุปกรณ์สำนักงาน', itemCode: '5.1', name: 'ค่าบำรุงรักษา/ซ่อมแซมอุปกรณ์สำนักงาน (กรณีชำรุดทดแทน/ซื้อเพิ่มเติม) และเบิกใช้ในแผนก', totalBudget: 10000, monthlyPlan: distribute(10000), monthlyActual: Array(12).fill(0) },
  
  // หมวด 6
  { id: 'seed-6-1', year: 2569, category: 'หมวด 6 การปฏิบัติตามกฎหมายและข้อกำหนด', itemCode: '6.1', name: 'ติดตั้งป้ายเตือนและป้ายบ่งชี้ต่างๆ', totalBudget: 3000, monthlyPlan: distribute(3000), monthlyActual: Array(12).fill(0) },
  
  // หมวด 7
  { id: 'seed-7-1', year: 2569, category: 'หมวด 7 ปรับปรุง-พัฒนาพื้นที่ปฏิบัติงาน', itemCode: '7.1', name: 'ซ่อมหลังคาและเปลี่ยนรางน้ำฝน อาคารซ่อมบำรุงฯ', totalBudget: 160000, monthlyPlan: distribute(160000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-7-2', year: 2569, category: 'หมวด 7 ปรับปรุง-พัฒนาพื้นที่ปฏิบัติงาน', itemCode: '7.2', name: 'เปลี่ยนกันสาดบานเกล็ด ข้างอาคาร เปลี่ยนวัสดุเป็นเมทัลชีท', totalBudget: 120000, monthlyPlan: distribute(120000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-7-3', year: 2569, category: 'หมวด 7 ปรับปรุง-พัฒนาพื้นที่ปฏิบัติงาน', itemCode: '7.3', name: 'ปรับปรุงพื้นที่ห้องข้างออฟฟิศแผนกซ่อมบำรุงและยานยนต์เป็นสำนักงานช่าง ช่างมี 14 คน', totalBudget: 150000, monthlyPlan: distribute(150000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-7-4', year: 2569, category: 'หมวด 7 ปรับปรุง-พัฒนาพื้นที่ปฏิบัติงาน', itemCode: '7.4', name: 'ปรับปรุงห้องออฟฟิศแผนกซ่อมบำรุงและยานยนต์', totalBudget: 40000, monthlyPlan: distribute(40000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-7-5', year: 2569, category: 'หมวด 7 ปรับปรุง-พัฒนาพื้นที่ปฏิบัติงาน', itemCode: '7.5', name: 'ปรับปรุงพื้นที่ทำงานช่างด้านหลังอาคารซ่อมบำรุง', totalBudget: 300000, monthlyPlan: distribute(300000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-7-6', year: 2569, category: 'หมวด 7 ปรับปรุง-พัฒนาพื้นที่ปฏิบัติงาน', itemCode: '7.6', name: 'ต่อเติมห้องเก็บอุปกรณ์/เครื่องมือในอาคารซ่อมบำรุง 2 ชั้น โซนหน้าแผนก', totalBudget: 200000, monthlyPlan: distribute(200000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-7-7', year: 2569, category: 'หมวด 7 ปรับปรุง-พัฒนาพื้นที่ปฏิบัติงาน', itemCode: '7.7', name: 'ปรับปรุงห้อง Generator ที่สั่งซื้อทดแทนของเดิม ฝั่งปั๊มน้ำมัน', totalBudget: 200000, monthlyPlan: distribute(200000), monthlyActual: Array(12).fill(0) },
  { id: 'seed-7-8', year: 2569, category: 'หมวด 7 ปรับปรุง-พัฒนาพื้นที่ปฏิบัติงาน', itemCode: '7.8', name: 'ปรับปรุงห้อง Generator ที่สั่งซื้อทดแทนของเดิม ฝั่งหลังปรับสเถียร ย้ายมาข้างซ่อมบำรุง', totalBudget: 150000, monthlyPlan: distribute(150000), monthlyActual: Array(12).fill(0) }
];
