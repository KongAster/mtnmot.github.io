
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PMPlan, UserRole, Job, FactoryHoliday, JobStatus, RepairGroup } from '../types';
import { Search, Plus, FileText, Calendar, Edit2, Trash2, X, Save, Filter, LayoutGrid, List, Upload, FileSpreadsheet, Download, AlertTriangle, Clock, Wand2, Info, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Wrench } from 'lucide-react';
import { dataService } from '../services/dataService';
import MasterPMSchedule from './MasterPMSchedule';
import * as XLSX from 'xlsx';

interface PMRegistryProps {
  pmPlans: PMPlan[];
  departments: string[];
  refreshData: () => void;
  userRole?: UserRole;
  pmTypes: string[];
  jobs: Job[];
  holidays: FactoryHoliday[];
  onCreateJob?: (plan: PMPlan) => void; // New callback
}

const PMRegistry: React.FC<PMRegistryProps> = ({ pmPlans, departments, refreshData, userRole, pmTypes, jobs, holidays, onCreateJob }) => {
  const currentYear = new Date().getFullYear();
  const [viewMode, setViewMode] = useState<'LIST' | 'MASTER'>('LIST');
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [yearFilter, setYearFilter] = useState<number>(currentYear);
  const [monthFilter, setMonthFilter] = useState<number>(-1);
  const [dueStatusFilter, setDueStatusFilter] = useState<string>(''); 
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<PMPlan>>({});
  
  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // UPDATED: 10 Items per page
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canManage = userRole !== 'TECHNICIAN';

  // --- Logic: Detect Duplicate Asset IDs ---
  const duplicateAssetIds = useMemo(() => {
      const counts: Record<string, number> = {};
      pmPlans.forEach(p => { 
          if (p.assetId) { 
              const id = p.assetId.trim().toLowerCase(); 
              counts[id] = (counts[id] || 0) + 1; 
          } 
      });
      // Return a set of IDs that appear more than once
      return new Set(Object.keys(counts).filter(id => counts[id] > 1));
  }, [pmPlans]);

  const filteredPlans = useMemo(() => {
    return pmPlans.filter(p => {
        const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.assetId || '').toLowerCase().includes(search.toLowerCase());
        const matchDept = !deptFilter || p.department === deptFilter;
        const matchType = !typeFilter || p.type === typeFilter;
        
        let matchDate = true;
        if (p.nextDueDate) {
            const date = new Date(p.nextDueDate);
            if (yearFilter !== -1 && date.getFullYear() !== yearFilter) matchDate = false;
            if (monthFilter !== -1 && date.getMonth() !== monthFilter) matchDate = false;
        } else if (yearFilter !== -1 || monthFilter !== -1) matchDate = false;

        let matchStatus = true;
        if (dueStatusFilter && p.nextDueDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDate = new Date(p.nextDueDate);
            dueDate.setHours(0, 0, 0, 0);
            
            const diffTime = dueDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (dueStatusFilter === 'OVERDUE') {
                matchStatus = diffDays < 0;
            } else if (dueStatusFilter === '3DAYS') {
                matchStatus = diffDays >= 0 && diffDays <= 3;
            } else if (dueStatusFilter === '7DAYS') {
                matchStatus = diffDays >= 0 && diffDays <= 7;
            } else if (dueStatusFilter === '15DAYS') {
                matchStatus = diffDays >= 0 && diffDays <= 15;
            } else if (dueStatusFilter === '30DAYS') {
                matchStatus = diffDays >= 0 && diffDays <= 30;
            } else if (dueStatusFilter === 'FUTURE') {
                matchStatus = diffDays > 30;
            }
        } else if (dueStatusFilter) {
            matchStatus = false;
        }

        return matchSearch && matchDept && matchType && matchDate && matchStatus;
    }).sort((a, b) => {
        // Stable Sort: Asset ID (Natural) -> Name (Thai)
        // This ensures the list doesn't jump around when dates change
        const assetA = a.assetId || '';
        const assetB = b.assetId || '';
        const assetCompare = assetA.localeCompare(assetB, undefined, { numeric: true, sensitivity: 'base' });
        
        if (assetCompare !== 0) return assetCompare;
        return a.name.localeCompare(b.name, 'th');
    });
  }, [pmPlans, search, deptFilter, typeFilter, yearFilter, monthFilter, dueStatusFilter]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, deptFilter, typeFilter, yearFilter, monthFilter, dueStatusFilter, viewMode]);

  // --- Calculate Displayed Items ---
  const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const displayedPlans = filteredPlans.slice(startIdx, startIdx + itemsPerPage);

  const handleSave = async () => {
      if(!editingPlan.name || !editingPlan.department || !editingPlan.frequency) return;
      const combined = (((editingPlan.type || '') as any) + ((editingPlan.name || '') as any)).toLowerCase();
      // If manually selected planType, use it. Else infer.
      const planType = editingPlan.planType || (combined.includes('จ้าง') ? 'EP' : combined.includes('ตรวจ') ? 'C' : 'P');
      try {
          await dataService.savePMPlan({ ...editingPlan as PMPlan, id: editingPlan.id || crypto.randomUUID(), planType });
          refreshData(); setIsModalOpen(false); setEditingPlan({});
      } catch { alert('Failed to save'); }
  };

  // --- NEW: Quick Update for Plan Type ---
  const handleQuickTypeUpdate = async (plan: PMPlan, newType: string) => {
      try {
          // Sanitize: Remove 'schedule' or other UI-only props that might come from MasterPMSchedule
          const { schedule, ...cleanPlan } = plan as any;
          
          await dataService.savePMPlan({ ...cleanPlan, planType: newType as any });
          refreshData();
      } catch (err) {
          console.error("Failed to update plan type", err);
      }
  };

  const handleAutoSuggestDate = async () => {
    const today = new Date();
    const freq = editingPlan.frequency || 1;
    const baseDate = editingPlan.nextDueDate ? new Date(editingPlan.nextDueDate) : today;
    const targetYear = baseDate.getFullYear();
    const targetMonth = baseDate.getMonth();
    
    try {
        const suggested = await dataService.calculateSmartPMDate(targetYear, targetMonth, editingPlan);
        setEditingPlan(prev => ({ ...prev, nextDueDate: suggested }));
    } catch (err) {
        console.error("Auto-suggest failed", err);
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
        {
            'รายการ': 'ตัวอย่าง: เครื่องปรับอากาศ 18000 BTU',
            'แผนก': departments[0] || 'ระบุชื่อแผนกให้ตรงในระบบ',
            'ความถี่': 3,
            'รหัสทรัพย์สิน': 'MC-001',
            'ประเภท': pmTypes[0] || 'เครื่องปรับอากาศ (แอร์)',
            'รายละเอียด': 'ล้างแอร์ประจำไตรมาส',
            'วันครบกำหนด': new Date().toISOString().split('T')[0]
        }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PM Template");
    const wscols = [{ wch: 30 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 30 }, { wch: 15 }];
    ws['!cols'] = wscols;
    XLSX.writeFile(wb, "PM_Import_Template.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
          try {
              const result = evt.target?.result as any;
              if (!result) return;
              const workbook = XLSX.read(result, { type: 'binary' });
              const sheetName = workbook.SheetNames[0];
              const worksheet = workbook.Sheets[sheetName];
              if (!worksheet) return;
              const data = XLSX.utils.sheet_to_json(worksheet) as any[];
              if (!data.length || !confirm(`พบข้อมูล ${data.length} รายการ ยืนยันการนำเข้า?`)) return;
              for (const row of data) {
                  const rowData = row as any;
                  const name = String(rowData['ชื่อเครื่องจักร'] || rowData['รายการ'] || '').trim();
                  const dept = String(rowData['แผนก'] || '').trim();
                  if (name && dept) {
                      let nextDue: string | undefined;
                      const rawDateValue = rowData['วันครบกำหนด'];
                      
                      // Check for number type (Excel serial date)
                      if (typeof rawDateValue === 'number') {
                          // Excel's epoch is 1899-12-30. 25569 days offset to JS epoch.
                          const val = Number(rawDateValue);
                          const timestamp = (val - 25569) * 86400 * 1000;
                          const dateObj = new Date(timestamp);
                          const timeValue = dateObj.getTime();
                          if (!isNaN(timeValue)) {
                              nextDue = dateObj.toISOString().split('T')[0];
                          }
                      } else if (typeof rawDateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawDateValue)) {
                          nextDue = rawDateValue;
                      }
                      const freq = Number(rowData['ความถี่']) || 1;
                      await dataService.savePMPlan({ 
                        id: crypto.randomUUID(), 
                        name, 
                        department: dept, 
                        frequency: freq, 
                        assetId: String(rowData['รหัสทรัพย์สิน'] || ''), 
                        type: String(rowData['ประเภท'] || ''), 
                        description: String(rowData['รายละเอียด'] || ''), 
                        planType: 'P', 
                        nextDueDate: nextDue 
                      });
                  }
              }
              alert(`สำเร็จ`); refreshData();
          } catch (err) { 
              console.error(err);
              alert("เกิดข้อผิดพลาดในการนำเข้าข้อมูล"); 
          }
      };
      reader.readAsBinaryString(file);
  };

  const availableYears = useMemo(() => {
      const yearSet = new Set<number>();
      pmPlans.forEach(p => {
          if (p.nextDueDate) {
              const y = new Date(p.nextDueDate).getFullYear();
              if (!isNaN(y)) yearSet.add(y);
          } else {
              yearSet.add(currentYear);
          }
      });
      if (!yearSet.has(currentYear)) yearSet.add(currentYear);
      return Array.from(yearSet).sort((a: number, b: number) => b - a);
  }, [pmPlans, currentYear]);

  // Helper to get styled Plan Type (Interactive if canManage)
  const renderPlanTypeSelect = (plan: PMPlan) => {
      const currentType = plan.planType || 'P';
      const colorClass = 
          currentType === 'S' ? 'bg-red-50 text-red-600 border-red-200' :
          currentType === 'EP' ? 'bg-orange-50 text-orange-600 border-orange-200' :
          currentType === 'C' ? 'bg-cyan-50 text-cyan-600 border-cyan-200' :
          'bg-yellow-50 text-yellow-600 border-yellow-200';

      if (!canManage) {
          return <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${colorClass}`}>{currentType}</span>;
      }

      return (
          <div className="relative group inline-block">
              <select 
                  value={currentType}
                  onChange={(e) => handleQuickTypeUpdate(plan, e.target.value)}
                  className={`appearance-none cursor-pointer text-[10px] font-black px-1.5 py-0.5 rounded border outline-none text-center min-w-[36px] ${colorClass} hover:brightness-95 transition-all`}
              >
                  <option value="S">S</option>
                  <option value="P">P</option>
                  <option value="EP">EP</option>
                  <option value="C">C</option>
              </select>
          </div>
      );
  };

  return (
    <div className="space-y-4 animate-fade-in">
       <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100 gap-4">
           <div className="flex items-center gap-2">
               <div className="bg-brand-50 p-2 rounded-lg text-brand-600"><FileText size={24}/></div>
               <div><h2 className="text-xl font-bold text-slate-800">ทะเบียนแผนบำรุงรักษา (PM Registry)</h2><p className="text-xs text-slate-500">{pmPlans.length} รายการเครื่องจักร</p></div>
           </div>
           <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
               <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                   <button onClick={() => setViewMode('LIST')} className={`p-1.5 px-3 rounded-md text-xs font-bold transition-all ${viewMode==='LIST' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><List size={16} className="inline mr-1"/> รายการ</button>
                   <button onClick={() => setViewMode('MASTER')} className={`p-1.5 px-3 rounded-md text-xs font-bold transition-all ${viewMode==='MASTER' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={16} className="inline mr-1"/> ตารางแผน</button>
               </div>
               {viewMode === 'LIST' && (
                   <>
                       <div className="relative flex-1 min-w-[180px]"><Search size={14} className="absolute left-3 top-2.5 text-slate-400"/><input className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-xs outline-none" placeholder="ค้นหาชื่อ, รหัส..." value={search} onChange={e => setSearch(e.target.value)}/></div>
                       <select className="px-2 py-2 rounded-lg border border-slate-200 text-xs outline-none cursor-pointer min-w-[120px]" value={dueStatusFilter} onChange={e => setDueStatusFilter(e.target.value)}>
                           <option value="">ทุกสถานะเวลา</option>
                           <option value="OVERDUE">🔴 เลยกำหนดการ</option>
                           <option value="3DAYS">🟠 ภายใน 3 วัน</option>
                           <option value="7DAYS">🟡 ภายใน 7 วัน</option>
                           <option value="15DAYS">🔵 ภายใน 15 วัน</option>
                           <option value="30DAYS">🟣 ภายใน 30 วัน</option>
                           <option value="FUTURE">🟢 ยังไม่ถึงกำหนด</option>
                       </select>
                       <select className="px-2 py-2 rounded-lg border border-slate-200 text-xs outline-none cursor-pointer min-w-[100px]" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}><option value="">ทุกแผนก</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select>
                       <select className="px-2 py-2 rounded-lg border border-slate-200 text-xs outline-none cursor-pointer min-w-[100px]" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">ทุกประเภท</option>{pmTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                       <select className="px-2 py-2 rounded-lg border border-slate-200 text-xs outline-none cursor-pointer w-20" value={yearFilter} onChange={e => setYearFilter(parseInt(e.target.value))}><option value={-1}>ทุกปี</option>{availableYears.map(y => <option key={y} value={y}>{y+543}</option>)}</select>
                   </>
               )}
               {canManage && (
                   <div className="flex gap-2 ml-auto xl:ml-2">
                       <input type="file" ref={fileInputRef} onChange={handleFileUpload} hidden accept=".xlsx, .xls" />
                       <button onClick={handleDownloadTemplate} className="bg-white text-slate-600 border border-slate-200 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-slate-50 transition-colors" title="ดาวน์โหลดไฟล์เทมเพลต Excel สำหรับเตรียมข้อมูล"><Download size={16}/> Template</button>
                       <button onClick={() => fileInputRef.current?.click()} className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-100"><FileSpreadsheet size={16}/> Import</button>
                       <button onClick={() => { setEditingPlan({frequency: 1, planType: 'P'}); setIsModalOpen(true); }} className="bg-brand-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-brand-700 shadow-sm"><Plus size={16}/> เพิ่มแผน</button>
                   </div>
               )}
           </div>
       </div>

       {viewMode === 'MASTER' ? (
           <MasterPMSchedule 
                pmPlans={pmPlans} 
                jobs={jobs} 
                holidays={holidays} 
                departments={departments} 
                pmTypes={pmTypes} 
                onUpdatePlan={(updatedPlan) => handleQuickTypeUpdate(updatedPlan, updatedPlan.planType || 'P')}
           />
       ) : (
           <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
               <div className="overflow-x-auto flex-1">
                   <table className="w-full text-sm text-left table-fixed">
                       <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                           <tr>
                                <th className="px-6 py-4 w-[25%]">เครื่องจักร</th>
                                <th className="px-4 py-4 w-[15%]">ประเภท</th>
                                <th className="px-2 py-4 text-center w-[8%]">Type</th>
                                <th className="px-4 py-4 w-[12%]">รหัสทรัพย์สิน</th>
                                <th className="px-4 py-4 w-[15%]">แผนก</th>
                                <th className="px-2 py-4 text-center w-[8%]">ความถี่</th>
                                <th className="px-4 py-4 w-[10%]">ครั้งถัดไป</th>
                                {canManage && <th className="px-4 py-4 text-right w-[15%]">จัดการ</th>}
                           </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-100">
                           {displayedPlans.map(plan => {
                               const isDuplicate = plan.assetId && duplicateAssetIds.has(plan.assetId.trim().toLowerCase());
                               let statusDot = null;
                               if (plan.nextDueDate) {
                                   const today = new Date();
                                   today.setHours(0,0,0,0);
                                   const dueDate = new Date(plan.nextDueDate);
                                   const diff = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);
                                   if (diff < 0) statusDot = <div className="w-2 h-2 rounded-full bg-red-500" title="เลยกำหนดการ"></div>;
                                   else if (diff <= 3) statusDot = <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" title="ครบกำหนดภายใน 3 วัน"></div>;
                                   else if (diff <= 15) statusDot = <div className="w-2 h-2 rounded-full bg-blue-500" title="ครบกำหนดภายใน 15 วัน"></div>;
                               }
                               return (
                               <tr key={plan.id} className="hover:bg-slate-50 transition-colors">
                                   <td className="px-6 py-3 font-medium text-slate-700">
                                       <div className="flex items-center gap-2">
                                           {statusDot}
                                           <div className="truncate" title={plan.name}>{plan.name}</div>
                                       </div>
                                       <div className="text-xs text-slate-400 pl-4 truncate" title={plan.description}>{plan.description}</div>
                                   </td>
                                   <td className="px-4 py-3 text-xs text-slate-600 truncate" title={plan.type}>{plan.type || '-'}</td>
                                   <td className="px-2 py-3 text-center">
                                       {renderPlanTypeSelect(plan)}
                                   </td>
                                   <td className="px-4 py-3 font-mono text-xs text-brand-600 truncate">
                                       <div className="flex items-center gap-1">
                                           {plan.assetId || '-'}
                                           {/* DUPLICATE WARNING */}
                                           {isDuplicate && <span title="รหัสทรัพย์สินซ้ำกันในระบบ" className="animate-pulse"><AlertTriangle size={14} className="text-amber-500 shrink-0" /></span>}
                                       </div>
                                   </td>
                                   <td className="px-4 py-3 text-xs truncate" title={plan.department}>{plan.department.match(/\(([^)]+)\)/)?.[1] || plan.department}</td>
                                   <td className="px-2 py-3 text-center"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold">{plan.frequency} M</span></td>
                                   <td className="px-4 py-3 text-xs">
                                       <div className={`font-bold ${plan.nextDueDate && new Date(plan.nextDueDate) < new Date() ? 'text-red-600' : ''}`}>
                                           {plan.nextDueDate ? new Date(plan.nextDueDate).toLocaleDateString('th-TH') : '-'}
                                       </div>
                                   </td>
                                   {canManage && (
                                       <td className="px-4 py-3 text-right">
                                           <div className="flex justify-end gap-1">
                                               {onCreateJob && (
                                                   <button 
                                                       onClick={() => onCreateJob(plan)} 
                                                       className="p-1.5 text-white bg-brand-600 hover:bg-brand-700 rounded shadow-sm transition-colors"
                                                       title="เปิดใบแจ้งซ่อม"
                                                   >
                                                       <Wrench size={14}/>
                                                   </button>
                                               )}
                                               <button onClick={() => { setEditingPlan(plan); setIsModalOpen(true); }} className="p-1.5 text-slate-500 hover:text-brand-600 hover:bg-slate-100 rounded transition-colors"><Edit2 size={16}/></button>
                                               <button onClick={() => dataService.deletePMPlan(plan.id).then(refreshData)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={16}/></button>
                                           </div>
                                       </td>
                                   )}
                               </tr>
                           )})}
                           {displayedPlans.length === 0 && (
                               <tr>
                                   <td colSpan={canManage ? 8 : 7} className="text-center py-12 text-slate-400">
                                       ไม่พบข้อมูลแผนงาน PM
                                   </td>
                               </tr>
                           )}
                       </tbody>
                   </table>
               </div>

               {/* --- Pagination Footer --- */}
               {totalPages > 1 && (
                   <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center">
                       <div className="text-xs text-slate-500">
                           แสดง <span className="font-bold">{startIdx + 1}</span> - <span className="font-bold">{Math.min(startIdx + itemsPerPage, filteredPlans.length)}</span> จาก <span className="font-bold">{filteredPlans.length}</span> รายการ
                       </div>
                       <div className="flex gap-1">
                           <button 
                               onClick={() => setCurrentPage(1)} 
                               disabled={currentPage === 1}
                               className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
                           >
                               <ChevronsLeft size={16}/>
                           </button>
                           <button 
                               onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                               disabled={currentPage === 1}
                               className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
                           >
                               <ChevronLeft size={16}/>
                           </button>
                           
                           <div className="flex items-center gap-1 mx-2">
                               <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-md">
                                   หน้า {currentPage} / {totalPages}
                               </span>
                           </div>

                           <button 
                               onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                               disabled={currentPage === totalPages}
                               className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
                           >
                               <ChevronRight size={16}/>
                           </button>
                           <button 
                               onClick={() => setCurrentPage(totalPages)} 
                               disabled={currentPage === totalPages}
                               className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
                           >
                               <ChevronsRight size={16}/>
                           </button>
                       </div>
                   </div>
               )}
           </div>
       )}

       {isModalOpen && (
           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
               <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">
                   <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center"><h3 className="font-bold">{editingPlan.id ? 'แก้ไขแผน PM' : 'เพิ่มแผน PM ใหม่'}</h3><button onClick={() => setIsModalOpen(false)}><X size={20}/></button></div>
                   <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                       <div><label className="block text-xs font-bold text-slate-500 mb-1">ชื่อเครื่องจักร *</label><input className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none" value={editingPlan.name || ''} onChange={e => setEditingPlan({...editingPlan, name: e.target.value})} /></div>
                       <div className="grid grid-cols-2 gap-4">
                           <div><label className="block text-xs font-bold text-slate-500 mb-1">ประเภท</label><select className="w-full px-3 py-2 border rounded-lg text-sm outline-none" value={editingPlan.type || ''} onChange={e => setEditingPlan({...editingPlan, type: e.target.value})}><option value="">-- เลือก --</option>{pmTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                           <div><label className="block text-xs font-bold text-slate-500 mb-1">รหัสทรัพย์สิน</label><input className="w-full px-3 py-2 border rounded-lg text-sm outline-none" value={editingPlan.assetId || ''} onChange={e => setEditingPlan({...editingPlan, assetId: e.target.value})} /></div>
                       </div>
                       <div><label className="block text-xs font-bold text-slate-500 mb-1">แผนก *</label><select className="w-full px-3 py-2 border rounded-lg text-sm outline-none" value={editingPlan.department || ''} onChange={e => setEditingPlan({...editingPlan, department: e.target.value})}><option value="">-- เลือกแผนก --</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                       <div className="grid grid-cols-2 gap-4">
                           <div><label className="block text-xs font-bold text-slate-500 mb-1">ความถี่ (เดือน) *</label><input type="number" className="w-full px-3 py-2 border rounded-lg text-sm outline-none" value={editingPlan.frequency || 1} onChange={e => setEditingPlan({...editingPlan, frequency: parseInt(e.target.value)})} /></div>
                           <div><label className="block text-xs font-bold text-slate-500 mb-1">ประเภทแผน</label><select className="w-full px-3 py-2 border rounded-lg text-sm outline-none" value={editingPlan.planType || 'P'} onChange={e => setEditingPlan({...editingPlan, planType: e.target.value as any})}><option value="S">S (Start)</option><option value="P">P (Plan)</option><option value="EP">EP (Ext. Plan)</option><option value="C">C (Check)</option></select></div>
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-slate-500 mb-1">วันครบกำหนด</label>
                           <div className="flex gap-2">
                               <input type="date" className="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500" value={editingPlan.nextDueDate || ''} onChange={e => setEditingPlan({...editingPlan, nextDueDate: e.target.value})} />
                               <button 
                                  onClick={handleAutoSuggestDate}
                                  type="button"
                                  className="bg-brand-50 text-brand-600 border border-brand-200 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-brand-100 transition-colors"
                                  title="คำนวณหาวันที่โหลดงานน้อยที่สุดให้อัตโนมัติ"
                               >
                                   <Wand2 size={16}/> คำนวณวัน
                               </button>
                           </div>
                           <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                               <Info size={10}/> หากเว้นว่างไว้ ระบบจะคำนวณหาวันดำเนินการที่เหมาะสมให้ตามความถี่ที่ระบุ
                           </p>
                       </div>
                   </div>
                   <div className="bg-slate-50 px-6 py-4 border-t flex justify-end gap-2"><button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600">ยกเลิก</button><button onClick={handleSave} className="px-4 py-2 text-sm font-bold bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-md">บันทึก</button></div>
               </div>
           </div>
       )}
    </div>
  );
};

export default PMRegistry;
