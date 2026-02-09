
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Job, JobStatus, UserRole, Technician, formatDate, RepairGroup, JOB_STATUS_DISPLAY } from '../types';
import { Edit2, Search, Filter, CheckCircle, Clock, Trash2, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, Building2, Download, Users, X, Hash, XCircle, RotateCcw, CalendarDays, Wrench, SlidersHorizontal, BookOpen, Paperclip, Plus, AlertCircle, AlertTriangle, ChevronDown, LayoutList, ClipboardCheck, ArrowLeftRight, CheckSquare } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

interface JobListProps {
  jobs: Job[];
  onEdit: (job: Job) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  userRole?: UserRole; 
  technicians?: Technician[];
  departments?: string[];
  repairGroups?: string[]; // Dynamic repair groups
}

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// Helper to safely parse JSON from localStorage
const getStoredJSON = (key: string, defaultValue: any) => {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch {
        return defaultValue;
    }
};

const JobList: React.FC<JobListProps> = ({ jobs, onEdit, onDelete, onAdd, userRole, technicians = [], departments = [], repairGroups = [] }) => {
  const currentYear = new Date().getFullYear();
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Drag Scroll Hooks
  const filterScroll = useDraggableScroll<HTMLDivElement>();
  const tableScroll = useDraggableScroll<HTMLDivElement>(); 

  // --- Initialize State with LocalStorage Values (Persistence) ---
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'WAITING' | 'FINISHED' | 'CANCELLED'>(
      () => (localStorage.getItem('jobList_filter_status') as any) || 'ACTIVE'
  );
  
  const [selectedYear, setSelectedYear] = useState<number>(
      () => parseInt(localStorage.getItem('jobList_filter_year') || String(currentYear))
  );
  
  const [selectedMonth, setSelectedMonth] = useState<number>(
      () => parseInt(localStorage.getItem('jobList_filter_month') || String(new Date().getMonth()))
  ); 

  // NEW: Specific Date Filter (Existing)
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>(
      () => localStorage.getItem('jobList_filter_date') || ''
  );

  const [selectedDepartment, setSelectedDepartment] = useState<string>(
      () => localStorage.getItem('jobList_filter_dept') || ''
  );

  // NEW: Repair Group Filter
  const [selectedRepairGroup, setSelectedRepairGroup] = useState<string>(
      () => localStorage.getItem('jobList_filter_group') || ''
  );
  
  const [selectedTechs, setSelectedTechs] = useState<string[]>(
      () => getStoredJSON('jobList_filter_techs', [])
  );
  
  const [selectedPrefix, setSelectedPrefix] = useState<string>(
      () => localStorage.getItem('jobList_filter_prefix') || 'ALL'
  );

  // NEW: Job Source (General / PM)
  const [selectedSource, setSelectedSource] = useState<string>(
      () => localStorage.getItem('jobList_filter_source') || 'ALL'
  );

  // NEW: Advanced Date Range Filters
  const [filterDueDateStart, setFilterDueDateStart] = useState('');
  const [filterDueDateEnd, setFilterDueDateEnd] = useState('');
  const [filterFinishedDateStart, setFilterFinishedDateStart] = useState('');
  const [filterFinishedDateEnd, setFilterFinishedDateEnd] = useState('');
  
  // NEW: Overdue Toggle
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  const [search, setSearch] = useState(''); 
  
  // Filter Visibility State
  const [isFilterVisible, setIsFilterVisible] = useState(true);

  const [isTechFilterOpen, setIsTechFilterOpen] = useState(false);
  const techFilterRef = useRef<HTMLDivElement>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Can Edit?
  const canEdit = userRole !== 'TECHNICIAN';

  // --- Effects to Save State to LocalStorage ---
  useEffect(() => { localStorage.setItem('jobList_filter_status', filter) }, [filter]);
  useEffect(() => { localStorage.setItem('jobList_filter_year', String(selectedYear)) }, [selectedYear]);
  useEffect(() => { localStorage.setItem('jobList_filter_month', String(selectedMonth)) }, [selectedMonth]);
  useEffect(() => { localStorage.setItem('jobList_filter_date', selectedSpecificDate) }, [selectedSpecificDate]);
  useEffect(() => { localStorage.setItem('jobList_filter_dept', selectedDepartment) }, [selectedDepartment]);
  useEffect(() => { localStorage.setItem('jobList_filter_group', selectedRepairGroup) }, [selectedRepairGroup]);
  useEffect(() => { localStorage.setItem('jobList_filter_techs', JSON.stringify(selectedTechs)) }, [selectedTechs]);
  useEffect(() => { localStorage.setItem('jobList_filter_prefix', selectedPrefix) }, [selectedPrefix]);
  useEffect(() => { localStorage.setItem('jobList_filter_source', selectedSource) }, [selectedSource]);

  const handleResetFilters = () => {
      setFilter('ACTIVE');
      setSelectedYear(currentYear);
      setSelectedMonth(new Date().getMonth());
      setSelectedSpecificDate('');
      setSelectedDepartment('');
      setSelectedRepairGroup('');
      setSelectedTechs([]);
      setSelectedPrefix('ALL');
      setSelectedSource('ALL');
      setFilterDueDateStart('');
      setFilterDueDateEnd('');
      setFilterFinishedDateStart('');
      setFilterFinishedDateEnd('');
      setShowOverdueOnly(false);
      setSearch('');
  };

  const handleDeleteClick = (job: Job, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm(`ยืนยันการลบใบแจ้งซ่อมเลขที่ ${job.jobRunningId}?`)) {
          onDelete(job.id);
      }
  };

  // Close tech filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (techFilterRef.current && !techFilterRef.current.contains(event.target as Node)) {
            setIsTechFilterOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search, selectedYear, selectedMonth, selectedSpecificDate, selectedDepartment, selectedRepairGroup, selectedTechs, selectedPrefix, selectedSource, filterDueDateStart, filterDueDateEnd, filterFinishedDateStart, filterFinishedDateEnd, showOverdueOnly]);

  const availableYears = useMemo(() => {
    const jobYears = jobs.map(j => new Date(j.dateReceived).getFullYear());
    jobYears.push(currentYear); 
    
    const minYear = Math.min(...jobYears);
    const maxYear = Math.max(...jobYears);
    
    const years = [];
    for (let y = maxYear; y >= minYear; y--) {
        years.push(y);
    }
    return years;
  }, [jobs, currentYear]);

  // Extract unique prefixes from jobs
  const availablePrefixes = useMemo(() => {
      const prefixes = new Set<string>();
      jobs.forEach(j => {
          // Extract leading letters from Job ID (e.g., MTN02001 -> MTN)
          const match = j.jobRunningId.match(/^([A-Z]+)/);
          if (match) prefixes.add(match[1]);
      });
      return Array.from(prefixes).sort();
  }, [jobs]);

  // --- Summary Statistics Calculation (UPDATED to respect Dept & Prefix Filters) ---
  const summaryStats = useMemo(() => {
      return jobs.reduce((acc, job) => {
          // 1. Time Filter Check
          if (selectedSpecificDate) {
              if (job.dateReceived !== selectedSpecificDate) return acc;
          } else {
              const d = new Date(job.dateReceived);
              if (selectedYear !== -1 && d.getFullYear() !== selectedYear) return acc;
              if (selectedMonth !== -1 && d.getMonth() !== selectedMonth) return acc;
          }

          // 2. Department Filter Check
          if (selectedDepartment && job.department !== selectedDepartment) return acc;

          // 3. Prefix Filter Check
          if (selectedPrefix !== 'ALL' && !job.jobRunningId.startsWith(selectedPrefix)) return acc;

          // 4. Job Source Check
          if (selectedSource !== 'ALL') {
              if (selectedSource === 'PM' && !job.pmPlanId) return acc;
              if (selectedSource === 'GENERAL' && job.pmPlanId) return acc;
          }

          // --- Calculate Stats ---
          const isJobFinished = job.status === JobStatus.FINISHED || job.status === 'เสร็จสิ้น' as any || job.status === 'ปิดงานแล้ว' as any;
          const isJobActive = job.status === JobStatus.IN_PROGRESS || job.status === 'รอดำเนินการ' as any || job.status === 'ดำเนินการ' as any;
          const isJobWaiting = job.status === JobStatus.WAITING_INSPECTION;
          const isJobCancelled = job.status === JobStatus.CANCELLED || job.status === JobStatus.UNREPAIRABLE;

          if (isJobFinished) {
              acc.finished++;
              // Check if finished Late (Overdue)
              if (job.dueDate && job.finishedDate && job.finishedDate > job.dueDate) {
                  acc.finishedOverdue++;
              }
          } else if (isJobActive) {
              if (job.dueDate && job.dueDate < todayStr) {
                  acc.overdue++;
              } else {
                  acc.active++;
              }
          } else if (isJobWaiting) {
              acc.waiting++;
          }
          
          if (!isJobCancelled) {
             acc.total = acc.finished + acc.active + acc.overdue + acc.waiting;
          }

          return acc;
      }, { total: 0, finished: 0, finishedOverdue: 0, active: 0, overdue: 0, waiting: 0 });
  }, [jobs, selectedYear, selectedMonth, selectedSpecificDate, selectedDepartment, selectedPrefix, selectedSource, todayStr]);

  const filteredJobs = useMemo(() => {
    return jobs
    .filter(job => {
      // 1. Status Filter
      if (filter === 'ACTIVE') {
          if (job.status !== JobStatus.IN_PROGRESS && job.status !== 'รอดำเนินการ' as any && job.status !== 'ดำเนินการ' as any) return false;
      } else if (filter === 'WAITING') {
          if (job.status !== JobStatus.WAITING_INSPECTION) return false;
      } else if (filter === 'FINISHED') {
          if (job.status !== JobStatus.FINISHED && job.status !== 'เสร็จสิ้น' as any && job.status !== 'ปิดงานแล้ว' as any) return false;
      } else if (filter === 'CANCELLED') {
          if (job.status !== JobStatus.CANCELLED && job.status !== JobStatus.UNREPAIRABLE) return false;
      }
      
      // 2. Date Filter (Period)
      if (selectedSpecificDate) {
          if (job.dateReceived !== selectedSpecificDate) return false;
      } else {
          const jobDate = new Date(job.dateReceived);
          if (selectedYear !== -1 && jobDate.getFullYear() !== selectedYear) return false;
          if (selectedMonth !== -1 && jobDate.getMonth() !== selectedMonth) return false;
      }

      // 3. Department Filter
      if (selectedDepartment && job.department !== selectedDepartment) return false;

      // 4. Repair Group Filter
      if (selectedRepairGroup && job.repairGroup !== selectedRepairGroup) return false;

      // 5. Tech Filter
      if (selectedTechs.length > 0) {
          const hasSelectedTech = job.technicianIds?.some(id => selectedTechs.includes(id));
          if (!hasSelectedTech) return false;
      }

      // 6. ID Prefix Filter
      if (selectedPrefix !== 'ALL') {
          if (!job.jobRunningId.startsWith(selectedPrefix)) return false;
      }

      // 7. Job Source Filter
      if (selectedSource !== 'ALL') {
          if (selectedSource === 'PM') {
              if (!job.pmPlanId) return false;
          } else if (selectedSource === 'GENERAL') {
              if (job.pmPlanId) return false;
          }
      }

      // 8. Search Text
      if (search) {
          const searchLower = search.toLowerCase();
          return (
              job.jobRunningId.toLowerCase().includes(searchLower) ||
              job.itemDescription.toLowerCase().includes(searchLower) ||
              job.department.toLowerCase().includes(searchLower)
          );
      }

      // 9. NEW: Due Date Range
      if (filterDueDateStart && (!job.dueDate || job.dueDate < filterDueDateStart)) return false;
      if (filterDueDateEnd && (!job.dueDate || job.dueDate > filterDueDateEnd)) return false;

      // 10. NEW: Finished Date Range
      if (filterFinishedDateStart && (!job.finishedDate || job.finishedDate < filterFinishedDateStart)) return false;
      if (filterFinishedDateEnd && (!job.finishedDate || job.finishedDate > filterFinishedDateEnd)) return false;

      // 11. NEW: Overdue Only Filter (Refined Logic)
      if (showOverdueOnly) {
          const isActive = job.status === JobStatus.IN_PROGRESS || job.status === 'รอดำเนินการ' as any || job.status === 'ดำเนินการ' as any;
          const isFinished = job.status === JobStatus.FINISHED || job.status === 'เสร็จสิ้น' as any || job.status === 'ปิดงานแล้ว' as any;

          if (isActive) {
              // Active jobs: Overdue if Due Date < Today
              if (!job.dueDate || job.dueDate >= todayStr) return false;
          } else if (isFinished) {
              // Finished jobs: Overdue if Finished Date > Due Date
              if (!job.dueDate || !job.finishedDate || job.finishedDate <= job.dueDate) return false;
          } else {
              // Cancelled / Waiting jobs -> Hide in overdue filter (unless waiting logic required)
              return false;
          }
      }

      return true;
    })
    .sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
  }, [jobs, filter, search, selectedYear, selectedMonth, selectedSpecificDate, selectedDepartment, selectedRepairGroup, selectedTechs, selectedPrefix, selectedSource, filterDueDateStart, filterDueDateEnd, filterFinishedDateStart, filterFinishedDateEnd, showOverdueOnly, todayStr]);

  const handleExportExcel = () => {
    // ... (Existing export logic remains same) ...
    const dataToExport: any[] = [];
    filteredJobs.forEach(job => {
        const techNames = job.technicianIds?.map(id => {
            const t = technicians.find(tech => tech.id === id);
            return t ? t.firstName : id;
        }).join(', ');
        // ... (data mapping) ...
        const baseJobData = {
            'เลขที่ใบแจ้ง': job.jobRunningId,
            'วันที่แจ้ง': formatDate(job.dateReceived),
            'ประเภทงาน': job.pmPlanId ? 'PM' : 'แจ้งซ่อมทั่วไป',
            'แผนก': job.department,
            'รายการซ่อม/เครื่องจักร': job.itemDescription,
            'สาเหตุ/อาการ': job.damageDescription,
            'กลุ่มงาน': job.repairGroup,
            'สถานะ': JOB_STATUS_DISPLAY[job.status] || job.status,
            'หมวดงาน': job.jobType, 
            'ผู้รับผิดชอบ': techNames,
            'กำหนดเสร็จ': formatDate(job.dueDate),
            'เสร็จจริง': formatDate(job.finishedDate),
            'ผลประเมินงาน': job.assessment || '-',
            'จำนวนไฟล์แนบ': job.attachments?.length || 0
        };
        // ... (costs mapping) ...
        if (job.costs && job.costs.length > 0) {
            job.costs.forEach(cost => {
                dataToExport.push({
                    ...baseJobData,
                    'วันที่เบิก': formatDate(cost.date || job.dateReceived),
                    'รายการค่าใช้จ่าย': cost.name,
                    'หมวดค่าใช้จ่าย': cost.category || '-',
                    'บริษัทคู่ค้า': cost.company || '-',
                    'จำนวน': cost.quantity,
                    'ราคาต่อหน่วย': cost.pricePerUnit,
                    'ราคารวม': cost.totalPrice
                });
            });
        } else {
            dataToExport.push({
                ...baseJobData,
                'วันที่เบิก': '-',
                'รายการค่าใช้จ่าย': '-',
                'หมวดค่าใช้จ่าย': '-',
                'บริษัทคู่ค้า': '-',
                'จำนวน': 0,
                'ราคาต่อหน่วย': 0,
                'ราคารวม': 0
            });
        }
    });
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jobs_Detailed");
    XLSX.writeFile(wb, `maintenance_export_detailed_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage;
  const displayedJobs = filteredJobs.slice(startItem, startItem + itemsPerPage);

  // ... (StatusBadge, getDeptCodeAndName helpers remain same) ...
  const StatusBadge = ({ status }: { status: JobStatus }) => (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap
        ${status === JobStatus.FINISHED || status === 'เสร็จสิ้น' as any || status === 'ปิดงานแล้ว' as any ? 'bg-emerald-100 text-emerald-800' : 
          status === JobStatus.CANCELLED ? 'bg-rose-100 text-rose-800' : 
          status === JobStatus.UNREPAIRABLE ? 'bg-slate-200 text-slate-700' : 
          status === JobStatus.WAITING_INSPECTION ? 'bg-blue-100 text-blue-800' :
          'bg-amber-100 text-amber-800'}`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 
            ${status === JobStatus.FINISHED || status === 'เสร็จสิ้น' as any || status === 'ปิดงานแล้ว' as any ? 'bg-emerald-500' : 
              status === JobStatus.CANCELLED ? 'bg-rose-500' : 
              status === JobStatus.UNREPAIRABLE ? 'bg-slate-500' : 
              status === JobStatus.WAITING_INSPECTION ? 'bg-blue-500' :
              'bg-amber-500'}`}></span>
        {JOB_STATUS_DISPLAY[status] || status}
    </span>
  );

  const getDeptCodeAndName = (fullDept: string) => {
      const match = fullDept.match(/\(([^)]+)\)$/);
      if (match) {
          return { code: match[1], name: fullDept };
      }
      return { code: '', name: fullDept };
  };

  const sortedDepartments = useMemo(() => [...departments].sort((a,b) => a.localeCompare(b, 'th')), [departments]);
  const sortedTechnicians = useMemo(() => [...technicians].sort((a,b) => a.firstName.localeCompare(b.firstName, 'th')), [technicians]);
  const sortedRepairGroups = useMemo(() => {
      if (repairGroups && repairGroups.length > 0) {
          return [...repairGroups].sort((a,b) => a.localeCompare(b, 'th'));
      }
      return Object.values(RepairGroup).sort((a,b) => (a as string).localeCompare((b as string), 'th'));
  }, [repairGroups]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-full relative">
      
      {/* 0. Summary Cards Section - UPDATED LAYOUT */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                  <div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">งานทั้งหมด</p>
                      <p className="text-xl font-black text-slate-800">{summaryStats.total}</p>
                  </div>
                  <div className="p-1.5 bg-slate-100 rounded-lg text-slate-600"><BookOpen size={18}/></div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm flex items-center justify-between relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-2 opacity-10"><CheckCircle size={48} className="text-emerald-500"/></div>
                  <div>
                      <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">ปิดงานแล้ว</p>
                      <p className="text-xl font-black text-emerald-700">{summaryStats.finished}</p>
                  </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-2 opacity-10"><ClipboardCheck size={48} className="text-blue-500"/></div>
                  <div>
                      <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">รอตรวจรับ</p>
                      <p className="text-xl font-black text-blue-700">{summaryStats.waiting}</p>
                  </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm flex items-center justify-between relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-2 opacity-10"><Clock size={48} className="text-amber-500"/></div>
                  <div>
                      <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">ดำเนินการ</p>
                      <p className="text-xl font-black text-amber-700">{summaryStats.active}</p>
                  </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm flex items-center justify-between relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-2 opacity-10"><AlertTriangle size={48} className="text-rose-500"/></div>
                  <div>
                      <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">ค้างเกินกำหนด</p>
                      <p className="text-xl font-black text-rose-600">{summaryStats.overdue}</p>
                  </div>
              </div>
              {/* NEW CARD: FINISHED OVERDUE */}
              <div className="bg-white p-3 rounded-xl border border-orange-100 shadow-sm flex items-center justify-between relative overflow-hidden">
                  <div className="absolute right-0 top-0 p-2 opacity-10"><CheckSquare size={48} className="text-orange-500"/></div>
                  <div>
                      <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">ปิดงานล่าช้า</p>
                      <p className="text-xl font-black text-orange-600">{summaryStats.finishedOverdue}</p>
                  </div>
              </div>
          </div>
      </div>

      {/* Filters Section */}
      <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col gap-4 bg-white sticky top-0 z-50 shadow-sm md:shadow-none relative">
        
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            {/* 1. Status Filter Tabs */}
            <div 
                className="flex bg-slate-100 p-1 rounded-xl w-full xl:w-max overflow-x-auto select-none shrink-0"
                ref={filterScroll.ref}
                {...filterScroll.events}
                style={filterScroll.style}
            >
                <button 
                    onClick={() => { if(!filterScroll.isDragging) setFilter('ACTIVE'); }}
                    className={`flex-1 lg:flex-none px-3 md:px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center transition-all whitespace-nowrap ${filter === 'ACTIVE' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Clock size={16} className="mr-2" /> ดำเนินการ
                </button>
                <button 
                    onClick={() => { if(!filterScroll.isDragging) setFilter('WAITING'); }}
                    className={`flex-1 lg:flex-none px-3 md:px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center transition-all whitespace-nowrap ${filter === 'WAITING' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ClipboardCheck size={16} className="mr-2" /> รอตรวจรับ
                </button>
                <button 
                    onClick={() => { if(!filterScroll.isDragging) setFilter('FINISHED'); }}
                    className={`flex-1 lg:flex-none px-3 md:px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center transition-all whitespace-nowrap ${filter === 'FINISHED' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <CheckCircle size={16} className="mr-2" /> ปิดงานแล้ว
                </button>
                <button 
                    onClick={() => { if(!filterScroll.isDragging) setFilter('CANCELLED'); }}
                    className={`flex-1 lg:flex-none px-3 md:px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center transition-all whitespace-nowrap ${filter === 'CANCELLED' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <XCircle size={16} className="mr-2" /> ยกเลิก/ซ่อมไม่ได้
                </button>
                <button 
                    onClick={() => { if(!filterScroll.isDragging) setFilter('ALL'); }}
                    className={`flex-1 lg:flex-none px-3 md:px-4 py-2 rounded-lg text-sm font-semibold flex items-center justify-center transition-all whitespace-nowrap ${filter === 'ALL' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Filter size={16} className="mr-2" /> ทั้งหมด
                </button>
            </div>
            
            {/* 2. Search & Filter Controls */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto flex-1 justify-end">
                
                <div className="relative flex-1 w-full xl:max-w-md">
                    <input 
                        type="text" 
                        placeholder="ค้นหา (เลขที่, รายการ, แผนก)" 
                        className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl w-full focus:ring-2 focus:ring-brand-500 focus:bg-white outline-none text-sm transition-all"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    
                    <button 
                        onClick={onAdd}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 rounded-xl shadow-sm hover:shadow-md transition-all font-bold text-xs whitespace-nowrap"
                        title="สร้างใบแจ้งซ่อมใหม่"
                    >
                        <Plus size={18} />
                        <span>แจ้งซ่อม</span>
                    </button>

                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

                    <button 
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-xl transition-all font-bold text-xs whitespace-nowrap"
                        title="Export to Excel"
                    >
                        <Download size={16} />
                        <span className="hidden xl:inline">Excel</span>
                    </button>

                    <button 
                        onClick={() => setIsFilterVisible(!isFilterVisible)}
                        className={`p-2 rounded-xl border transition-all flex items-center justify-center ${isFilterVisible ? 'bg-brand-50 border-brand-200 text-brand-600 shadow-sm ring-1 ring-brand-100' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        title={isFilterVisible ? "ซ่อนตัวกรองละเอียด" : "แสดงตัวกรองละเอียด"}
                    >
                        <SlidersHorizontal size={20} />
                    </button>
                </div>
            </div>
        </div>

        {/* 3. Detailed Filters (Collapsible) */}
        {isFilterVisible && (
            <div className="pt-3 border-t border-slate-50 animate-fade-in space-y-3">
                {/* ... (Existing detailed filters - unchanged) ... */}
                {/* Row 1: Basic Filters (Using Grid for better responsiveness) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    {/* Period Selectors */}
                    <div className="flex items-center gap-1 col-span-2 sm:col-span-2 md:col-span-2 lg:col-span-2">
                        <div className="flex items-center gap-2 text-slate-500 shrink-0 mr-2">
                            <Calendar size={16} />
                            <span className="text-xs font-bold hidden md:inline">รอบเวลา:</span>
                        </div>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => { setSelectedYear(parseInt(e.target.value)); setSelectedSpecificDate(''); }}
                            disabled={!!selectedSpecificDate}
                            className={`flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer ${selectedSpecificDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value={-1}>ทุกปี</option>
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select 
                            value={selectedMonth} 
                            onChange={(e) => { setSelectedMonth(parseInt(e.target.value)); setSelectedSpecificDate(''); }}
                            disabled={!!selectedSpecificDate}
                            className={`flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer ${selectedSpecificDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <option value={-1}>ทุกเดือน</option>
                            {MONTHS_TH.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                    </div>

                    {/* Specific Date */}
                    <div className="relative group col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-1">
                        <input 
                            type="date"
                            value={selectedSpecificDate}
                            onChange={(e) => setSelectedSpecificDate(e.target.value)}
                            className={`w-full px-2 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-brand-500 outline-none cursor-pointer ${selectedSpecificDate ? 'bg-brand-50 border-brand-300 text-brand-700 font-bold' : 'bg-slate-50 border-slate-200'}`}
                            title="ระบุวันที่แจ้งซ่อมเจาะจง"
                        />
                        {selectedSpecificDate && (
                            <button onClick={() => setSelectedSpecificDate('')} className="absolute right-2 top-2 text-slate-400 hover:text-red-500"><X size={14} /></button>
                        )}
                    </div>

                    {/* Job ID Prefix */}
                    <div className="col-span-1">
                        <select 
                            value={selectedPrefix} 
                            onChange={(e) => setSelectedPrefix(e.target.value)} 
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white outline-none cursor-pointer"
                        >
                            <option value="ALL">ทุกรหัสเอกสาร</option>
                            {availablePrefixes.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    {/* Department */}
                    <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-1">
                        <select value={selectedDepartment} onChange={(e) => setSelectedDepartment(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white outline-none cursor-pointer">
                            <option value="">ทุกแผนก</option>
                            {sortedDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>

                    {/* Repair Group */}
                    <div className="col-span-1 sm:col-span-1 md:col-span-2 lg:col-span-1">
                        <select value={selectedRepairGroup} onChange={(e) => setSelectedRepairGroup(e.target.value)} className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white outline-none cursor-pointer">
                            <option value="">ทุกกลุ่มงาน</option>
                            {sortedRepairGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                </div>

                {/* Row 1.5: Secondary Filters (Source, Tech, Overdue) */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                    {/* Job Source */}
                    <div className="flex bg-slate-100 p-0.5 rounded-lg shrink-0">
                        <button 
                            onClick={() => setSelectedSource('ALL')} 
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedSource === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                        >
                            ทุกประเภท
                        </button>
                        <button 
                            onClick={() => setSelectedSource('GENERAL')} 
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedSource === 'GENERAL' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}
                        >
                            <LayoutList size={14} className="inline mr-1"/> ทั่วไป
                        </button>
                        <button 
                            onClick={() => setSelectedSource('PM')} 
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${selectedSource === 'PM' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500'}`}
                        >
                            <Clock size={14} className="inline mr-1"/> PM
                        </button>
                    </div>

                    {/* Technician Filter */}
                    <div className="relative" ref={techFilterRef}>
                        <button 
                            onClick={() => setIsTechFilterOpen(!isTechFilterOpen)}
                            className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-sm font-bold transition-all whitespace-nowrap ${selectedTechs.length > 0 ? 'bg-white text-brand-600 border-brand-200 ring-1 ring-brand-100' : 'bg-slate-50 text-slate-500 border-slate-200'}`}
                        >
                            <Users size={14} />
                            <span>ช่าง {selectedTechs.length > 0 && `(${selectedTechs.length})`}</span>
                            <ChevronDown size={14} className="text-slate-400"/>
                        </button>
                        {isTechFilterOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 max-h-60 overflow-y-auto">
                                <div className="flex justify-between px-2 mb-2 pb-2 border-b border-slate-50">
                                    <button onClick={() => setSelectedTechs([])} className="text-[10px] text-red-500 font-bold hover:underline">ล้างค่า</button>
                                </div>
                                {technicians.filter(t => t.position === 'ช่าง').map(tech => (
                                    <label key={tech.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedTechs.includes(tech.id)}
                                            onChange={() => {
                                                if (selectedTechs.includes(tech.id)) setSelectedTechs(selectedTechs.filter(id => id !== tech.id));
                                                else setSelectedTechs([...selectedTechs, tech.id]);
                                            }}
                                            className="rounded text-brand-600 focus:ring-brand-500"
                                        />
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700">{tech.firstName}</span>
                                            <span className="text-xs text-slate-400">{tech.nickName}</span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Overdue Toggle */}
                    <button 
                        onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ml-auto md:ml-0 ${showOverdueOnly ? 'bg-red-50 border-red-200 text-red-600 ring-1 ring-red-100' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white'}`}
                        title={filter === 'ACTIVE' ? "แสดงงานที่เลยกำหนดทำ" : (filter === 'FINISHED' ? "แสดงงานที่เสร็จล่าช้ากว่ากำหนด" : "แสดงงานเกินกำหนดทั้งหมด")}
                    >
                        <AlertCircle size={14} /> 
                        {filter === 'ACTIVE' ? 'งานเกินกำหนด' : (filter === 'FINISHED' ? 'เสร็จล่าช้า' : 'เกินกำหนด/ล่าช้า')}
                    </button>
                </div>

                {/* Row 2: Advanced Date Range Filters */}
                <div className="flex flex-col md:flex-row flex-wrap items-center gap-4 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">กำหนดเสร็จ (Due):</span>
                        <input type="date" value={filterDueDateStart} onChange={e => setFilterDueDateStart(e.target.value)} className="px-2 py-1 border rounded text-xs bg-white focus:ring-1 focus:ring-brand-500 w-32" />
                        <span className="text-slate-400">-</span>
                        <input type="date" value={filterDueDateEnd} onChange={e => setFilterDueDateEnd(e.target.value)} className="px-2 py-1 border rounded text-xs bg-white focus:ring-1 focus:ring-brand-500 w-32" />
                    </div>
                    <div className="w-px h-4 bg-slate-200 hidden md:block"></div>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <span className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap">เสร็จจริง (Finished):</span>
                        <input type="date" value={filterFinishedDateStart} onChange={e => setFilterFinishedDateStart(e.target.value)} className="px-2 py-1 border rounded text-xs bg-white focus:ring-1 focus:ring-brand-500 w-32" />
                        <span className="text-slate-400">-</span>
                        <input type="date" value={filterFinishedDateEnd} onChange={e => setFilterFinishedDateEnd(e.target.value)} className="px-2 py-1 border rounded text-xs bg-white focus:ring-1 focus:ring-brand-500 w-32" />
                    </div>
                    
                    <button 
                        onClick={handleResetFilters}
                        className="px-2 py-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors ml-auto text-xs font-bold flex items-center gap-1"
                        title="ล้างค่าตัวกรองทั้งหมด"
                    >
                        <RotateCcw size={14} /> Reset
                    </button>
                </div>
            </div>
        )}
      </div>

      <div className="md:hidden flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {displayedJobs.length > 0 ? displayedJobs.map(job => (
            <div 
                key={job.id} 
                className={`p-4 rounded-xl shadow-sm border active:scale-[0.98] transition-transform ${job.pmPlanId ? 'bg-orange-50 border-orange-100' : 'bg-white border-slate-100'}`}
                onClick={() => onEdit(job)}
            >
               <div className="flex justify-between items-start mb-3">
                   <div className="flex flex-col">
                       <span className="text-[10px] font-bold text-slate-400 mb-0.5">{formatDate(job.dateReceived)}</span>
                       <div className="flex items-center gap-2">
                           <span className="text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md w-max">{job.jobRunningId}</span>
                           {job.pmPlanId && <span className="text-[10px] font-bold text-white bg-orange-500 px-1.5 py-0.5 rounded">PM</span>}
                           {job.attachments && job.attachments.length > 0 && <span title="มีไฟล์แนบ"><Paperclip size={12} className="text-slate-400"/></span>}
                       </div>
                   </div>
                   <div className="flex flex-col items-end gap-1">
                       <StatusBadge status={job.status} />
                       <span className="text-[10px] text-slate-500">{job.repairGroup}</span>
                   </div>
               </div>
               
               <h4 className="font-bold text-slate-800 text-sm mb-2 line-clamp-2">{job.itemDescription}</h4>
               
               <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                   <Building2 size={12}/> 
                   <span className="truncate max-w-[200px]">{job.department}</span>
               </div>

               <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                   <span className="text-xs text-slate-400">
                       {job.status === JobStatus.FINISHED && job.finishedDate 
                           ? <span className="text-emerald-600 font-bold">เสร็จ: {formatDate(job.finishedDate)}</span>
                           : (job.dueDate ? `กำหนด: ${formatDate(job.dueDate)}` : 'ไม่ระบุวันเสร็จ')
                       }
                   </span>
                   <div className="flex gap-2">
                       {canEdit && (
                           <>
                                <button 
                                        onClick={(e) => handleDeleteClick(job, e)}
                                        className="p-1.5 text-rose-500 bg-rose-50 rounded-lg"
                                >
                                    <Trash2 size={14}/>
                                </button>
                                <span className="p-1.5 text-brand-600 bg-brand-50 rounded-lg font-bold text-xs flex items-center">
                                    <Edit2 size={12} className="mr-1"/> แก้ไข
                                </span>
                           </>
                       )}
                   </div>
               </div>
            </div>
        )) : (
            <div className="flex flex-col items-center justify-center text-slate-400 py-10">
                <Search size={32} className="mb-2 opacity-20" />
                <p className="text-lg font-medium">ไม่พบข้อมูลงานซ่อม</p>
                <p className="text-sm opacity-70">ลองปรับตัวกรอง หรือคำค้นหาใหม่</p>
            </div>
        )}
      </div>

      {/* Table Container */}
      <div 
        className="hidden md:block overflow-auto flex-1 relative z-0 select-none"
        ref={tableScroll.ref}
        {...tableScroll.events}
        style={tableScroll.style}
      >
        <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0 z-20 shadow-sm">
                <tr>
                    <th className="px-4 py-3 font-semibold tracking-wider">เลขที่แจ้งซ่อม</th>
                    <th className="px-4 py-3 font-semibold tracking-wider">วันที่แจ้ง</th>
                    {/* Merged Job Type into ID column logic, removed standalone Type column header */}
                    <th className="px-4 py-3 font-semibold tracking-wider">แผนก</th>
                    <th className="px-4 py-3 font-semibold tracking-wider">รายการ</th>
                    <th className="px-4 py-3 font-semibold tracking-wider">ช่างผู้รับผิดชอบ</th>
                    <th className="px-4 py-3 font-semibold tracking-wider">สถานะ</th>
                    <th className="px-4 py-3 font-semibold tracking-wider">
                        {filter === 'ALL' ? 'กำหนดเสร็จ / วันที่แล้วเสร็จ' : (filter === 'FINISHED' ? 'วันที่แล้วเสร็จ' : (filter === 'WAITING' ? 'วันที่ส่งตรวจ' : 'กำหนดเสร็จ'))}
                    </th>
                    <th className="px-4 py-3 font-semibold tracking-wider text-right">{canEdit ? 'จัดการ' : 'ดูข้อมูล'}</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
                {displayedJobs.length > 0 ? displayedJobs.map(job => {
                    const deptInfo = getDeptCodeAndName(job.department);
                    
                    // Logic for Date Column highlighting
                    const isFinished = job.status === JobStatus.FINISHED || job.status === 'เสร็จสิ้น' as any || job.status === 'ปิดงานแล้ว' as any;
                    const isActive = job.status === JobStatus.IN_PROGRESS || job.status === 'รอดำเนินการ' as any || job.status === 'ดำเนินการ' as any;
                    const isWaiting = job.status === JobStatus.WAITING_INSPECTION;
                    const isOverdue = isActive && job.dueDate && job.dueDate < todayStr;
                    
                    // Logic for Rejection/Return (Active but has 'Reject' note)
                    const isRejected = isActive && job.assessment && job.assessment.startsWith('[ส่งแก้ไข]');

                    let finishDateDisplay = null;
                    let dueDateDisplay = null;

                    if (isFinished && job.finishedDate) {
                        const finishedLate = job.dueDate && job.finishedDate > job.dueDate;
                        finishDateDisplay = (
                            <span className="text-emerald-600 font-bold block" title="วันที่แล้วเสร็จ">
                                {formatDate(job.finishedDate)}
                            </span>
                        );
                        if (job.dueDate) {
                            dueDateDisplay = (
                                <span className={`text-[10px] block ${finishedLate ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                    Due: {formatDate(job.dueDate)}
                                </span>
                            );
                        }
                    } else if (isWaiting) {
                        // For Waiting Inspection, show when it was sent (finishedDate set by tech)
                        finishDateDisplay = (
                            <span className="text-blue-600 font-bold block" title="วันที่ส่งตรวจ">
                                ส่งตรวจ: {formatDate(job.finishedDate || job.lastUpdated?.split('T')[0])}
                            </span>
                        );
                    } else if (isActive && job.dueDate) {
                        dueDateDisplay = (
                            <div className="flex flex-col">
                                <span className={isOverdue ? "text-red-600 font-bold" : "text-slate-600"}>
                                    {formatDate(job.dueDate)}
                                </span>
                                {isOverdue && <span className="text-[10px] text-red-500 flex items-center gap-1 font-bold"><AlertCircle size={10}/> เกินกำหนด</span>}
                            </div>
                        );
                    } else {
                        dueDateDisplay = <span className="text-slate-300">-</span>;
                    }

                    return (
                        <tr key={job.id} className={`hover:bg-slate-50 transition-colors group cursor-default ${job.pmPlanId ? 'bg-orange-50/30' : 'bg-white'}`}>
                            <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-1">
                                        <span className="font-bold text-brand-700">{job.jobRunningId}</span>
                                        {job.attachments && job.attachments.length > 0 && <span title="มีไฟล์แนบ"><Paperclip size={12} className="text-slate-400" /></span>}
                                        {/* Rejection Badge */}
                                        {isRejected && (
                                            <span className="flex items-center gap-1 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full border border-red-200 font-bold animate-pulse" title="งานถูกส่งกลับให้แก้ไข">
                                                <ArrowLeftRight size={10}/> งานถูกตีกลับ
                                            </span>
                                        )}
                                    </div>
                                    {/* Moved Job Type Badge Here */}
                                    {job.pmPlanId ? (
                                        <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200 w-max">PM</span>
                                    ) : (
                                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] border border-slate-200 w-max">ทั่วไป</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{formatDate(job.dateReceived)}</td>
                            
                            <td className="px-4 py-3">
                                {deptInfo.code ? (
                                    <div>
                                        <span className="font-bold text-slate-700 block">{deptInfo.code}</span>
                                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]" title={job.department}>
                                            {job.department}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-slate-700 font-medium truncate max-w-[150px]" title={job.department}>{job.department}</div>
                                )}
                            </td>
                            <td className="px-4 py-3 text-slate-600">
                                <div className="truncate max-w-[200px]">{job.itemDescription}</div>
                            </td>
                            {/* TECHNICIAN COLUMN */}
                            <td className="px-4 py-3 text-slate-600 text-xs">
                                {job.technicianIds && job.technicianIds.length > 0 ? (
                                    <div className="flex flex-col gap-1">
                                        {job.technicianIds.map(id => {
                                            const t = technicians.find(tech => tech.id === id);
                                            return t ? (
                                                <span key={id} className="whitespace-nowrap">
                                                    {t.nickName} <span className="text-[10px] text-slate-400">({t.category})</span>
                                                </span>
                                            ) : null;
                                        })}
                                    </div>
                                ) : (
                                    <span className="text-slate-300">-</span>
                                )}
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex flex-col items-start gap-1">
                                    <StatusBadge status={job.status} />
                                    <span className="text-xs text-slate-500">{job.repairGroup}</span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-medium">
                                {finishDateDisplay}
                                {dueDateDisplay}
                            </td>
                            <td className="px-4 py-3 text-right">
                                {canEdit ? (
                                    <div className="flex justify-end gap-2">
                                        <button 
                                            onClick={(e) => handleDeleteClick(job, e)}
                                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="ลบ"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                        <button 
                                            onClick={() => onEdit(job)}
                                            className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors font-bold flex items-center text-xs"
                                            title="แก้ไข"
                                        >
                                            <Edit2 size={16}/>
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => onEdit(job)}
                                        className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="ดูรายละเอียด"
                                    >
                                        <Eye size={16}/>
                                    </button>
                                )}
                            </td>
                        </tr>
                    );
                }) : (
                    <tr>
                        <td colSpan={8} className="text-center py-12">
                            <div className="flex flex-col items-center justify-center text-slate-400">
                                <Search size={48} className="mb-4 opacity-20" />
                                <p className="text-lg font-medium">ไม่พบข้อมูลงานซ่อม</p>
                                <p className="text-sm opacity-70">ลองปรับตัวกรอง หรือคำค้นหาใหม่</p>
                            </div>
                        </td>
                    </tr>
                )}
            </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 bg-white flex justify-between items-center sticky bottom-0 z-50 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="text-xs text-slate-500">
                แสดงหน้า {currentPage} จาก {totalPages} ({filteredJobs.length} รายการ)
            </div>
            <div className="flex gap-1">
                <button 
                    onClick={() => setCurrentPage(1)} 
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronsLeft size={16}/>
                </button>
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={16}/>
                </button>
                
                <div className="flex items-center gap-1 mx-2">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let p = currentPage;
                        if (totalPages <= 5) p = i + 1;
                        else if (currentPage <= 3) p = i + 1;
                        else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
                        else p = currentPage - 2 + i;
                        
                        return (
                            <button 
                                key={p} 
                                onClick={() => setCurrentPage(p)}
                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === p ? 'bg-brand-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>

                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={16}/>
                </button>
                <button 
                    onClick={() => setCurrentPage(totalPages)} 
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronsRight size={16}/>
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default JobList;
