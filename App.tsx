
import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import JobList from './components/JobList';
import JobForm from './components/JobForm';
import History from './components/History';
import Technicians from './components/Technicians';
import EvaluationSummary from './components/EvaluationSummary';
import Settings from './components/Settings';
import ExpenseSummary from './components/ExpenseSummary';
import MonthlyReport from './components/MonthlyReport';
import WorkCalendar from './components/WorkCalendar';
import PMRegistry from './components/PMRegistry';
import DepartmentDashboard from './components/DepartmentDashboard';
import BudgetManager from './components/BudgetManager';
import DepartmentCostSheet from './components/DepartmentCostSheet';
import { Job, Technician, AppSettings, PMPlan, FactoryHoliday, UserRoleProfile, JobStatus } from './types';
import { dataService } from './services/dataService';
import { 
  LayoutDashboard, FileText, Calendar, History as HistoryIcon, 
  Users, Star, Settings as SettingsIcon, LogOut, Menu, X, 
  DollarSign, Activity, ClipboardList, Coins, BarChart3, RefreshCw, FileSpreadsheet
} from 'lucide-react';

const AppContent: React.FC = () => {
  const { user, logout } = useAuth();
  const { notify } = useNotification();
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [pmPlans, setPmPlans] = useState<PMPlan[]>([]);
  const [holidays, setHolidays] = useState<FactoryHoliday[]>([]);
  const [userRoles, setUserRoles] = useState<UserRoleProfile[]>([]);
  const [isJobFormOpen, setIsJobFormOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [jobsData, techsData, settingsData, pmData, holidayData, rolesData] = await Promise.all([
        dataService.getJobs(),
        dataService.getTechnicians(),
        dataService.getSettings(),
        dataService.getPMPlans(),
        dataService.getHolidays(),
        dataService.getUserRoles()
      ]);
      setJobs(jobsData);
      setTechnicians(techsData);
      setSettings(settingsData);
      setPmPlans(pmData);
      setHolidays(holidayData);
      setUserRoles(rolesData);
    } catch (error) {
      console.error("Failed to load data", error);
      notify("โหลดข้อมูลไม่สำเร็จ", "error");
    } finally {
      setIsLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (user) {
      refreshData();
    }
  }, [user, refreshData]);

  const handleSaveJob = async (job: Job) => {
    try {
      await dataService.saveJob(job);
      notify(editingJob ? "อัปเดตงานซ่อมสำเร็จ" : "บันทึกงานซ่อมสำเร็จ", "success");
      setIsJobFormOpen(false);
      setEditingJob(undefined);
      refreshData(); 
    } catch (error) {
      notify("บันทึกข้อมูลไม่สำเร็จ", "error");
    }
  };

  const handleDeleteJob = async (id: string) => {
    try {
      await dataService.deleteJob(id);
      notify("ลบงานซ่อมสำเร็จ", "success");
      refreshData();
    } catch (error) {
      notify("ลบข้อมูลไม่สำเร็จ", "error");
    }
  };

  const hasPermission = (tab: string) => {
    if (!user) return false;
    const role = user.role;
    if (role === 'SYSTEM_ADMIN') return true;
    
    switch (tab) {
      case 'DASHBOARD': case 'REGISTRY': case 'HISTORY': case 'CALENDAR': return true; 
      case 'DEPT_DASHBOARD': case 'PM_PLAN': case 'TECHNICIANS': return role !== 'TECHNICIAN';
      case 'REPORT': case 'EVALUATION': return role === 'HEAD' || role === 'DEPT_ADMIN';
      case 'EXPENSES': case 'BUDGET': case 'DEPT_COST_SHEET': return role === 'DEPT_ADMIN';
      case 'SETTINGS': return false; 
      default: return false;
    }
  };

  if (!user) return <Login />;

  if (isLoading && !settings) return (<div className="min-h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="animate-spin text-brand-600" size={40} /></div>);

  const menuGroups = [
    { title: 'ภาพรวม', items: [ { id: 'DASHBOARD', label: 'ภาพรวมระบบ', icon: LayoutDashboard }, { id: 'DEPT_DASHBOARD', label: 'ภาพรวมแผนก', icon: Activity }, { id: 'REPORT', label: 'รายงาน', icon: BarChart3 } ] },
    { title: 'งานทะเบียน', items: [ { id: 'REGISTRY', label: 'ทะเบียนงาน', icon: FileText }, { id: 'PM_PLAN', label: 'แผน PM', icon: ClipboardList }, { id: 'CALENDAR', label: 'ปฏิทินงาน', icon: Calendar }, { id: 'HISTORY', label: 'ประวัติเครื่องจักร', icon: HistoryIcon } ] },
    { title: 'งานค่าใช้จ่าย', items: [ { id: 'EXPENSES', label: 'ค่าใช้จ่ายใบงาน', icon: DollarSign }, { id: 'BUDGET', label: 'งบประมาณ', icon: Coins }, { id: 'DEPT_COST_SHEET', label: 'บันทึกจ่ายรายวัน', icon: FileSpreadsheet } ] },
    { title: 'พนักงาน', items: [ { id: 'TECHNICIANS', label: 'ข้อมูลช่าง', icon: Users }, { id: 'EVALUATION', label: 'ประเมินผล', icon: Star } ] },
    { title: 'ตั้งค่า', items: [ { id: 'SETTINGS', label: 'ตั้งค่าระบบ', icon: SettingsIcon } ] }
  ];

  const allMenuItems = menuGroups.flatMap(group => group.items);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out flex flex-col h-screen ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:sticky md:top-0 md:translate-x-0`}>
        <div className="p-4 flex justify-between items-center border-b border-slate-700 shrink-0 h-16"><h1 className="text-xl font-bold tracking-wider">MAINTENANCE</h1><button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X size={24} /></button></div>
        <nav className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 space-y-6">
          {menuGroups.map((group, groupIdx) => {
            const visibleItems = group.items.filter(item => hasPermission(item.id));
            if (visibleItems.length === 0) return null;
            return (
              <div key={groupIdx}>
                <h3 className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{group.title}</h3>
                <div className="space-y-1">
                  {visibleItems.map(item => (
                    <button key={item.id} onClick={() => { setActiveTab(item.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm relative ${activeTab === item.id ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                      <item.icon size={18} />{item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700 bg-slate-900 shrink-0">
          <div className="flex items-center gap-3 mb-4 px-2"><div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-xs font-bold shrink-0">{user.username.charAt(0).toUpperCase()}</div><div className="flex-1 min-w-0"><p className="text-sm font-bold truncate">{user.username}</p><p className="text-xs text-slate-400 truncate">{user.role}</p></div></div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition-colors text-sm font-bold"><LogOut size={16} /> ออกจากระบบ</button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden">
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex justify-between items-center sticky top-0 z-40"><div className="flex items-center gap-3"><button onClick={() => setIsSidebarOpen(true)} className="text-slate-600"><Menu size={24} /></button><h1 className="font-bold text-slate-800">{allMenuItems.find(i => i.id === activeTab)?.label || 'Maintenance System'}</h1></div></header>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            {activeTab === 'DASHBOARD' && <Dashboard jobs={jobs} technicians={technicians} companies={settings?.companies} jobTypes={settings?.technicianCategories || []} />}
            {activeTab === 'DEPT_DASHBOARD' && hasPermission('DEPT_DASHBOARD') && settings && <DepartmentDashboard jobs={jobs} divisionMappings={settings.divisionMappings} departmentGroupMappings={settings.departmentGroupMappings} jobTypes={settings.technicianCategories} />}
            {activeTab === 'REGISTRY' && hasPermission('REGISTRY') && settings && <JobList jobs={jobs} onEdit={(job: Job) => { setEditingJob(job); setIsJobFormOpen(true); }} onDelete={handleDeleteJob} onAdd={() => { setEditingJob(undefined); setIsJobFormOpen(true); }} userRole={user.role} technicians={technicians} departments={settings.departments} repairGroups={settings.repairGroups} />}
            {activeTab === 'PM_PLAN' && hasPermission('PM_PLAN') && settings && <PMRegistry pmPlans={pmPlans} departments={settings.departments} refreshData={refreshData} userRole={user.role} pmTypes={settings.pmTypes} jobs={jobs} holidays={holidays} onCreateJob={(plan: PMPlan) => { const newJob: Partial<Job> = { dateReceived: new Date().toISOString().split('T')[0], jobType: plan.type, department: plan.department, assetId: plan.assetId, itemDescription: plan.name, pmPlanId: plan.id, status: JobStatus.IN_PROGRESS }; setEditingJob(newJob as Job); setIsJobFormOpen(true); }} />}
            {activeTab === 'CALENDAR' && hasPermission('CALENDAR') && <WorkCalendar jobs={jobs} holidays={holidays} pmPlans={pmPlans} onJobClick={(job: Job) => { setEditingJob(job); setIsJobFormOpen(true); }} />}
            {activeTab === 'HISTORY' && hasPermission('HISTORY') && <History jobs={jobs} onOpenJob={(job: Job) => { setEditingJob(job); setIsJobFormOpen(true); }} />}
            {activeTab === 'TECHNICIANS' && hasPermission('TECHNICIANS') && settings && <Technicians technicians={technicians} onUpdateTechnician={async (t: Technician) => { await dataService.saveTechnician(t); refreshData(); }} onAddTechnician={async (t: Technician) => { await dataService.saveTechnician(t); refreshData(); }} onDeleteTechnician={async (id: string) => { await dataService.deleteTechnician(id); refreshData(); }} positions={settings.technicianPositions} categories={settings.technicianCategories} userRole={user.role} holidays={holidays} />}
            {activeTab === 'EXPENSES' && hasPermission('EXPENSES') && settings && <ExpenseSummary jobs={jobs} expenseCategories={settings.expenseCategories} departments={settings.departments} companies={settings.companies} jobTypes={settings.technicianCategories} onUpdateJob={handleSaveJob} onEditJob={(job: Job) => { setEditingJob(job); setIsJobFormOpen(true); }} userRole={user.role} divisionMappings={settings.divisionMappings} />}
            {activeTab === 'BUDGET' && hasPermission('BUDGET') && settings && <BudgetManager userRole={user.role} budgetCategories={settings.budgetCategories} />}
            {activeTab === 'DEPT_COST_SHEET' && hasPermission('DEPT_COST_SHEET') && settings && <DepartmentCostSheet userRole={user.role} divisions={settings.divisions || []} />}
            {activeTab === 'REPORT' && hasPermission('REPORT') && settings && <MonthlyReport jobs={jobs} technicians={technicians} departments={settings.departments} companies={settings.companies} jobTypes={settings.technicianCategories} pmPlans={pmPlans} repairGroups={settings.repairGroups} />}
            {activeTab === 'EVALUATION' && hasPermission('EVALUATION') && <EvaluationSummary jobs={jobs} technicians={technicians} />}
            {activeTab === 'SETTINGS' && hasPermission('SETTINGS') && settings && <Settings settings={settings} onSave={async (s: AppSettings) => { await dataService.saveSettings(s); refreshData(); notify('บันทึกการตั้งค่าสำเร็จ', 'success'); }} onRenameJobItem={async (f: keyof Job, o: string, n: string) => { await dataService.bulkUpdateJobField(f, o, n); }} onRenameTechnicianItem={async (f: keyof Technician, o: string, n: string) => { await dataService.bulkUpdateTechnicianField(f, o, n); }} onRenameCostItem={async (f: 'category' | 'company', o: string, n: string) => { await dataService.bulkUpdateCostField(f, o, n); }} onRenamePMType={async (o: string, n: string) => { await dataService.bulkUpdatePMPlanField('type', o, n); }} totalJobs={jobs.length} totalTechnicians={technicians.length} userRole={user.role} userRoles={userRoles} onLoadArchive={(archiveJobs: Job[], source: string) => { setJobs(prev => [...prev, ...archiveJobs]); notify(`โหลดข้อมูลจาก ${source} สำเร็จ (${archiveJobs.length} รายการ)`, 'success'); }} onClearArchive={refreshData} />}
          </div>
        </div>
      </main>
      {isJobFormOpen && settings && (<div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"><div className="w-full max-w-4xl my-auto"><JobForm onSave={handleSaveJob} onCancel={() => { setIsJobFormOpen(false); setEditingJob(undefined); }} technicians={technicians} initialData={editingJob} existingJobs={jobs} departments={settings.departments} expenseCategories={settings.expenseCategories} companies={settings.companies} jobTypes={settings.technicianCategories} readOnly={user.role === 'TECHNICIAN' && editingJob?.status === JobStatus.FINISHED} repairGroups={settings.repairGroups} pmPlans={pmPlans} /></div></div>)}
    </div>
  );
}

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </NotificationProvider>
  );
};

export default App;
