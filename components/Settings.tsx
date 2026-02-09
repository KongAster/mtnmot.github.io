
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppSettings, UserRole, UserRoleProfile, formatUsername, toSystemEmail, ROLE_LABELS } from '../types';
import { 
  Plus, Trash2, List, Briefcase, DollarSign, Lock, 
  Database, HardDrive, Server, Users, UserPlus, RefreshCw, 
  AlertTriangle, User, Building, 
  Edit2, X, Archive, Download, Upload, 
  UploadCloud, Palette, Tag, 
  FileText, Activity, Hash, Wrench, FileArchive, Settings as SettingsIcon, 
  FileJson, PlayCircle, Search, ChevronRight, Layout, Wallet,
  Cloud, Coins, Save, Wrench as WrenchIcon, Factory, Copy, ExternalLink,
  Smartphone, Monitor, Eye, EyeOff
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { dataService } from '../services/dataService';
import { Job, Technician } from '../types';
import { THEME_PALETTES } from '../constants';

interface SettingsProps {
  settings: AppSettings | null;
  onSave: (settings: AppSettings) => void;
  onRenameJobItem: (field: keyof Job, oldValue: string, newValue: string) => Promise<void>;
  onRenameTechnicianItem: (field: keyof Technician, oldValue: string, newValue: string) => Promise<void>;
  onRenameCostItem: (field: 'category' | 'company', oldValue: string, newValue: string) => Promise<void>;
  onRenamePMType: (oldValue: string, newValue: string) => Promise<void>;
  totalJobs: number;
  totalTechnicians: number;
  userRole?: UserRole;
  userRoles: UserRoleProfile[]; 
  onLoadArchive?: (jobs: Job[], source: string) => void; 
  onClearArchive?: () => void; 
}

const ListHeader = ({ title, icon, count, search, onSearchChange }: any) => (
    <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                {icon} {title}
            </div>
            <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">{count} Items</span>
        </div>
        <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14}/>
            <input 
                type="text" 
                placeholder={`ค้นหาใน ${title}...`}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all"
                value={search}
                onChange={e => onSearchChange(e.target.value)}
            />
        </div>
    </div>
);

// Define Modal Configuration Type
type ModalConfig = {
    type: 'DEPT' | 'CAT' | 'EXP' | 'PM' | 'COMP' | 'BUDGET' | 'GROUP' | 'FACTORY' | 'DIVISION';
    title: string;
    hasCode?: boolean; // Whether it has a secondary code/prefix field
    codeLabel?: string;
    placeholderName?: string;
    placeholderCode?: string;
};

const Settings: React.FC<SettingsProps> = ({ 
    settings, 
    onSave, 
    onRenameJobItem, 
    onRenameTechnicianItem, 
    onRenameCostItem,
    onRenamePMType,
    totalJobs, 
    totalTechnicians, 
    userRole, 
    userRoles,
    onLoadArchive,
    onClearArchive
}) => {
  const { updatePassword, user } = useAuth();
  const { notify } = useNotification();
  const [localSettings, setLocalSettings] = useState<AppSettings | null>(null);
  const [activeTab, setActiveTab] = useState('DASHBOARD'); 
  const [newPassword, setNewPassword] = useState('');
  
  const [archiveYear, setArchiveYear] = useState<number>(new Date().getFullYear() - 1);
  const archiveInputRef = useRef<HTMLInputElement>(null);
  
  // User Management State
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('TECHNICIAN');
  const [isProcessingUser, setIsProcessingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRoleProfile | null>(null);

  // -- Generic Modal State --
  const [activeModal, setActiveModal] = useState<ModalConfig | null>(null);
  const [tempName, setTempName] = useState('');
  const [tempCode, setTempCode] = useState('');

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isFixingDuplicates, setIsFixingDuplicates] = useState(false);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);
  const [storageStats, setStorageStats] = useState<{formatted: string, breakdown: any} | null>(null);

  const [deptSearch, setDeptSearch] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [pmTypeSearch, setPmTypeSearch] = useState('');
  const [compSearch, setCompSearch] = useState('');
  const [expCatSearch, setExpCatSearch] = useState('');
  const [budgetCatSearch, setBudgetCatSearch] = useState(''); 
  const [groupSearch, setGroupSearch] = useState('');
  const [factorySearch, setFactorySearch] = useState('');
  const [divisionSearch, setDivisionSearch] = useState('');

  useEffect(() => {
      if (settings) setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
      const fetchStats = async () => {
          const stats = await dataService.getSystemUsageStats();
          setStorageStats(stats);
      };
      if (activeTab === 'DASHBOARD') fetchStats();
  }, [activeTab, totalJobs, totalTechnicians]);

  // -- Modal Helper --
  const openModal = (config: ModalConfig) => {
      setActiveModal(config);
      setTempName('');
      setTempCode('');
  };

  const closeModal = () => {
      setActiveModal(null);
      setTempName('');
      setTempCode('');
  };

  // ... (User Management Handlers omitted for brevity, same as original) ...
  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
        notify('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร', 'error');
        return;
    }
    try {
        await updatePassword(newPassword);
        setNewPassword('');
    } catch (err: any) {
        notify(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน', 'error');
    }
  };

  const handleSaveUser = async () => {
      if (!newUserEmail.trim()) return;
      setIsProcessingUser(true);
      try {
          const authEmail = toSystemEmail(newUserEmail.trim()).toLowerCase();
          await dataService.saveUserRole({ email: authEmail, role: newUserRole });
          if (editingUser) notify(`แก้ไขสิทธิ์ผู้ใช้ ${newUserEmail} สำเร็จ`, 'success');
          else notify(`เพิ่มสิทธิ์ผู้ใช้ ${newUserEmail} สำเร็จ`, 'success');
          setNewUserEmail('');
          setEditingUser(null);
          setNewUserRole('TECHNICIAN');
      } catch (e) {
          notify('เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้', 'error');
      } finally {
          setIsProcessingUser(false);
      }
  };

  const handleEditUserClick = (roleProfile: UserRoleProfile) => {
      setEditingUser(roleProfile);
      setNewUserEmail(formatUsername(roleProfile.email));
      setNewUserRole(roleProfile.role);
  };

  const handleCancelEditUser = () => {
      setEditingUser(null);
      setNewUserEmail('');
      setNewUserRole('TECHNICIAN');
  };

  const handleDeleteUser = async (email: string) => {
      if (window.confirm(`ยืนยันการลบสิทธิ์ของผู้ใช้ ${formatUsername(email)}?`)) {
          try {
              await dataService.deleteUserRole(email);
              notify('ลบสิทธิ์ผู้ใช้เรียบร้อยแล้ว', 'success');
              if (editingUser?.email === email) handleCancelEditUser();
          } catch (e) {
              notify('เกิดข้อผิดพลาดในการลบสิทธิ์ผู้ใช้', 'error');
          }
      }
  };

  const handleSaveModalItem = () => {
      if (!localSettings || !activeModal) return;
      if (!tempName.trim()) {
          alert("กรุณากรอกชื่อรายการ");
          return;
      }

      if (activeModal.hasCode && !tempCode.trim()) {
          alert(`กรุณากรอก${activeModal.codeLabel}`);
          return;
      }

      const val = tempName.trim();
      const code = tempCode.trim().toUpperCase();

      switch (activeModal.type) {
          case 'DEPT': {
              const fullName = `${val} (${code})`;
              updateList('departments', [...(localSettings.departments || []), fullName]);
              break;
          }
          case 'CAT': {
              updateList('technicianCategories', [...(localSettings.technicianCategories || []), val]);
              // Also update division mapping default
              const newMappings = { ...localSettings.divisionMappings, [val]: 'MTN' as 'MTN' };
              updateDivisionMapping(newMappings);
              break;
          }
          case 'EXP': {
              updateList('expenseCategories', [...(localSettings.expenseCategories || []), val]);
              break;
          }
          case 'PM': {
              updateList('pmTypes', [...(localSettings.pmTypes || []), val]);
              break;
          }
          case 'COMP': {
              updateList('companies', [...(localSettings.companies || []), val]);
              break;
          }
          case 'BUDGET': {
              updateList('budgetCategories', [...(localSettings.budgetCategories || []), val]);
              break;
          }
          case 'GROUP': {
              updateList('repairGroups', [...(localSettings.repairGroups || []), val]);
              break;
          }
          case 'FACTORY': {
              updateList('factoryGroups', [...(localSettings.factoryGroups || []), val]);
              break;
          }
          case 'DIVISION': {
              const newDiv = { name: val, code: code };
              const currentDivs = localSettings.divisions || [];
              const updated = { ...localSettings, divisions: [...currentDivs, newDiv] };
              setLocalSettings(updated);
              onSave(updated);
              break;
          }
      }
      closeModal();
  };

  // ... (Other handlers: RecalculatePM, FixDuplicates, Archive, etc. same as original) ...
  const handleRecalculatePM = async () => {
      setIsRecalculating(true);
      try {
          const count = await dataService.recalculateAllPMDates();
          notify(`ปรับปรุงวันที่ PM สำเร็จ (${count} รายการ)`, 'success');
      } catch (e) {
          notify('เกิดข้อผิดพลาดในการคำนวณวัน PM', 'error');
      } finally {
          setIsRecalculating(false);
      }
  };

  const handleFixDuplicates = async () => {
      if (!window.confirm("ยืนยันการตรวจสอบและแก้ไขเลขที่ใบงานซ้ำ?")) return;
      setIsFixingDuplicates(true);
      try {
          const count = await dataService.fixDuplicateJobIds();
          if (count > 0) notify(`แก้ไขเลขที่ใบงานซ้ำสำเร็จ ทั้งหมด ${count} รายการ`, 'success');
          else notify("ไม่พบเลขที่ใบงานซ้ำในระบบ", "info");
      } catch (e) {
          notify("เกิดข้อผิดพลาดในการแก้ไขรหัสซ้ำ", "error");
      } finally {
          setIsFixingDuplicates(false);
      }
  };

  const handleArchiveYear = async () => {
      if (!window.confirm(`ยืนยันการย้ายข้อมูลปี ${archiveYear + 543} ออกจากฐานข้อมูล?`)) return;
      try {
          const jobsToArchive = await dataService.getJobsForArchive(archiveYear);
          if (jobsToArchive.length === 0) {
              notify(`ไม่พบข้อมูลปี ${archiveYear + 543} ในระบบ`, 'info');
              return;
          }
          const dataStr = JSON.stringify(jobsToArchive, null, 2);
          const blob = new Blob([dataStr], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `maintenance_archive_${archiveYear + 543}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          const count = await dataService.deleteJobsByPeriod(archiveYear, -1);
          notify(`ย้ายข้อมูลสำเร็จ (${count} รายการ)`, 'success');
      } catch (e) {
          notify('เกิดข้อผิดพลาดในการ Archive ข้อมูล', 'error');
      }
  };

  const handleLoadArchiveFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !onLoadArchive) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const content = evt.target?.result as string;
              const archivedJobs = JSON.parse(content);
              if (Array.isArray(archivedJobs)) onLoadArchive(archivedJobs, file.name);
              else throw new Error("Invalid format");
          } catch (err) {
              notify('ไฟล์ข้อมูลไม่ถูกต้อง', 'error');
          }
      };
      reader.readAsText(file);
      if (archiveInputRef.current) archiveInputRef.current.value = '';
  };

  const updateList = (key: keyof AppSettings, newList: any) => {
      if (localSettings) {
          const updated = { ...localSettings, [key]: newList };
          setLocalSettings(updated);
          onSave(updated); 
      }
  };

  const updateDivisionMapping = (newMapping: Record<string, 'MTN' | 'MOT'>) => {
      if (localSettings) {
          const updated = { ...localSettings, divisionMappings: newMapping };
          setLocalSettings(updated);
          onSave(updated);
      }
  };

  const handleUpdateDeptGroup = (deptName: string, groupName: string) => {
      if (localSettings) {
          const newMap = { ...localSettings.departmentGroupMappings, [deptName]: groupName };
          const updated = { ...localSettings, departmentGroupMappings: newMap };
          setLocalSettings(updated);
          onSave(updated);
      }
  };

  const handleRename = async (
      key: keyof AppSettings, 
      oldVal: string, 
      newVal: string, 
      renameFn: (o: string, n: string) => Promise<void>
  ) => {
      if (localSettings && localSettings[key]) {
          const list = localSettings[key] as string[];
          if (list.includes(newVal)) {
              alert('ชื่อนี้มีอยู่แล้วในระบบ');
              return;
          }
          if (window.confirm(`ต้องการเปลี่ยนชื่อ "${oldVal}" เป็น "${newVal}" ใช่หรือไม่?\n(ข้อมูลใบงานเก่าทั้งหมดจะถูกอัปเดตตามอัตโนมัติ)`)) {
              setIsProcessingBulk(true);
              try {
                  await renameFn(oldVal, newVal);
                  const updatedList = list.map(item => item === oldVal ? newVal : item);
                  updateList(key, updatedList);
                  
                  // If renaming category, update division mapping key too
                  if (key === 'technicianCategories' && localSettings.divisionMappings) {
                      const newMap = { ...localSettings.divisionMappings };
                      if (newMap[oldVal]) {
                          newMap[newVal] = newMap[oldVal];
                          delete newMap[oldVal];
                          updateDivisionMapping(newMap);
                      }
                  }

              } catch (e) {
                  notify('เกิดข้อผิดพลาดในการเปลี่ยนชื่อข้อมูล', 'error');
              } finally {
                  setIsProcessingBulk(false);
              }
          }
      }
  };

  const filteredDepts = useMemo(() => (localSettings?.departments || []).filter(d => d.toLowerCase().includes(deptSearch.toLowerCase())), [localSettings, deptSearch]);
  const filteredCats = useMemo(() => (localSettings?.technicianCategories || []).filter(c => c.toLowerCase().includes(catSearch.toLowerCase())), [localSettings, catSearch]);
  const filteredPMTypes = useMemo(() => (localSettings?.pmTypes || []).filter(t => t.toLowerCase().includes(pmTypeSearch.toLowerCase())), [localSettings, pmTypeSearch]);
  const filteredComps = useMemo(() => (localSettings?.companies || []).filter(c => c.toLowerCase().includes(compSearch.toLowerCase())), [localSettings, compSearch]);
  const filteredExpCats = useMemo(() => (localSettings?.expenseCategories || []).filter(c => c.toLowerCase().includes(expCatSearch.toLowerCase())), [localSettings, expCatSearch]);
  const filteredBudgetCats = useMemo(() => (localSettings?.budgetCategories || []).filter(c => c.toLowerCase().includes(budgetCatSearch.toLowerCase())), [localSettings, budgetCatSearch]);
  const filteredGroups = useMemo(() => (localSettings?.repairGroups || []).filter(c => c.toLowerCase().includes(groupSearch.toLowerCase())), [localSettings, groupSearch]);
  const filteredFactories = useMemo(() => (localSettings?.factoryGroups || []).filter(c => c.toLowerCase().includes(factorySearch.toLowerCase())), [localSettings, factorySearch]);
  const filteredDivisions = useMemo(() => (localSettings?.divisions || []).filter(c => c.name.toLowerCase().includes(divisionSearch.toLowerCase()) || c.code.toLowerCase().includes(divisionSearch.toLowerCase())), [localSettings, divisionSearch]);

  const handleExportFullSettings = () => {
      if (!localSettings) return;
      const dataStr = JSON.stringify(localSettings, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `maintenance_settings_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notify('ส่งออกไฟล์การตั้งค่าสำเร็จ (Config Only)', 'success');
  };

  const handleExportFullSystem = async () => {
      try {
          const fullData = await dataService.exportFullSystemBackup();
          const blob = new Blob([fullData], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `full_system_backup_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          notify('สำรองข้อมูลทั้งระบบสำเร็จ (Full Backup)', 'success');
      } catch (e) {
          notify('ไม่สามารถสำรองข้อมูลได้', 'error');
      }
  };

  if (!localSettings) return <div className="flex items-center justify-center p-20"><RefreshCw className="animate-spin text-brand-600" /></div>;

  const NavItem = ({ id, icon: Icon, label }: any) => (
      <button 
        onClick={() => setActiveTab(id)}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all
            ${activeTab === id ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
      >
          <Icon size={18} />
          <span>{label}</span>
          {activeTab === id && <ChevronRight size={14} className="ml-auto opacity-50"/>}
      </button>
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 animate-fade-in pb-12 items-start">
        
        {/* Left Sidebar Menu */}
        <aside className="w-full md:w-64 shrink-0 space-y-2 bg-white p-3 rounded-2xl shadow-sm border border-slate-100 sticky top-0">
            <div className="px-4 py-4 border-b border-slate-50 mb-2">
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <SettingsIcon size={20} className="text-brand-600"/> การตั้งค่า
                </h2>
            </div>
            <NavItem id="DASHBOARD" icon={Layout} label="สรุปสถานะระบบ" />
            <NavItem id="ACCOUNT" icon={User} label="บัญชีผู้ใช้" />
            <NavItem id="MASTER_DATA" icon={Database} label="ข้อมูลหลัก (Master)" />
            <NavItem id="USER_MANAGEMENT" icon={Users} label="จัดการสิทธิ์" />
            <NavItem id="TOOLS" icon={Wrench} label="เครื่องมือดูแลระบบ" />
        </aside>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0">
            
            {/* 1. DASHBOARD TAB */}
            {activeTab === 'DASHBOARD' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div className="p-3 bg-brand-50 text-brand-600 rounded-xl"><FileText size={24}/></div>
                            <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ใบงานรวม</p><h3 className="text-2xl font-black text-slate-800">{totalJobs.toLocaleString()}</h3></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={24}/></div>
                            <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ทีมช่าง</p><h3 className="text-2xl font-black text-slate-800">{totalTechnicians.toLocaleString()}</h3></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl"><HardDrive size={24}/></div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ความจุข้อมูล</p>
                                <h3 className="text-2xl font-black text-slate-800">{storageStats?.formatted || '...'}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Server size={24}/></div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">สถานะ Server</p>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-sm font-bold text-emerald-600">{isSupabaseConfigured() ? 'Online' : 'Offline'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-5 text-slate-900"><Activity size={120}/></div>
                            <div className="relative z-10">
                                <h3 className="text-xl font-black text-slate-800 mb-2">ข้อมูลระบบพื้นฐาน</h3>
                                <p className="text-slate-500 text-sm mb-6">โครงสร้างข้อมูลหลักที่ใช้ขับเคลื่อนระบบงานซ่อมบำรุง</p>
                                <div className="grid grid-cols-2 gap-6 border-t border-slate-50 pt-6">
                                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">หมวดงาน</p><p className="font-bold text-slate-700">{(localSettings.technicianCategories || []).length} หมวด</p></div>
                                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">จำนวนแผนก</p><p className="font-bold text-slate-700">{(localSettings.departments || []).length} แผนก</p></div>
                                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ประเภท PM</p><p className="font-bold text-slate-700">{(localSettings.pmTypes || []).length} รายการ</p></div>
                                    <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">บริษัทในเครือ</p><p className="font-bold text-slate-700">{(localSettings.companies || []).length} แห่ง</p></div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                            <h3 className="text-xl font-black text-slate-800 mb-2">รายละเอียดความจุข้อมูล</h3>
                            <p className="text-slate-500 text-sm mb-6">สัดส่วนพื้นที่จัดเก็บในระบบ (Estimated Size)</p>
                            <div className="space-y-4 flex-1">
                                {storageStats?.breakdown && Object.entries(storageStats.breakdown).map(([key, val]: [string, any]) => (
                                    <div key={key}>
                                        <div className="flex justify-between text-[11px] font-bold text-slate-500 uppercase mb-1">
                                            <span>{key === 'pmPlans' ? 'PM Schedule' : key === 'jobs' ? 'Job Registry' : key === 'settings' ? 'System Config' : key}</span>
                                            <span>{(val / 1024).toFixed(1)} KB</span>
                                        </div>
                                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-brand-500 h-full transition-all duration-1000" 
                                                style={{ width: `${Math.min(100, (val / (storageStats as any).totalBytes) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. ACCOUNT TAB - (Omitted for brevity, assumed same) */}
            {activeTab === 'ACCOUNT' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-50 pb-4">
                            <Lock size={20} className="text-brand-600"/> ข้อมูลบัญชีผู้ใช้
                        </h3>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
                                <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-brand-500/30 uppercase">
                                    {user?.username.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Logged in as</p>
                                    <h4 className="text-xl font-black text-slate-800">{user?.username}</h4>
                                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black mt-1 inline-block uppercase tracking-wider">{ROLE_LABELS[user?.role || 'TECHNICIAN']}</span>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">เปลี่ยนชื่อผู้ใช้ใหม่</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            disabled={true} 
                                            className="flex-1 px-4 py-2.5 border rounded-xl text-sm outline-none bg-slate-100 text-slate-500 cursor-not-allowed" 
                                            value={user?.username}
                                            title="ไม่สามารถเปลี่ยนชื่อผู้ใช้งานได้"
                                        />
                                    </div>
                                    <p className="text-[10px] text-red-400 mt-1">*ไม่อนุญาตให้แก้ไขชื่อผู้ใช้งาน</p>
                                </div>
                                <div>
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">เปลี่ยนรหัสผ่าน</label>
                                    <div className="flex gap-2">
                                        <input type="password" minLength={6} className="flex-1 px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500" placeholder="รหัสผ่านใหม่ (6+ ตัวอักษร)" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                                        <button onClick={handleUpdatePassword} className="bg-slate-900 text-white px-6 rounded-xl text-xs font-bold hover:bg-black transition-all">บันทึก</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-3 border-b border-slate-50 pb-4">
                            <Palette size={20} className="text-purple-600"/> ปรับแต่งอินเทอร์เฟซ (Theming)
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.entries(THEME_PALETTES).map(([key, palette]) => (
                                <button 
                                    key={key} 
                                    onClick={() => { const updated = { ...localSettings, themeColor: key }; setLocalSettings(updated); onSave(updated); }} 
                                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-all text-left group
                                        ${localSettings.themeColor === key ? 'border-brand-500 bg-brand-50/30 ring-1 ring-brand-200 shadow-sm' : 'border-slate-100 hover:border-slate-200'}`}
                                >
                                    <div className="w-10 h-10 rounded-xl shadow-sm shrink-0 border-2 border-white" style={{ backgroundColor: palette.colors[500] }}></div>
                                    <div>
                                        <p className={`text-[13px] font-black leading-none ${localSettings.themeColor === key ? 'text-brand-900' : 'text-slate-600'}`}>{palette.name.split(' ')[0]}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Select Palette</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. MASTER DATA TAB */}
            {activeTab === 'MASTER_DATA' && (
                <div className="space-y-6">
                    {isProcessingBulk && (
                        <div className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg flex items-center justify-center gap-3 animate-pulse sticky top-4 z-50">
                            <RefreshCw className="animate-spin" size={18}/>
                            <span className="text-sm font-bold">ระบบกำลังประมวลผลเปลี่ยนชื่อข้อมูลในใบงานทั้งหมด...</span>
                        </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Categories & Division Mapping */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                            <ListHeader title="หมวดงานช่าง (Job Categories)" icon={<Briefcase size={18} className="text-indigo-600"/>} count={(localSettings.technicianCategories || []).length} search={catSearch} onSearchChange={setCatSearch} />
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredCats.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700 truncate">{item}</span>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Division:</span>
                                                <select 
                                                    className="text-[10px] font-bold bg-white border border-slate-200 rounded px-1 py-0.5 outline-none cursor-pointer hover:border-brand-400 focus:ring-1 focus:ring-brand-500"
                                                    value={localSettings.divisionMappings?.[item] || 'MTN'}
                                                    onChange={(e) => {
                                                        const newVal = e.target.value as 'MTN' | 'MOT';
                                                        updateDivisionMapping({ ...localSettings.divisionMappings, [item]: newVal });
                                                    }}
                                                >
                                                    <option value="MTN">MTN (ซ่อมบำรุง)</option>
                                                    <option value="MOT">MOT (ยานยนต์)</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => {
                                                const newVal = prompt(`เปลี่ยนชื่อหมวดงาน: "${item}" เป็น:`, item);
                                                if (newVal && newVal.trim() !== item) handleRename('technicianCategories', item, newVal.trim(), async (oldV, newV) => { 
                                                    await onRenameJobItem('jobType', oldV, newV); 
                                                    await onRenameTechnicianItem('category', oldV, newV); 
                                                });
                                            }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg"><Edit2 size={14}/></button>
                                            <button onClick={() => updateList('technicianCategories', localSettings.technicianCategories.filter(d => d !== item))} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <button 
                                    onClick={() => openModal({ type: 'CAT', title: 'เพิ่มหมวดงานช่างใหม่', placeholderName: 'เช่น ไฟฟ้า' })}
                                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black flex items-center justify-center gap-2"
                                >
                                    <Plus size={16}/> เพิ่มหมวดงาน
                                </button>
                            </div>
                        </div>

                        {/* Departments */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                            <ListHeader title="แผนก (Departments)" icon={<Building size={18} className="text-sky-600"/>} count={(localSettings.departments || []).length} search={deptSearch} onSearchChange={setDeptSearch} />
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredDepts.map((item, idx) => (
                                    <div key={idx} className="flex flex-col p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-bold text-slate-700 truncate">{item}</span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                <button onClick={() => {
                                                    const newVal = prompt(`เปลี่ยนชื่อแผนก: "${item}" เป็น:`, item);
                                                    if (newVal && newVal.trim() !== item) handleRename('departments', item, newVal.trim(), async (o, n) => { await onRenameJobItem('department', o, n); });
                                                }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg"><Edit2 size={14}/></button>
                                                <button onClick={() => updateList('departments', localSettings.departments.filter(d => d !== item))} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Group:</span>
                                            <select 
                                                className="text-[10px] font-bold bg-white border border-slate-200 rounded px-1 py-0.5 outline-none cursor-pointer hover:border-brand-400 w-full max-w-[150px]"
                                                value={localSettings.departmentGroupMappings?.[item] || ''}
                                                onChange={(e) => handleUpdateDeptGroup(item, e.target.value)}
                                            >
                                                <option value="">-- ไม่ระบุ --</option>
                                                {(localSettings.factoryGroups || []).map(g => <option key={g} value={g}>{g}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <button 
                                    onClick={() => openModal({ type: 'DEPT', title: 'เพิ่มแผนกใหม่', hasCode: true, codeLabel: 'รหัสย่อ (Code)', placeholderName: 'เช่น แผนกบัญชี', placeholderCode: 'เช่น ACC' })} 
                                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black flex items-center justify-center gap-2"
                                >
                                    <Plus size={16}/> เพิ่มแผนกใหม่
                                </button>
                            </div>
                        </div>

                        {/* Factory Groups (New) */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                            <ListHeader title="กลุ่มโรงงาน (Factory Groups)" icon={<Factory size={18} className="text-slate-600"/>} count={(localSettings.factoryGroups || []).length} search={factorySearch} onSearchChange={setFactorySearch} />
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredFactories.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                        <span className="text-sm font-bold text-slate-700 truncate">{item}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => updateList('factoryGroups', localSettings.factoryGroups?.filter(d => d !== item))} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <button 
                                    onClick={() => openModal({ type: 'FACTORY', title: 'เพิ่มกลุ่มโรงงาน', placeholderName: 'เช่น โรงงาน 101' })} 
                                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black flex items-center justify-center gap-2"
                                >
                                    <Plus size={16}/> เพิ่มกลุ่มโรงงาน
                                </button>
                            </div>
                        </div>

                        {/* Divisions (New) */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                            <ListHeader title="หน่วยงาน (Divisions)" icon={<Activity size={18} className="text-rose-600"/>} count={(localSettings.divisions || []).length} search={divisionSearch} onSearchChange={setDivisionSearch} />
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredDivisions.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-700">{item.name}</span>
                                            <span className="text-[10px] font-mono text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200 w-fit mt-1">CODE: {item.code}</span>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => {
                                                const current = localSettings.divisions || [];
                                                const updated = current.filter(d => d.code !== item.code);
                                                const newSettings = { ...localSettings, divisions: updated };
                                                setLocalSettings(newSettings);
                                                onSave(newSettings);
                                            }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <button 
                                    onClick={() => openModal({ type: 'DIVISION', title: 'เพิ่มหน่วยงาน', hasCode: true, codeLabel: 'รหัสเอกสาร (Prefix)', placeholderName: 'เช่น เทคโนโลยีสารสนเทศ', placeholderCode: 'IT' })} 
                                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black flex items-center justify-center gap-2"
                                >
                                    <Plus size={16}/> เพิ่มหน่วยงาน
                                </button>
                            </div>
                        </div>

                        {/* Repair Groups */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                            <ListHeader title="กลุ่มงานซ่อม" icon={<WrenchIcon size={18} className="text-amber-600"/>} count={(localSettings.repairGroups || []).length} search={groupSearch} onSearchChange={setGroupSearch} />
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredGroups.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                        <span className="text-sm font-bold text-slate-700 truncate">{item}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => {
                                                const newVal = prompt(`เปลี่ยนชื่อกลุ่มงาน: "${item}" เป็น:`, item);
                                                if (newVal && newVal.trim() !== item) handleRename('repairGroups', item, newVal.trim(), async (o, n) => { await onRenameJobItem('repairGroup', o, n); });
                                            }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg"><Edit2 size={14}/></button>
                                            <button onClick={() => updateList('repairGroups', localSettings.repairGroups.filter(d => d !== item))} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <button 
                                    onClick={() => openModal({ type: 'GROUP', title: 'เพิ่มกลุ่มงานใหม่', placeholderName: 'เช่น ซ่อมบำรุงทั่วไป' })} 
                                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black flex items-center justify-center gap-2"
                                >
                                    <Plus size={16}/> เพิ่มกลุ่มงาน
                                </button>
                            </div>
                        </div>

                        {/* Expense Categories */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                            <ListHeader title="หมวดค่าใช้จ่าย" icon={<Wallet size={18} className="text-purple-600"/>} count={(localSettings.expenseCategories || []).length} search={expCatSearch} onSearchChange={setExpCatSearch} />
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredExpCats.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                        <span className="text-sm font-bold text-slate-700 truncate">{item}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => {
                                                const newVal = prompt(`เปลี่ยนชื่อหมวดจ่าย: "${item}" เป็น:`, item);
                                                if (newVal && newVal.trim() !== item) handleRename('expenseCategories', item, newVal.trim(), async (oldV, newV) => { await onRenameCostItem('category', oldV, newV); });
                                            }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg"><Edit2 size={14}/></button>
                                            <button onClick={() => updateList('expenseCategories', localSettings.expenseCategories.filter(d => d !== item))} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <button 
                                    onClick={() => openModal({ type: 'EXP', title: 'เพิ่มหมวดค่าใช้จ่ายใหม่', placeholderName: 'เช่น ค่าซ่อมบำรุงทั่วไป' })}
                                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black flex items-center justify-center gap-2"
                                >
                                    <Plus size={16}/> เพิ่มหมวดจ่าย
                                </button>
                            </div>
                        </div>

                        {/* PM Types */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                            <ListHeader title="ประเภททรัพย์สิน (PM)" icon={<Tag size={18} className="text-orange-600"/>} count={(localSettings.pmTypes || []).length} search={pmTypeSearch} onSearchChange={setPmTypeSearch} />
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredPMTypes.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                        <span className="text-sm font-bold text-slate-700 truncate">{item}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => {
                                                const newVal = prompt(`เปลี่ยนชื่อประเภททรัพย์สิน: "${item}" เป็น:`, item);
                                                if (newVal && newVal.trim() !== item) handleRename('pmTypes', item, newVal.trim(), async (oldV, newV) => { await onRenamePMType(oldV, newV); });
                                            }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg"><Edit2 size={14}/></button>
                                            <button onClick={() => updateList('pmTypes', (localSettings.pmTypes || []).filter(d => d !== item))} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <button 
                                    onClick={() => openModal({ type: 'PM', title: 'เพิ่มประเภททรัพย์สิน (PM) ใหม่', placeholderName: 'เช่น เครื่องปรับอากาศ' })}
                                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black flex items-center justify-center gap-2"
                                >
                                    <Plus size={16}/> เพิ่มประเภท
                                </button>
                            </div>
                        </div>

                        {/* Companies */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                            <ListHeader title="บริษัทในเครือ" icon={<Building size={18} className="text-blue-600"/>} count={(localSettings.companies || []).length} search={compSearch} onSearchChange={setCompSearch} />
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredComps.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                        <span className="text-sm font-bold text-slate-700 truncate">{item}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => {
                                                const newVal = prompt(`เปลี่ยนชื่อบริษัท: "${item}" เป็น:`, item);
                                                if (newVal && newVal.trim() !== item) handleRename('companies', item, newVal.trim(), async (oldV, newV) => { await onRenameCostItem('company', oldV, newV); });
                                            }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg"><Edit2 size={14}/></button>
                                            <button onClick={() => updateList('companies', localSettings.companies.filter(d => d !== item))} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                                {filteredComps.length === 0 && <div className="text-center py-10 text-slate-400 text-xs italic">ไม่พบข้อมูลบริษัท</div>}
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <button 
                                    onClick={() => openModal({ type: 'COMP', title: 'เพิ่มบริษัทใหม่', placeholderName: 'เช่น BWG' })}
                                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black flex items-center justify-center gap-2"
                                >
                                    <Plus size={16}/> เพิ่มบริษัท
                                </button>
                            </div>
                        </div>

                        {/* Budget Categories */}
                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                            <ListHeader title="หมวดงบประมาณ" icon={<Coins size={18} className="text-emerald-600"/>} count={(localSettings.budgetCategories || []).length} search={budgetCatSearch} onSearchChange={setBudgetCatSearch} />
                            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                {filteredBudgetCats.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl group hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
                                        <span className="text-sm font-bold text-slate-700 truncate">{item}</span>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => {
                                                const newVal = prompt(`เปลี่ยนชื่อหมวดงบประมาณ: "${item}" เป็น:`, item);
                                                // Note: Currently renaming budget category doesn't trigger bulk update on budgets data yet
                                                if(newVal && newVal.trim() !== item) updateList('budgetCategories', (localSettings.budgetCategories || []).map(c => c === item ? newVal.trim() : c));
                                            }} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg"><Edit2 size={14}/></button>
                                            <button onClick={() => updateList('budgetCategories', (localSettings.budgetCategories || []).filter(d => d !== item))} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-slate-50">
                                <button 
                                    onClick={() => openModal({ type: 'BUDGET', title: 'เพิ่มหมวดงบประมาณใหม่', placeholderName: 'เช่น หมวด 1 อุปกรณ์เครื่องจักร' })}
                                    className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black flex items-center justify-center gap-2"
                                >
                                    <Plus size={16}/> เพิ่มหมวดงบประมาณ
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* ... (USER MANAGEMENT and TOOLS tabs same as before) ... */}
            {activeTab === 'USER_MANAGEMENT' && (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    {/* ... (Existing User Management Code) ... */}
                    <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-6">
                        <div>
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                                <Users size={24} className="text-blue-600"/> จัดการสิทธิ์ผู้ใช้งาน
                            </h3>
                            <p className="text-slate-500 text-sm mt-1">กำหนดระดับการเข้าถึงระบบตามหน้าที่ของพนักงาน</p>
                        </div>
                        <div className="text-xs font-black text-slate-400 bg-slate-50 px-4 py-1.5 rounded-full border tracking-widest uppercase">
                            Total: {userRoles.length} Users
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT: FORM */}
                        <div className="lg:col-span-4 bg-slate-50 p-6 rounded-2xl border border-slate-200 h-fit">
                            <h4 className="font-black text-slate-700 mb-6 flex items-center gap-2 uppercase tracking-tighter text-sm">
                                {editingUser ? <Edit2 size={18} className="text-brand-600"/> : <UserPlus size={18}/>} 
                                {editingUser ? 'แก้ไขสิทธิ์การใช้งาน' : 'จัดการข้อมูลผู้ใช้'}
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">ชื่อผู้ใช้งาน (Username)</label>
                                    <input 
                                        className={`w-full px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 ${editingUser ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                                        placeholder="เช่น User" 
                                        value={newUserEmail} 
                                        onChange={e => setNewUserEmail(e.target.value)} 
                                        disabled={!!editingUser}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">ระดับสิทธิ์การเข้าถึง</label>
                                    <select className="w-full px-4 py-2.5 border rounded-xl text-sm outline-none bg-white font-bold text-slate-700" value={newUserRole} onChange={e => setNewUserRole(e.target.value as UserRole)}>
                                        <option value="TECHNICIAN">Technician (ดูรายการ)</option>
                                        <option value="HEAD">Head (จัดการงาน/ช่าง)</option>
                                        <option value="DEPT_ADMIN">Dept Admin (รายงาน/ค่าใช้จ่าย)</option>
                                        <option value="SYSTEM_ADMIN">System Admin (สูงสุด)</option>
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    {editingUser && (
                                        <button onClick={handleCancelEditUser} className="flex-1 bg-white border border-slate-300 text-slate-600 py-3 rounded-xl font-bold text-xs hover:bg-slate-50 transition-all">
                                            ยกเลิก
                                        </button>
                                    )}
                                    <button onClick={handleSaveUser} disabled={isProcessingUser} className="flex-[2] bg-brand-600 text-white py-3 rounded-xl font-black text-sm hover:bg-brand-700 disabled:opacity-70 flex justify-center shadow-lg shadow-brand-500/30 transition-all active:scale-95">
                                        {isProcessingUser ? <RefreshCw size={18} className="animate-spin"/> : (editingUser ? 'บันทึกการแก้ไข' : 'เพิ่มสิทธิ์ใหม่')}
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        {/* RIGHT: TABLE */}
                        <div className="lg:col-span-8 overflow-hidden border border-slate-200 rounded-2xl">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                                    <tr><th className="px-6 py-4">Username</th><th className="px-6 py-4">Role Access</th><th className="px-6 py-4 text-right">Action</th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {userRoles.map((role) => (
                                        <tr key={role.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-700">{formatUsername(role.email)}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-lg text-[11px] font-black border uppercase tracking-tighter
                                                    ${role.role === 'SYSTEM_ADMIN' ? 'bg-purple-100 text-purple-700 border-purple-200' : 
                                                      role.role === 'DEPT_ADMIN' ? 'bg-blue-100 text-blue-700 border-blue-200' : 
                                                      role.role === 'HEAD' ? 'bg-orange-100 text-orange-700 border-orange-200' : 
                                                      'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                    {ROLE_LABELS[role.role]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {role.email.includes('dev') ? 
                                                    <span className="text-[10px] text-slate-300 font-black italic uppercase">System Core</span> : 
                                                    <div className="flex justify-end gap-1">
                                                        <button onClick={() => handleEditUserClick(role)} className="text-slate-400 hover:text-brand-600 p-2 rounded-xl hover:bg-brand-50 transition-all"><Edit2 size={18}/></button>
                                                        <button onClick={() => handleDeleteUser(role.email)} className="text-slate-400 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all"><Trash2 size={18}/></button>
                                                    </div>
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'TOOLS' && (
                // ... (Tools tab content same as before) ...
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
                             <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:rotate-12 transition-transform duration-500"><RefreshCw size={80}/></div>
                             <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                                <PlayCircle size={24} className="text-orange-600"/> ปรับปรุงวันที่ PM ใหม่
                             </h3>
                             <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                                สั่งให้ระบบคำนวณวันดำเนินการ PM ล่วงหน้าของเครื่องจักรทั้งหมดใหม่ โดยอิงตามวันหยุดโรงงานล่าสุด และลดการอัดแน่นของงานในบางวัน
                             </p>
                             <button onClick={handleRecalculatePM} disabled={isRecalculating} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black py-3 rounded-xl shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                                {isRecalculating ? <RefreshCw size={20} className="animate-spin"/> : <RefreshCw size={20}/>}
                                สั่งคำนวณวันใหม่ทั้งหมด (Recalculate)
                             </button>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
                             <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:rotate-12 transition-transform duration-500"><Hash size={80}/></div>
                             <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                                <AlertTriangle size={24} className="text-brand-600"/> แก้ไขเลขที่ใบงานซ้ำ
                             </h3>
                             <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                                ตรวจสอบใบแจ้งซ่อมที่มีรหัส (Job ID) ซ้ำกันในระบบ และทำการเปลี่ยนรหัสใหม่ให้ถูกต้องตามลำดับเวลาล่าสุดโดยอัตโนมัติ
                             </p>
                             <button onClick={handleFixDuplicates} disabled={isFixingDuplicates} className="w-full bg-slate-800 hover:bg-black text-white font-black py-3 rounded-xl shadow-lg shadow-slate-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50">
                                {isFixingDuplicates ? <RefreshCw size={20} className="animate-spin"/> : <Hash size={20}/>}
                                ตรวจสอบและแก้ไขรหัสซ้ำ
                             </button>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
                             <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:rotate-12 transition-transform duration-500"><Archive size={80}/></div>
                             <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                                <FileArchive size={24} className="text-red-600"/> Archive ข้อมูลปีเก่า
                             </h3>
                             <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                                แยกข้อมูลปีเก่าออกเป็นไฟล์ JSON เพื่อลดขนาดฐานข้อมูล และช่วยให้ระบบทำงานได้รวดเร็วขึ้น (ข้อมูลที่ถูกลบสามารถนำมาดูย้อนหลังได้โดยการ Load ไฟล์)
                             </p>
                             <div className="flex gap-2">
                                <select className="flex-1 px-4 py-2 border rounded-xl text-sm font-bold bg-slate-50" value={archiveYear} onChange={(e) => setArchiveYear(parseInt(e.target.value))}>
                                    {Array.from({length: 5}, (_, i) => new Date().getFullYear() - 1 - i).map(y => <option key={y} value={y}>ข้อมูลปี {y + 543}</option>)}
                                </select>
                                <button onClick={handleArchiveYear} className="px-6 bg-red-600 hover:bg-red-700 text-white font-black py-2 rounded-xl shadow-lg shadow-red-500/20 transition-all active:scale-95">ย้ายข้อมูล</button>
                             </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 relative group overflow-hidden">
                             <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:rotate-12 transition-transform duration-500"><Cloud size={80}/></div>
                             <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                                <Cloud size={24} className="text-emerald-600"/> สำรองข้อมูล (Backup)
                             </h3>
                             <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                                ดาวน์โหลดข้อมูลปัจจุบันทั้งหมดเก็บไว้เป็นไฟล์ JSON เพื่อความปลอดภัย หรือย้ายไปติดตั้งที่เครื่องอื่น
                             </p>
                             <div className="flex gap-3">
                                <button onClick={handleExportFullSystem} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl shadow-lg shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-sm">
                                    <Cloud size={18}/> Full Backup
                                </button>
                                <button onClick={handleExportFullSettings} className="px-4 bg-white hover:bg-slate-50 text-slate-500 font-bold py-3 rounded-xl border border-slate-200 transition-all active:scale-95 flex items-center justify-center" title="สำรองเฉพาะการตั้งค่า">
                                    <SettingsIcon size={18}/>
                                </button>
                             </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                                <UploadCloud size={24} className="text-brand-600"/> เรียกดูข้อมูลเก่า (View Archived Data)
                            </h3>
                            <div className="border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center hover:bg-slate-50 cursor-pointer flex flex-col items-center justify-center transition-all group" onClick={() => archiveInputRef.current?.click()}>
                                <div className="bg-brand-50 p-4 rounded-2xl text-brand-600 mb-4 group-hover:scale-110 transition-transform"><FileJson size={40}/></div>
                                <p className="text-base font-black text-slate-800">เลือกไฟล์สำรองข้อมูล (.json)</p>
                                <p className="text-xs text-slate-400 mt-2">ข้อมูลจะถูกผสานเข้ากับรายการปัจจุบันในโหมด Read-Only ชั่วคราว</p>
                                <input type="file" accept=".json" className="hidden" ref={archiveInputRef} onChange={handleLoadArchiveFile} />
                            </div>
                            {onClearArchive && (
                                <div className="mt-6 flex items-center justify-between bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <span className="text-sm font-bold text-emerald-800">กำลังเปิดดูข้อมูลเก่าผสานกับข้อมูลปัจจุบัน</span>
                                    </div>
                                    <button onClick={onClearArchive} className="px-4 py-2 bg-white border border-emerald-300 text-emerald-700 text-xs font-black rounded-xl hover:bg-emerald-100 shadow-sm transition-all uppercase tracking-widest">Close Mode</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Generic Add Modal */}
        {activeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in-up">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                        <h3 className="font-bold text-slate-800">{activeModal.title}</h3>
                        <button onClick={closeModal} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อรายการ (Name)</label>
                            <input 
                                className="w-full px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500" 
                                placeholder={activeModal.placeholderName || "ระบุชื่อ..."} 
                                value={tempName} 
                                onChange={e => setTempName(e.target.value)} 
                                autoFocus
                            />
                        </div>
                        
                        {activeModal.hasCode && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">{activeModal.codeLabel || 'รหัส (Code)'}</label>
                                <input 
                                    className="w-full px-4 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500 uppercase" 
                                    placeholder={activeModal.placeholderCode || "ระบุรหัส..."} 
                                    value={tempCode} 
                                    onChange={e => setTempCode(e.target.value.toUpperCase())} 
                                />
                            </div>
                        )}

                        {activeModal.type === 'DEPT' && tempName && tempCode && (
                            <div className="text-center bg-slate-50 p-3 rounded-lg border border-dashed border-slate-300 mt-2">
                                <span className="text-xs text-slate-400">ตัวอย่างผลลัพธ์: </span>
                                <span className="text-sm font-bold text-brand-600">
                                    {`${tempName} (${tempCode})`}
                                </span>
                            </div>
                        )}

                        <button 
                            onClick={handleSaveModalItem}
                            className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm hover:bg-black transition-all mt-4 shadow-lg shadow-slate-500/20"
                        >
                            ยืนยันการเพิ่มข้อมูล
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Settings;
