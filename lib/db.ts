
import Dexie from 'dexie';
import { Job, Technician, AppSettings, PMPlan, FactoryHoliday, UserRoleProfile, BudgetItem, DailyExpense, StandardItem } from '../types';

export class MaintenanceDB extends Dexie {
  jobs!: any;
  technicians!: any;
  settings!: any;
  pmPlans!: any;
  holidays!: any;
  userRoles!: any;
  budgets!: any;
  dailyExpenses!: any;
  standardItems!: any;

  constructor() {
    super('MaintenanceRegistryDB');
    
    // Version 1 (Legacy)
    (this as any).version(1).stores({
      jobs: 'id, jobRunningId, dateReceived, status, department, jobType',
      technicians: 'id, firstName, position',
      settings: 'id',
      pmPlans: 'id, nextDueDate, department',
      holidays: 'id, date',
      userRoles: '++id, email',
      budgets: 'id, year, category',
      dailyExpenses: 'id, [year+month], division, budgetId'
    });

    // Version 2: Added standardItems table
    (this as any).version(2).stores({
      jobs: 'id, jobRunningId, dateReceived, status, department, jobType',
      technicians: 'id, firstName, position',
      settings: 'id',
      pmPlans: 'id, nextDueDate, department',
      holidays: 'id, date',
      userRoles: '++id, email',
      budgets: 'id, year, category',
      dailyExpenses: 'id, [year+month], division, budgetId',
      standardItems: 'id, division, category' // New Table
    });
  }
}

export const db = new MaintenanceDB();
