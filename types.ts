
export interface BudgetItem {
  id: string;
  year: number; // Buddhist Year (e.g. 2569)
  category: string; // หมวด 1, หมวด 2
  itemCode?: string; // New: ลำดับหัวข้อ (1.1, 1.2)
  name: string; // รายการ (1.1, 1.2)
  totalBudget: number;
  monthlyPlan: number[]; // Array length 12 (Jan-Dec)
  monthlyActual: number[]; // Array length 12 (Jan-Dec)
}

// New Interface for Daily Expenses Sheet
export interface DailyExpense {
  id: string;
  year: number;
  month: number; // 0-11
  division: string; // 'MTN' | 'MOT'
  budgetId: string; // Link to BudgetItem.id
  budgetCategory: string; // Cache for display
  budgetName: string; // Cache for display
  standardItemId?: string; // NEW: Link to StandardItem.id for persistent row mapping
  productCode?: string; // New: รหัสสินค้า
  itemName: string; // Specific item name (e.g., ใบตัด 4 นิ้ว)
  pricePerUnit: number;
  quantityDays: number[]; // Array length 31 (Day 1-31)
  totalQuantity: number;
  totalPrice: number;
}

// NEW: Standard Item Template for persistent rows
export interface StandardItem {
  id: string;
  code?: string;
  name: string;
  unit?: string;
  pricePerUnit: number;
  budgetId: string; // Linked budget
  budgetCategory: string; // Cache
  budgetName: string; // Cache
  division?: string; // Still keep in DB for structure, but generic in UI
}

// Updated Shift Definitions with New Colors and Symbols
// 'ห' and 'ล' are removed from here so they don't appear in selection options
export const SHIFT_DEFINITIONS: Record<string, { label: string; time: string; color: string }> = {
  'ช': { label: 'เช้า', time: '08:00-17:00', color: 'bg-green-100 text-green-800' },
  'ท': { label: 'เที่ยง', time: '12:00-21:00', color: 'bg-pink-100 text-pink-800' }, // Pink
  'บ': { label: 'บ่าย', time: '15:00-22:00', color: 'bg-orange-100 text-orange-800' },
  'ด': { label: 'ดึก', time: '21:00-06:00', color: 'bg-indigo-100 text-indigo-800' },
  'V': { label: 'พักร้อน', time: '-', color: 'bg-gray-100 text-gray-800' }, // V = Vacation (Ex-Leave) -> Gray
  'X': { label: 'หยุด', time: '-', color: 'bg-red-100 text-red-800' }, // X = Off (Ex-Holiday)
};

export type ShiftCode = keyof typeof SHIFT_DEFINITIONS;

// --- Helper Constants for System ---
// Pseudo-domain for username-based login
export const SYSTEM_DOMAIN = '@maintenance.local';

export const formatUsername = (emailOrUsername: string) => {
    if (emailOrUsername.endsWith(SYSTEM_DOMAIN)) {
        return emailOrUsername.replace(SYSTEM_DOMAIN, '');
    }
    return emailOrUsername;
};

export const toSystemEmail = (username: string) => {
    if (username.includes('@')) return username;
    return `${username}${SYSTEM_DOMAIN}`;
};

// --- Helper for Date Formatting (Global) ---
export const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '-';
    
    // 1. Try to parse YYYY-MM-DD directly to avoid timezone issues
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]);
        const day = parseInt(parts[2].substring(0, 2)); 
        
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
             // FIX: Check if year is already Buddhist Year (> 2400)
             const thYear = year > 2400 ? year : year + 543;
             return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${thYear}`;
        }
    }

    // 2. Fallback to standard Date parsing
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        
        const year = date.getFullYear();
        // FIX: Check if year is already Buddhist Year
        const thYear = year > 2400 ? year : year + 543;
        
        return `${day}/${month}/${thYear}`;
    } catch (e) {
        return '-';
    }
};

// FIX: Updated Enum values to match Database ('ดำเนินการ', 'ปิดงานแล้ว')
export enum JobStatus {
  IN_PROGRESS = 'ดำเนินการ',
  WAITING_INSPECTION = 'รอตรวจรับ', 
  FINISHED = 'ปิดงานแล้ว',
  CANCELLED = 'ยกเลิก',
  UNREPAIRABLE = 'ซ่อมไม่ได้'
}

// Display Mapping for UI
export const JOB_STATUS_DISPLAY: Record<string, string> = {
  'ดำเนินการ': 'ดำเนินการ',
  'รอดำเนินการ': 'ดำเนินการ', // Legacy Support
  'รอตรวจรับ': 'รอตรวจรับ', 
  'ปิดงานแล้ว': 'ปิดงานแล้ว',
  'เสร็จสิ้น': 'ปิดงานแล้ว', // Legacy Support
  'ยกเลิก': 'ยกเลิก',
  'ซ่อมไม่ได้': 'ซ่อมไม่ได้'
};

// FIX: Update RepairGroup to match STRICT requirements
export enum RepairGroup {
  INTERNAL = 'ซ่อมภายใน',
  EXTERNAL = 'ส่งซ่อมภายนอก',
  BUY_PARTS = 'ซื้ออุปกรณ์',
  QUALITY_PROJECT = 'งานโครงการคุณภาพ',
  CANNOT_FIX = 'ซ่อมไม่ได้',
  CANCEL = 'ยกเลิกงานซ่อม'
}

export type JobType = string;

export interface CostItem {
  id: string;
  name: string;
  category?: string;
  company?: string;
  quantity: number;
  pricePerUnit: number;
  totalPrice: number;
  code?: string;
  prNumber?: string;
  date?: string;
}

export interface JobAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  publicUrl: string;
  uploadedAt: string;
}

export interface Job {
  id: string;
  jobRunningId: string;
  dateReceived: string;
  jobType?: string;
  status: JobStatus;
  technicianIds?: string[];
  costs?: CostItem[];
  attachments?: JobAttachment[];
  repairGroup?: string; 
  department: string;
  assetId?: string;
  repairOrderNumber?: string;
  itemDescription: string;
  damageDescription?: string;
  dueDate?: string;
  finishedDate?: string;
  assessment?: string; // หมายเหตุการซ่อม / Reject Reason
  evaluation?: { speed: number; quality: number };
  lastUpdated?: string;
  pmPlanId?: string;
}

export interface Technician {
  id: string;
  firstName: string;
  nickName: string;
  position: string;
  category?: string;
  schedule: Record<string, string>;
  empId?: string;
}

export type UserRole = 'TECHNICIAN' | 'HEAD' | 'DEPT_ADMIN' | 'SYSTEM_ADMIN';

export interface User {
  username: string;
  role: UserRole;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  'TECHNICIAN': 'ช่าง/ผู้แจ้ง',
  'HEAD': 'หัวหน้าแผนก',
  'DEPT_ADMIN': 'ธุรการแผนก',
  'SYSTEM_ADMIN': 'ผู้ดูแลระบบ'
};

export interface AppSettings {
  id?: number;
  departments: string[];
  technicianPositions: string[];
  technicianCategories: string[];
  expenseCategories: string[];
  companies: string[];
  themeColor: string;
  idMappings: { category: string; prefix: string }[];
  pmTypes: string[];
  budgetCategories: string[];
  repairGroups: string[]; 
  divisionMappings?: Record<string, 'MTN' | 'MOT'>; 
  // NEW FIELDS
  divisions?: { name: string; code: string }[];
  factoryGroups?: string[];
  departmentGroupMappings?: Record<string, string>; // DeptName -> GroupName
}

export interface PMPlan {
  id: string;
  name: string;
  department: string;
  frequency: number;
  assetId?: string;
  type?: string;
  description?: string;
  planType?: 'S' | 'P' | 'EP' | 'C';
  nextDueDate?: string;
  lastDoneDate?: string;
}

export interface FactoryHoliday {
  id: string;
  date: string;
  name: string;
}

export interface UserRoleProfile {
  id?: number;
  email: string;
  role: UserRole;
}
