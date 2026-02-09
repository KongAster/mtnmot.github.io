
// ... existing imports ...
import { Job, Technician, AppSettings, UserRoleProfile, JobType, PMPlan, FactoryHoliday, BudgetItem, RepairGroup, UserRole, DailyExpense, StandardItem } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { db } from '../lib/db';
import { DEPARTMENTS, INITIAL_TECHNICIANS, INITIAL_BUDGETS_2569 } from '../constants';

// ... (Cache and setup - no changes needed) ...
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000; 

const getFromCache = (key: string) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    return null;
};

const setCache = (key: string, data: any) => {
    cache.set(key, { data, timestamp: Date.now() });
};

const invalidateCache = (prefix: string) => {
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) cache.delete(key);
    }
};

const DEFAULT_SETTINGS: AppSettings = {
  // ... (Same settings) ...
  departments: DEPARTMENTS,
  technicianPositions: ['ช่าง', 'แอดมิน', 'หัวหน้าแผนก'],
  technicianCategories: ['ไฟฟ้า', 'ประปา', 'เครื่องปรับอากาศ (แอร์)', 'ซ่อมทั่วไป/เซอร์วิส', 'ก่อสร้าง/โครงสร้าง', 'ยานยนต์'],
  expenseCategories: ['ค่าซ่อมบำรุงตามรายการบัญชีเครื่องมือเครื่องจักร', 'ค่าซ่อมทั่วไปตามใบแจ้งซ่อม-ซ่อมภายใน', 'ค่าซ่อมทั่วไปตามใบแจ้งซ่อม-ซ่อมภายนอก', 'ค่าซ่อมเครื่องปรับอากาศ (แอร์)', 'ค่าซ่อมบำรุงเครื่องจักรเคลื่อนที่ รถบด รถน้ำ รถดับเพลิง รถไถ', 'ค่าซ่อมปั๊มสูบน้ำ/เครื่องเจน', 'ค่าซ่อมรถยนต์ส่วนกลาง/โครงการพิเศษ', 'ค่าซ่อมรถจักรยานยนต์/รถสามล้อ'],
  companies: ['BWG', 'BG', 'BME', 'BWT', 'BWC', 'PF'], 
  themeColor: 'INDIGO', 
  idMappings: [ { category: 'ยานยนต์', prefix: 'MOT' }, { category: 'ไฟฟ้า', prefix: 'MTN' }, { category: 'ประปา', prefix: 'MTN' }, { category: 'เครื่องปรับอากาศ (แอร์)', prefix: 'MTN' }, { category: 'ซ่อมทั่วไป/เซอร์วิส', prefix: 'MTN' }, { category: 'ก่อสร้าง/โครงสร้าง', prefix: 'MTN' } ],
  pmTypes: ["หม้อแปลงไฟฟ้า", "ตู้ควบคุมหม้อแปลงไฟฟ้า", "เสาล่อฟ้า", "ตู้ควบคุมเครื่องจักร", "ปั๊มน้ำดี", "ปั๊มน้ำเสีย", "ปั๊มลม", "มอเตอร์+ปั๊ม", "มอเตอร์", "เครื่องกำเนิดไฟฟ้า", "เครื่องซีลผ้า", "ระบบบำบัดอากาศ", "เครื่องเติมอากาศ", "เครื่องดูดอากาศ", "เครื่องปรับอากาศ", "รถโฟคลิฟท์", "รถคีบไฮดรอลิค", "รถสิบล้อ", "รถ Roll Off", "รถแทรกเตอร์", "รถบดถนน", "รถน้ำ/รถดับเพลิง", "รถบรรทุกกระเช้าไฟฟ้า", "รถ Vaccum", "เครื่องยนต์เบนซิน", "เครื่องยนต์ดีเซล", "พญานาคสูบน้ำซิ่ง", "ปั๊มสูบน้ำเครื่องยนต์", "ปั๊มลมเครื่องยนต์", "เครื่องตัดหญ้าเบนซิน", "กะบะ 4 ประตู", "กะบะแค๊ป", "รถยนต์ 4 ประตู", "รถตู้", "รถจักรยานยนต์", "รถสามล้อ"],
  budgetCategories: ['หมวด 1 อุปกรณ์เครื่องจักร', 'หมวด 2 สารเคมี', 'หมวด 3 ค่านำมันเชื้อเพลิง', 'หมวด 4 อุปกรณ์ PPE', 'หมวด 5 อุปกรณ์สำนักงาน', 'หมวด 6 การปฏิบัติตามกฎหมายและข้อกำหนด', 'หมวด 7 ปรับปรุง-พัฒนาพื้นที่ปฏิบัติงาน'],
  repairGroups: [RepairGroup.INTERNAL, RepairGroup.EXTERNAL, RepairGroup.BUY_PARTS, RepairGroup.QUALITY_PROJECT, RepairGroup.CANNOT_FIX, RepairGroup.CANCEL],
  divisionMappings: { 'ไฟฟ้า': 'MTN', 'ประปา': 'MTN', 'เครื่องปรับอากาศ (แอร์)': 'MTN', 'ซ่อมทั่วไป/เซอร์วิส': 'MTN', 'ก่อสร้าง/โครงสร้าง': 'MTN', 'ยานยนต์': 'MOT' },
  divisions: [{ name: 'ซ่อมบำรุง', code: 'MTN' }, { name: 'ยานยนต์', code: 'MOT' }],
  factoryGroups: ['โรงงาน 101', 'โรงงาน 106'],
  departmentGroupMappings: { "แผนกผสมกากเชื้อเพลิงของแข็ง 1 (RDF1)": "โรงงาน 101", "แผนกผสมกากเชื้อเพลิงของแข็ง 2 (RDF2)": "โรงงาน 101", "แผนกเตรียมวัตถุดิบและ N5 (SMP)": "โรงงาน 101", "แผนกปรับปรุงคุณภาพกาก เตรียมกาก (SPE)": "โรงงาน 101", "แผนกปรับปรุงคุณภาพกาก บำบัดกาก (STA)": "โรงงาน 101", "แผนกกำจัดกากปนเปื้อน (HAZ)": "โรงงาน 106", "แผนกกำจัดกาทั่วไป (NON)": "โรงงาน 106", "แผนกระบบปรับปรุงคุณภาพน้ำ HAZ (PLH)": "โรงงาน 106", "แผนกระบบปรับปรุงคุณภาพน้ำ NON (PLN)": "โรงงาน 106", "แผนกวิชาการสิ่งแวดล้อมและความปลอดภัย (ENV)": "โรงงาน 106", "แผนกบริหารทรัพยากรบุคคล (HRM)": "โรงงาน 106", "แผนกผสมกากเชื้อเพลิงของเหลว (LBL)": "โรงงาน 101", "แผนกจัดการรถขนส่งและภาชนะบรรจุ (CON)": "โรงงาน 101", "แผนกวิศวกรรมซ่อมบำรุง (MTN)": "โรงงาน 106", "แผนกสื่อสารองค์กร (COC)": "โรงงาน 106", "แผนกปฏิบัติการ (OPE)": "โรงงาน 106", "แผนกตรวจสอบคุณภาพ (QCI)": "โรงงาน 106", "แผนกวางแผนการผลิตและขาย (PPS)": "โรงงาน 106", "แผนกโครงการพิเศษฯ (PRO)": "โรงงาน 106", "แผนกธุรการขนส่ง (ADD)": "โรงงาน 106", "แผนกซ่อมบำรุง RDF (MER)": "โรงงาน 101", "แผนกวิศวกรรมยานยนต์ (MOT)": "โรงงาน 106", "แผนกบริหารสินทรัพย์ (ASM)": "โรงงาน 106", "แผนกปฏิบัติการวิเคราะห์ (LAB)": "โรงงาน 106", "แผนกข้อมูลตรวจรับกาก (CIW)": "โรงงาน 106", "แผนกดรอส (DROSS)": "โรงงาน 101", "แผนกก่อสร้าง (CST)": "โรงงาน 106", "แผนกเทคโนโลยีสารสนเทศ (IT)": "โรงงาน 106", "แผนกวิจัยและพัฒนา (RD)": "โรงงาน 106" } 
};

export const dataService = {
  // ... (Other existing methods) ...
  async getJobs(): Promise<Job[]> {
    const cached = getFromCache('jobs');
    if (cached) return cached;
    if (isSupabaseConfigured()) {
        try {
            const { data, error } = await supabase.from('jobs').select('*');
            if (!error && data) {
                const jobs = data.map((j: any) => ({ ...j, costs: typeof j.costs === 'string' ? JSON.parse(j.costs) : j.costs, attachments: typeof j.attachments === 'string' ? JSON.parse(j.attachments) : j.attachments, technicianIds: typeof j.technicianIds === 'string' ? JSON.parse(j.technicianIds) : (j.technicianIds || j.technician_ids || []) }));
                await db.jobs.bulkPut(jobs);
                setCache('jobs', jobs);
                return jobs;
            }
        } catch (e) { console.error("Supabase jobs fetch failed", e); }
    }
    const localJobs = await db.jobs.toArray();
    setCache('jobs', localJobs);
    return localJobs;
  },
  async saveJob(job: Job): Promise<Job> {
    invalidateCache('jobs');
    await db.jobs.put(job);
    if (isSupabaseConfigured()) {
        const { error } = await supabase.from('jobs').upsert({ ...job, evaluation: job.evaluation ? job.evaluation : null });
        if (error) throw error;
    }
    return job;
  },
  async deleteJob(id: string): Promise<void> {
    invalidateCache('jobs');
    await db.jobs.delete(id);
    if (isSupabaseConfigured()) { await supabase.from('jobs').delete().eq('id', id); }
  },
  async getTechnicians(): Promise<Technician[]> {
    const cached = getFromCache('technicians');
    if (cached) return cached;
    if (isSupabaseConfigured()) {
        try {
            const { data } = await supabase.from('technicians').select('*');
            if (data) { await db.technicians.bulkPut(data as Technician[]); setCache('technicians', data); return data as Technician[]; }
        } catch {}
    }
    const local = await db.technicians.toArray();
    setCache('technicians', local);
    return local;
  },
  async saveTechnician(tech: Technician): Promise<Technician> {
    invalidateCache('technicians');
    await db.technicians.put(tech);
    if (isSupabaseConfigured()) { await supabase.from('technicians').upsert(tech); }
    return tech;
  },
  async deleteTechnician(id: string): Promise<void> {
    invalidateCache('technicians');
    await db.technicians.delete(id);
    if (isSupabaseConfigured()) { await supabase.from('technicians').delete().eq('id', id); }
  },
  async getSettings(): Promise<AppSettings> {
    const cached = getFromCache('settings');
    if (cached) return cached;
    let localSettings = await db.settings.get(1);
    if (isSupabaseConfigured()) {
        try {
            const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
            if (data) {
                const merged: AppSettings = { id: 1, departments: data.departments || DEFAULT_SETTINGS.departments, technicianPositions: data.technician_positions || DEFAULT_SETTINGS.technicianPositions, technicianCategories: data.technician_categories || DEFAULT_SETTINGS.technicianCategories, expenseCategories: data.expense_categories || DEFAULT_SETTINGS.expenseCategories, companies: data.companies || DEFAULT_SETTINGS.companies, themeColor: data.theme_color || DEFAULT_SETTINGS.themeColor, idMappings: data.id_mappings || DEFAULT_SETTINGS.idMappings, pmTypes: data.pm_types || DEFAULT_SETTINGS.pmTypes, budgetCategories: data.budget_categories || DEFAULT_SETTINGS.budgetCategories, repairGroups: data.repair_groups || DEFAULT_SETTINGS.repairGroups, divisionMappings: data.division_mappings || DEFAULT_SETTINGS.divisionMappings, divisions: data.divisions || DEFAULT_SETTINGS.divisions, factoryGroups: data.factory_groups || DEFAULT_SETTINGS.factoryGroups, departmentGroupMappings: data.department_group_mappings || DEFAULT_SETTINGS.departmentGroupMappings };
                await db.settings.put(merged);
                setCache('settings', merged);
                return merged;
            }
        } catch {}
    }
    const finalSettings = localSettings ? { ...DEFAULT_SETTINGS, ...localSettings } : DEFAULT_SETTINGS;
    setCache('settings', finalSettings);
    return finalSettings;
  },
  async saveSettings(settings: AppSettings): Promise<AppSettings> {
    invalidateCache('settings');
    await db.settings.put({ ...settings, id: 1 });
    if (isSupabaseConfigured()) {
        const payload = { id: 1, departments: settings.departments, technician_positions: settings.technicianPositions, technician_categories: settings.technicianCategories, expense_categories: settings.expenseCategories, companies: settings.companies, theme_color: settings.themeColor, id_mappings: settings.idMappings, pm_types: settings.pmTypes, budget_categories: settings.budgetCategories, repair_groups: settings.repairGroups, division_mappings: settings.divisionMappings, divisions: settings.divisions, factory_groups: settings.factoryGroups, department_group_mappings: settings.departmentGroupMappings };
        await supabase.from('app_settings').upsert(payload);
    }
    return settings;
  },
  async getPMPlans(): Promise<PMPlan[]> {
      const cached = getFromCache('pmPlans');
      if (cached) return cached;
      if (isSupabaseConfigured()) {
          const { data } = await supabase.from('pm_plans').select('*');
          if (data) {
              // Ensure mapping is robust for both camelCase and snake_case columns
              const plans = data.map((p: any) => ({ 
                  ...p, 
                  // Prefer camelCase 'planType' if exists (from schema), fallback to 'plan_type'
                  planType: p.planType || p.plan_type 
              }));
              await db.pmPlans.bulkPut(plans);
              setCache('pmPlans', plans);
              return plans;
          }
      }
      const local = await db.pmPlans.toArray();
      setCache('pmPlans', local);
      return local;
  },
  async savePMPlan(plan: PMPlan): Promise<void> {
      invalidateCache('pmPlans');
      await db.pmPlans.put(plan);
      if (isSupabaseConfigured()) { 
          // FIX: Simply pass the plan. 
          // The schema uses "planType" (camelCase column). 
          // Spreading 'plan' puts 'planType' in the payload, which matches the column.
          await supabase.from('pm_plans').upsert(plan); 
      }
  },
  async deletePMPlan(id: string): Promise<void> {
      invalidateCache('pmPlans');
      await db.pmPlans.delete(id);
      if (isSupabaseConfigured()) { await supabase.from('pm_plans').delete().eq('id', id); }
  },
  async getHolidays(): Promise<FactoryHoliday[]> {
      const cached = getFromCache('holidays');
      if (cached) return cached;
      if (isSupabaseConfigured()) {
          const { data } = await supabase.from('factory_holidays').select('*');
          if (data) { await db.holidays.bulkPut(data); setCache('holidays', data); return data; }
      }
      const local = await db.holidays.toArray();
      setCache('holidays', local);
      return local;
  },
  async getUserRoles(): Promise<UserRoleProfile[]> {
      if (isSupabaseConfigured()) { const { data } = await supabase.from('user_roles').select('*'); return data || []; }
      return db.userRoles.toArray();
  },
  async saveUserRole(profile: { email: string; role: UserRole }): Promise<void> {
      if (isSupabaseConfigured()) { await supabase.from('user_roles').upsert(profile); } else { await db.userRoles.put(profile); }
  },
  async deleteUserRole(email: string): Promise<void> {
      if (isSupabaseConfigured()) { await supabase.from('user_roles').delete().eq('email', email); } else { const role = await db.userRoles.where('email').equals(email).first(); if (role && role.id) await db.userRoles.delete(role.id); }
  },
  async getBudgets(year: number): Promise<BudgetItem[]> {
      const key = `budgets_${year}`;
      const cached = getFromCache(key);
      if (cached) return cached;
      if (isSupabaseConfigured()) {
          const { data } = await supabase.from('budgets').select('*').eq('year', year);
          if (data) {
              const mapped = data.map((b: any) => ({ ...b, monthlyPlan: b.monthlyPlan || b.monthly_plan || [], monthlyActual: b.monthlyActual || b.monthly_actual || [], totalBudget: b.totalBudget ?? b.total_budget ?? 0, itemCode: b.itemCode || b.item_code || '' }));
              await db.budgets.bulkPut(mapped);
              setCache(key, mapped);
              return mapped;
          }
      }
      const local = await db.budgets.where('year').equals(year).toArray();
      setCache(key, local);
      return local;
  },
  async saveBudget(item: BudgetItem): Promise<void> {
      invalidateCache(`budgets_${item.year}`);
      await db.budgets.put(item);
      if (isSupabaseConfigured()) { await supabase.from('budgets').upsert({ ...item, monthlyPlan: item.monthlyPlan, monthlyActual: item.monthlyActual, totalBudget: item.totalBudget, itemCode: item.itemCode }); }
  },
  async deleteBudget(id: string): Promise<void> {
      const item = await db.budgets.get(id);
      if (item) invalidateCache(`budgets_${item.year}`);
      await db.budgets.delete(id);
      if (isSupabaseConfigured()) { await supabase.from('budgets').delete().eq('id', id); }
  },
  async seedBudgets(year: number) {
      let count = 0;
      if (isSupabaseConfigured()) { const { count: sbCount } = await supabase.from('budgets').select('*', { count: 'exact', head: true }).eq('year', year); count = sbCount || 0; } else { count = await db.budgets.where('year').equals(year).count(); }
      if (count === 0 && year === 2569) {
          const items = INITIAL_BUDGETS_2569; 
          if (isSupabaseConfigured()) { const payload = items.map(item => ({ id: item.id, year: item.year, category: item.category, "itemCode": item.itemCode, "name": item.name, "totalBudget": item.totalBudget, "monthlyPlan": item.monthlyPlan, "monthlyActual": item.monthlyActual })); await supabase.from('budgets').insert(payload); }
          await db.budgets.bulkAdd(items);
          invalidateCache(`budgets_${year}`);
      }
  },

  // --- DAILY EXPENSES ---
  async getDailyExpenses(year: number, month: number, division: string): Promise<DailyExpense[]> {
      const key = `daily_expenses_${year}_${month}_${division}`;
      const cached = getFromCache(key);
      if (cached) return cached;

      if (isSupabaseConfigured()) {
          // NOTE: We now default to 'MTN' if division is empty/unspecified to maintain compatibility
          const targetDivision = division || 'MTN';
          const { data } = await supabase.from('daily_expenses')
              .select('*')
              .eq('year', year)
              .eq('month', month)
              .eq('division', targetDivision);
          
          if (data) {
              const mapped = data.map((d: any) => ({
                  ...d,
                  quantityDays: d.quantityDays || d.quantity_days || [],
                  totalQuantity: d.totalQuantity ?? d.total_quantity ?? 0,
                  totalPrice: d.totalPrice ?? d.total_price ?? 0,
                  pricePerUnit: d.pricePerUnit ?? d.price_per_unit ?? 0,
                  budgetId: d.budgetId || d.budget_id,
                  budgetCategory: d.budgetCategory || d.budget_category,
                  budgetName: d.budgetName || d.budget_name,
                  itemName: d.itemName || d.item_name,
                  productCode: d.productCode || d.product_code || '',
                  standardItemId: d.standardItemId || d.standard_item_id // New Map
              }));
              await db.dailyExpenses.bulkPut(mapped);
              setCache(key, mapped);
              return mapped;
          }
      }
      
      const targetDivision = division || 'MTN';
      const local = await db.dailyExpenses
          .where('[year+month]').equals([year, month])
          .filter((item: any) => item.division === targetDivision)
          .toArray();
      
      setCache(key, local);
      return local;
  },

  async saveDailyExpense(expense: DailyExpense): Promise<void> {
      // Ensure default division if missing
      if (!expense.division) expense.division = 'MTN';
      const cacheKey = `daily_expenses_${expense.year}_${expense.month}_${expense.division}`;
      invalidateCache(cacheKey);
      await db.dailyExpenses.put(expense);

      if (isSupabaseConfigured()) {
          await supabase.from('daily_expenses').upsert({
              ...expense,
              quantityDays: expense.quantityDays,
              totalQuantity: expense.totalQuantity,
              totalPrice: expense.totalPrice,
              pricePerUnit: expense.pricePerUnit,
              budgetId: expense.budgetId,
              budgetCategory: expense.budgetCategory,
              budgetName: expense.budgetName,
              itemName: expense.itemName,
              productCode: expense.productCode,
              standardItemId: expense.standardItemId // New Field
          });
      }
      await this.syncBudgetActual(expense.budgetId, expense.year, expense.month);
  },

  async deleteDailyExpense(id: string): Promise<void> {
      const expense = await db.dailyExpenses.get(id);
      if (!expense) return;
      const cacheKey = `daily_expenses_${expense.year}_${expense.month}_${expense.division}`;
      invalidateCache(cacheKey);
      await db.dailyExpenses.delete(id);
      if (isSupabaseConfigured()) { await supabase.from('daily_expenses').delete().eq('id', id); }
      await this.syncBudgetActual(expense.budgetId, expense.year, expense.month);
  },

  async syncBudgetActual(budgetId: string, year: number, month: number) {
      let totalActual = 0;
      if (isSupabaseConfigured()) {
          const { data } = await supabase.from('daily_expenses').select('totalPrice').eq('budgetId', budgetId).eq('year', year).eq('month', month);
          if (data) { totalActual = data.reduce((sum: number, item: any) => sum + (item.totalPrice || item.total_price || 0), 0); }
      } else {
          const expenses = await db.dailyExpenses.where('budgetId').equals(budgetId).filter((e: any) => e.year === year && e.month === month).toArray();
          totalActual = expenses.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
      }
      const budgetItem = await db.budgets.get(budgetId);
      if (budgetItem) {
          const newMonthlyActual = [...budgetItem.monthlyActual];
          newMonthlyActual[month] = totalActual;
          await this.saveBudget({ ...budgetItem, monthlyActual: newMonthlyActual });
      } else if (isSupabaseConfigured()) {
          const { data } = await supabase.from('budgets').select('*').eq('id', budgetId).single();
          if (data) {
              const monthlyActual = data.monthlyActual || data.monthly_actual || Array(12).fill(0);
              monthlyActual[month] = totalActual;
              await supabase.from('budgets').update({ monthlyActual: monthlyActual }).eq('id', budgetId);
              invalidateCache(`budgets_${year}`);
          }
      }
  },

  async cleanupHistoricalExpenses(): Promise<number> {
      const currentYear = new Date().getFullYear() + 543;
      const cutoffYear = currentYear - 1; 
      let deletedCount = 0;
      if (isSupabaseConfigured()) {
          const { count } = await supabase.from('daily_expenses').select('*', { count: 'exact', head: true }).lt('year', cutoffYear);
          if (count && count > 0) { await supabase.from('daily_expenses').delete().lt('year', cutoffYear); deletedCount = count; }
      } else {
          const oldItems = await db.dailyExpenses.where('year').below(cutoffYear).toArray();
          if (oldItems.length > 0) { const ids = oldItems.map((i: any) => i.id); await db.dailyExpenses.bulkDelete(ids); deletedCount = oldItems.length; }
      }
      if (deletedCount > 0) { invalidateCache('daily_expenses_'); }
      return deletedCount;
  },

  async cleanupOldBudgets(year: number): Promise<number> {
      let count = 0;
      if (isSupabaseConfigured()) {
          const { count: sbCount } = await supabase.from('budgets').select('*', { count: 'exact', head: true }).lte('year', year);
          count = sbCount || 0;
          if (count > 0) { await supabase.from('budgets').delete().lte('year', year); }
      } else {
          count = await db.budgets.where('year').belowOrEqual(year).count();
          if (count > 0) { await db.budgets.where('year').belowOrEqual(year).delete(); }
      }
      if (count > 0) { invalidateCache(`budgets_`); }
      return count;
  },

  // --- STANDARD ITEMS (UPDATED FOR PERSISTENCE) ---
  // MODIFIED: Remove division filtering to ensure global persistence
  async getStandardItems(division: string): Promise<StandardItem[]> {
      const key = `all_standard_items`; 
      
      const cached = getFromCache(key);
      if (cached) return cached;
      
      if (isSupabaseConfigured()) {
          // Fetch ALL items to ensure persistence across sessions and views
          const { data } = await supabase.from('standard_items').select('*'); 
          
          if (data) {
              const mapped = data.map((d: any) => ({ 
                  ...d, 
                  // Use camelCase from DB (schema uses quoted identifiers) or fallback if using snake_case convention
                  pricePerUnit: d.pricePerUnit ?? d.price_per_unit ?? 0, 
                  budgetId: d.budgetId || d.budget_id, 
                  budgetCategory: d.budgetCategory || d.budget_category, 
                  budgetName: d.budgetName || d.budget_name 
              }));
              
              await db.standardItems.bulkPut(mapped);
              setCache(key, mapped);
              return mapped;
          }
      }
      
      // Offline mode: Fetch all from Dexie
      try {
          const local = await db.standardItems.toArray();
          setCache(key, local);
          return local;
      } catch (e) {
          console.warn("Could not fetch standard items from local DB (Table might not exist yet)", e);
          return [];
      }
  },
  
  async saveStandardItem(item: StandardItem): Promise<void> {
      // Ensure division is set for consistency (though now ignored in fetch)
      if (!item.division) item.division = 'MTN';
      
      // Invalidate global cache
      const key = `all_standard_items`;
      invalidateCache(key);
      
      await db.standardItems.put(item);
      
      if (isSupabaseConfigured()) { 
          // FIX: Pass item directly. Schema uses camelCase columns "pricePerUnit" etc.
          // Spreading item puts correct keys.
          await supabase.from('standard_items').upsert(item); 
      }
  },
  
  async deleteStandardItem(id: string): Promise<void> {
      const item = await db.standardItems.get(id);
      if (item) { 
          invalidateCache(`all_standard_items`); 
      }
      await db.standardItems.delete(id);
      if (isSupabaseConfigured()) { await supabase.from('standard_items').delete().eq('id', id); }
  },

  // ... (Other Utils same) ...
  subscribe(table: string, callback: () => void) { if (!isSupabaseConfigured()) return { unsubscribe: () => {} }; const channel = supabase.channel(`public:${table}`).on('postgres_changes', { event: '*', schema: 'public', table: table }, callback).subscribe(); return { unsubscribe: () => supabase.removeChannel(channel) }; },
  async deleteJobsByPeriod(year: number, month: number): Promise<number> { const allJobs = await this.getJobs(); const toDelete = allJobs.filter(j => { const d = new Date(j.dateReceived); return d.getFullYear() === year && (month === -1 || d.getMonth() === month); }); for (const job of toDelete) { await this.deleteJob(job.id); } return toDelete.length; },
  async generateNextJobId(jobType: string, dateReceived: string): Promise<string> { const settings = await this.getSettings(); const mapping = settings.idMappings.find(m => m.category === jobType); const prefix = mapping ? mapping.prefix : 'JOB'; const date = new Date(dateReceived); const thYear = date.getFullYear() + 543; const yy = thYear.toString().slice(-2); const mm = String(date.getMonth() + 1).padStart(2, '0'); const baseHeader = `${prefix}${mm}`; const baseFooter = `/${yy}`; const jobs = await this.getJobs(); const relevantJobs = jobs.filter(j => j.jobRunningId && j.jobRunningId.startsWith(baseHeader) && j.jobRunningId.endsWith(baseFooter)); let maxSeq = 0; const regex = new RegExp(`^${baseHeader}(\\d+)${baseFooter}$`); relevantJobs.forEach(j => { const match = j.jobRunningId.match(regex); if (match && match[1]) { const seq = parseInt(match[1], 10); if (!isNaN(seq) && seq > maxSeq) { maxSeq = seq; } } else { const middlePart = j.jobRunningId.slice(baseHeader.length, -baseFooter.length); const seq = parseInt(middlePart, 10); if (!isNaN(seq) && seq > maxSeq) { maxSeq = seq; } } }); const nextSeq = String(maxSeq + 1).padStart(3, '0'); return `${baseHeader}${nextSeq}${baseFooter}`; },
  async bulkUpdateJobField(field: keyof Job, oldValue: string, newValue: string): Promise<number> { const jobs = await this.getJobs(); const toUpdate = jobs.filter(j => j[field] === oldValue); for (const job of toUpdate) { await this.saveJob({ ...job, [field]: newValue }); } return toUpdate.length; },
  async bulkUpdateTechnicianField(field: keyof Technician, oldValue: string, newValue: string): Promise<number> { const techs = await this.getTechnicians(); const toUpdate = techs.filter(t => (t as any)[field] === oldValue); for (const t of toUpdate) { await this.saveTechnician({ ...t, [field]: newValue }); } return toUpdate.length; },
  async bulkUpdateCostField(field: 'category' | 'company', oldValue: string, newValue: string): Promise<number> { const jobs = await this.getJobs(); let updatedCount = 0; for (const job of jobs) { if (job.costs) { let modified = false; const newCosts = job.costs.map(c => { if (c[field] === oldValue) { modified = true; return { ...c, [field]: newValue }; } return c; }); if (modified) { await this.saveJob({ ...job, costs: newCosts }); updatedCount++; } } } return updatedCount; },
  async bulkUpdatePMPlanField(field: keyof PMPlan, oldValue: string, newValue: string): Promise<number> { const plans = await this.getPMPlans(); const toUpdate = plans.filter(p => p[field] === oldValue); for (const p of toUpdate) { await this.savePMPlan({ ...p, [field]: newValue }); } return toUpdate.length; },
  async getSystemUsageStats() { const jobs = await this.getJobs(); const techs = await this.getTechnicians(); const plans = await this.getPMPlans(); const budgets = await db.budgets.toArray(); const sizeJobs = JSON.stringify(jobs).length; const sizeTechs = JSON.stringify(techs).length; const sizePlans = JSON.stringify(plans).length; const sizeBudgets = JSON.stringify(budgets).length; const total = sizeJobs + sizeTechs + sizePlans + sizeBudgets; return { formatted: `${(total / 1024).toFixed(2)} KB`, breakdown: { jobs: sizeJobs, technicians: sizeTechs, pmPlans: sizePlans, budgets: sizeBudgets, totalBytes: total } }; },
  async recalculateAllPMDates(): Promise<number> { const plans = await this.getPMPlans(); let count = 0; const today = new Date(); for (const p of plans) { if (!p.nextDueDate && p.frequency) { await this.savePMPlan({ ...p, nextDueDate: today.toISOString().split('T')[0] }); count++; } } return count; },
  async fixDuplicateJobIds(): Promise<number> { const jobs = await this.getJobs(); const idMap = new Map<string, Job[]>(); jobs.forEach(j => { if (!idMap.has(j.jobRunningId)) idMap.set(j.jobRunningId, []); idMap.get(j.jobRunningId)?.push(j); }); let fixedCount = 0; for (const [runningId, group] of idMap.entries()) { if (group.length > 1) { group.sort((a,b) => new Date(a.dateReceived).getTime() - new Date(b.dateReceived).getTime()); for (let i = 1; i < group.length; i++) { const job = group[i]; const newId = await this.generateNextJobId(job.jobType || 'ซ่อมทั่วไป/เซอร์วิส', job.dateReceived); await this.saveJob({ ...job, jobRunningId: newId }); fixedCount++; } } } return fixedCount; },
  async getJobsForArchive(year: number): Promise<Job[]> { const jobs = await this.getJobs(); return jobs.filter(j => new Date(j.dateReceived).getFullYear() === year); },
  async exportFullSystemBackup(): Promise<string> { const jobs = await this.getJobs(); const technicians = await this.getTechnicians(); const settings = await this.getSettings(); const pmPlans = await this.getPMPlans(); const budgets = await db.budgets.toArray(); const backup = { version: "1.1", timestamp: new Date().toISOString(), data: { jobs, technicians, settings, pmPlans, budgets } }; return JSON.stringify(backup, null, 2); },
  async calculateSmartPMDate(year: number, month: number, plan: Partial<PMPlan>): Promise<string> { const d = new Date(year, month, 1); while (d.getDay() === 0 || d.getDay() === 6) { d.setDate(d.getDate() + 1); } return d.toISOString().split('T')[0]; }
};
