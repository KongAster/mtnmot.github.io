
import React, { useState, useMemo, useEffect } from 'react';
import { PMPlan, Job, FactoryHoliday, JobStatus, RepairGroup } from '../types';
import { ChevronLeft, ChevronRight, Calendar, Info, Filter, LayoutGrid, CalendarDays, List, Search, ChevronsLeft, ChevronsRight, CheckCircle, AlertCircle, Clock, XCircle } from 'lucide-react';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

interface MasterPMScheduleProps {
  pmPlans: PMPlan[];
  jobs: Job[];
  holidays: FactoryHoliday[];
  departments: string[]; 
  pmTypes: string[]; 
  onUpdatePlan?: (plan: PMPlan) => void; 
}

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

// --- Helper for Symbol Multi-Select ---
const SymbolFilter = ({ selected, onChange }: { selected: string[], onChange: (vals: string[]) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const options = [
        { code: 'S', label: 'Start', color: 'text-red-600' },
        { code: 'P', label: 'Plan', color: 'text-yellow-600' },
        { code: 'EP', label: 'Ext. Plan', color: 'text-orange-600' },
        { code: 'C', label: 'Check', color: 'text-cyan-600' },
        { code: 'A', label: 'Actual', color: 'text-green-600' },
        { code: 'EC', label: 'Ext. Done', color: 'text-purple-600' },
        { code: 'WIP', label: 'WIP', color: 'text-blue-600' },
        { code: 'MISS', label: 'Missed', color: 'text-red-600' },
    ];

    return (
        <div className="relative">
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold outline-none cursor-pointer h-9 transition-colors ${selected.length > 0 ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white hover:bg-slate-50'}`}
            >
                <Filter size={14}/>
                <span>สัญลักษณ์ {selected.length > 0 && `(${selected.length})`}</span>
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 animate-fade-in-up">
                        <div className="flex justify-between items-center px-2 mb-2">
                            <span className="text-xs font-bold text-slate-500">เลือกสัญลักษณ์</span>
                            <button onClick={() => onChange([])} className="text-[10px] text-red-500 hover:underline">ล้าง</button>
                        </div>
                        <div className="space-y-1">
                            {options.map(opt => (
                                <label key={opt.code} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={selected.includes(opt.code)}
                                        onChange={(e) => {
                                            if (e.target.checked) onChange([...selected, opt.code]);
                                            else onChange(selected.filter(c => c !== opt.code));
                                        }}
                                        className="rounded text-brand-600 focus:ring-brand-500"
                                    />
                                    <span className={`text-xs font-bold ${opt.color}`}>{opt.code}</span>
                                    <span className="text-[10px] text-slate-400 ml-auto">{opt.label}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// --- Helper for Plan Type Selector in Table ---
const PlanTypeSelect = ({ value, onChange, disabled }: { value?: string, onChange: (val: string) => void, disabled?: boolean }) => {
    const colorClass = 
        value === 'S' ? 'bg-red-50 text-red-600 border-red-200' :
        value === 'EP' ? 'bg-orange-50 text-orange-600 border-orange-200' :
        value === 'C' ? 'bg-cyan-50 text-cyan-600 border-cyan-200' :
        'bg-yellow-50 text-yellow-600 border-yellow-200';

    if (disabled) {
        return <span className={`text-[10px] font-black px-1.5 py-0 rounded border ${colorClass}`}>{value || 'P'}</span>;
    }

    return (
        <div className="relative group inline-block">
            <select 
                value={value || 'P'}
                onChange={(e) => onChange(e.target.value)}
                className={`appearance-none cursor-pointer text-[10px] font-black px-1.5 py-0 rounded border outline-none text-center min-w-[32px] ${colorClass} hover:brightness-95 transition-all`}
            >
                <option value="S">S</option>
                <option value="P">P</option>
                <option value="EP">EP</option>
                <option value="C">C</option>
            </select>
        </div>
    );
};

const MasterPMSchedule: React.FC<MasterPMScheduleProps> = ({ pmPlans, jobs, holidays, departments, pmTypes, onUpdatePlan }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [view, setView] = useState<'MASTER_PLAN' | 'DAILY'>('MASTER_PLAN');
  const [month, setMonth] = useState(new Date().getMonth());
  
  // Filters
  const [filterType, setFilterType] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [search, setSearch] = useState('');
  const [filterSymbols, setFilterSymbols] = useState<string[]>([]); // New Symbol Filter

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  // UPDATED: Increase items per page to 20 for better density
  const itemsPerPage = 20; 

  const scroll = useDraggableScroll<HTMLDivElement>();

  // Reset page when filters change
  useEffect(() => {
      setCurrentPage(1);
  }, [year, view, month, filterType, filterDept, search, filterSymbols]);

  // --- Helper to determine PLAN Code ---
  const getPlanCode = (plan: PMPlan): string => {
      if (plan.planType) return plan.planType; 
      const combined = (plan.type + plan.name).toLowerCase();
      if (combined.includes('จ้าง') || combined.includes('external') || combined.includes('นอก')) return 'EP';
      if (combined.includes('check') || combined.includes('ตรวจ')) return 'C';
      return 'P'; // Default
  };

  // --- Helper to determine ACTUAL Code ---
  const getActualCode = (job: Job, planCode: string): string => {
      if (job.status === JobStatus.FINISHED) {
          // Rule: S, P, C -> A | EP -> EC
          if (planCode === 'EP') return 'EC';
          if (['S', 'P', 'C'].includes(planCode)) return 'A';
          
          // Fallback based on Job Type/Group if planCode ambiguous
          if (job.repairGroup === RepairGroup.EXTERNAL) return 'EC';
          return 'A'; 
      }
      if (job.status === JobStatus.IN_PROGRESS) return 'WIP';
      return 'MISS';
  };

  // --- Helper: Check if date is Holiday or Sunday ---
  const isHolidayOrSunday = (date: Date): boolean => {
      const day = date.getDay();
      if (day === 0) return true; // Sunday
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return holidays.some(h => h.date === dateStr);
  };

  // --- Helper: Find next valid working day ---
  const getNextWorkingDay = (date: Date): Date => {
      const d = new Date(date);
      let checks = 0;
      while (isHolidayOrSunday(d) && checks < 30) {
          d.setDate(d.getDate() + 1);
          checks++;
      }
      return d;
  };

  // Filter Plans first (Common for both views)
  const filteredPlans = useMemo(() => {
      return pmPlans.filter(p => {
          const matchType = !filterType || p.type === filterType;
          const matchDept = !filterDept || p.department === filterDept;
          const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.assetId || '').toLowerCase().includes(search.toLowerCase());
          return matchType && matchDept && matchSearch;
      });
  }, [pmPlans, filterType, filterDept, search]);

  // --- Master Plan Matrix Logic ---
  const masterMatrixData = useMemo(() => {
      const totalMonths = 12; 
      
      const matrix = filteredPlans.map(plan => {
          const schedule = Array(totalMonths).fill('N/A'); 
          const planCode = getPlanCode(plan);
          const freq = Math.max(1, Number(plan.frequency) || 1);

          if (plan.nextDueDate) {
              const nextDue = new Date(plan.nextDueDate);
              const anchorDay = nextDue.getDate();
              const anchorMonth = nextDue.getMonth();
              const anchorYear = nextDue.getFullYear();
              const anchorAbsMonth = (anchorYear * 12) + anchorMonth;
              const viewStartAbsMonth = (year * 12);
              const viewEndAbsMonth = (year * 12) + 11; 

              for (let i = -24; i <= 24; i++) {
                  const targetAbsMonth = anchorAbsMonth + (i * freq);
                  if (targetAbsMonth >= viewStartAbsMonth && targetAbsMonth <= viewEndAbsMonth) {
                      const targetYear = Math.floor(targetAbsMonth / 12);
                      const targetMonth = targetAbsMonth % 12;
                      const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
                      const targetDay = Math.min(anchorDay, maxDaysInTargetMonth);
                      const rawDate = new Date(targetYear, targetMonth, targetDay);
                      const finalDate = getNextWorkingDay(rawDate);
                      const finalAbsMonth = (finalDate.getFullYear() * 12) + finalDate.getMonth();
                      
                      if (finalAbsMonth >= viewStartAbsMonth && finalAbsMonth <= viewEndAbsMonth) {
                          const matrixIndex = finalAbsMonth - viewStartAbsMonth;
                          if (matrixIndex >= 0 && matrixIndex < totalMonths) {
                              schedule[matrixIndex] = planCode;
                          }
                      }
                  }
              }
          }

          jobs.forEach(j => {
              if (j.pmPlanId === plan.id) {
                  const d = new Date(j.dateReceived);
                  if (d.getFullYear() === year) {
                      const matrixIndex = d.getMonth();
                      if (matrixIndex >= 0 && matrixIndex < totalMonths) {
                          if (j.status === JobStatus.CANCELLED) {
                              schedule[matrixIndex] = 'SKIP';
                          } else {
                              schedule[matrixIndex] = getActualCode(j, planCode);
                          }
                      }
                  }
              }
          });

          const today = new Date();
          today.setHours(0,0,0,0);
          schedule.forEach((status, idx) => {
              if (['S', 'P', 'EP', 'C'].includes(status)) {
                  const endOfMonth = new Date(year, idx + 1, 0);
                  if (endOfMonth < today) {
                      schedule[idx] = 'MISS';
                  }
              }
          });

          return { ...plan, schedule };
      });

      if (filterSymbols.length > 0) {
          return matrix.filter(row => row.schedule.some(s => filterSymbols.includes(s))).sort((a,b) => a.name.localeCompare(b.name));
      }
      return matrix.sort((a,b) => a.name.localeCompare(b.name));

  }, [filteredPlans, jobs, year, holidays, filterSymbols]); 

  // --- Monthly (Daily) Matrix Logic ---
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysHeader = Array.from({length: daysInMonth}, (_, i) => i + 1);

  const dailyMatrixData = useMemo(() => {
      const currentAbsMonth = (year * 12) + month;

      const matrix = filteredPlans.map(plan => {
          const schedule = Array(daysInMonth).fill(null);
          const planCode = getPlanCode(plan);

          if (plan.nextDueDate) {
              const nextDue = new Date(plan.nextDueDate);
              const anchorDay = nextDue.getDate();
              const anchorAbsMonth = (nextDue.getFullYear() * 12) + nextDue.getMonth();
              const freq = Math.max(1, Number(plan.frequency) || 1);
              
              const diffMonth = currentAbsMonth - anchorAbsMonth;
              const minK = Math.floor((diffMonth - 1) / freq);
              const maxK = Math.ceil((diffMonth + 1) / freq);

              for (let k = minK; k <= maxK; k++) {
                  const targetAbsMonth = anchorAbsMonth + (k * freq);
                  const targetYear = Math.floor(targetAbsMonth / 12);
                  const targetMonth = targetAbsMonth % 12;
                  
                  const maxDays = new Date(targetYear, targetMonth + 1, 0).getDate();
                  const targetDay = Math.min(anchorDay, maxDays);
                  const rawDate = new Date(targetYear, targetMonth, targetDay);
                  
                  const finalDate = getNextWorkingDay(rawDate);
                  
                  if (finalDate.getMonth() === month && finalDate.getFullYear() === year) {
                      schedule[finalDate.getDate() - 1] = planCode;
                  }
              }
          }

          jobs.filter(j => j.pmPlanId === plan.id).forEach(j => {
              const d = new Date(j.dateReceived);
              if (d.getMonth() === month && d.getFullYear() === year) {
                  const idx = d.getDate() - 1;
                  if (j.status === JobStatus.CANCELLED) {
                      schedule[idx] = 'SKIP';
                  } else {
                      schedule[idx] = getActualCode(j, planCode);
                  }
              }
          });

          return { ...plan, schedule };
      });

      // Filter rows that have activity in this month OR match specific symbol filters
      const activeRows = matrix.filter(row => {
          const hasActivity = row.schedule.some(s => s !== null);
          
          if (filterSymbols.length > 0) {
             return row.schedule.some(s => filterSymbols.includes(s));
          }
          
          return hasActivity; // NEW: Only show rows with activity in Daily View
      });

      return activeRows.sort((a,b) => a.name.localeCompare(b.name));

  }, [filteredPlans, jobs, year, month, daysInMonth, holidays, filterSymbols]);

  const currentData = view === 'MASTER_PLAN' ? masterMatrixData : dailyMatrixData;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const displayedRows = currentData.slice(startIdx, startIdx + itemsPerPage);

  const totalStats = useMemo(() => {
      let totalPlan = 0;
      let totalDone = 0;
      let totalWip = 0;
      let totalMissed = 0; // Added Missed
      const data = view === 'DAILY' ? dailyMatrixData : masterMatrixData;
      data.forEach(row => {
          row.schedule.forEach(cell => {
              if(['P', 'S', 'EP', 'C'].includes(cell)) totalPlan++;
              if(['A', 'EC'].includes(cell)) totalDone++;
              if(cell === 'WIP') totalWip++;
              if(['MISS', 'SKIP', 'X'].includes(cell)) totalMissed++; // Track missed
          });
      });
      return { totalPlan, totalDone, totalWip, totalMissed };
  }, [masterMatrixData, dailyMatrixData, view]);

  const renderSymbol = (status: string) => {
      switch(status) {
          case 'A': return <span className="inline-block text-[10px] font-black text-green-600 border border-green-200 bg-green-50 px-1 py-0 rounded shadow-sm">A</span>;
          case 'EC': return <span className="inline-block text-[10px] font-black text-purple-600 border border-purple-200 bg-purple-50 px-1 py-0 rounded shadow-sm">EC</span>;
          case 'WIP': return <span className="inline-block text-[10px] font-black text-blue-600 border border-blue-200 bg-blue-50 px-1 py-0 rounded shadow-sm">W</span>;
          case 'MISS': 
          case 'SKIP': return <span className="inline-block text-[10px] font-black text-red-600 border border-red-200 bg-red-50 px-1 py-0 rounded shadow-sm">X</span>;
          case 'S': return <span className="inline-block text-[10px] font-black text-red-600 border border-red-200 bg-red-50 px-1 py-0 rounded">S</span>;
          case 'EP': return <span className="inline-block text-[10px] font-black text-orange-600 border border-orange-200 bg-orange-50 px-1 py-0 rounded">EP</span>;
          case 'C': return <span className="inline-block text-[10px] font-black text-cyan-600 border border-cyan-200 bg-cyan-50 px-1 py-0 rounded">C</span>;
          case 'P': 
          case 'PLAN': return <span className="inline-block text-[10px] font-black text-yellow-600 border border-yellow-200 bg-yellow-50 px-1 py-0 rounded">P</span>;
          default: return null;
      }
  };

  return (
    // ADJUSTED HEIGHT: Fit screen (100vh - header offset ~180px)
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col h-[calc(100vh-180px)] min-h-[500px]">
        <div className="flex flex-col gap-3 p-3 border-b border-slate-100 bg-white shrink-0">
            
            {/* Top Row: View Mode + Filters + Stats */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3">
                {/* Left: View & Filters */}
                <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                    {/* View Switcher */}
                    <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                        <button 
                            onClick={() => setView('MASTER_PLAN')} 
                            className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all ${view==='MASTER_PLAN' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <Calendar size={14}/> แผนหลักรายปี
                        </button>
                        <div className="w-px bg-slate-200 my-1 mx-1"></div>
                        <button 
                            onClick={() => setView('DAILY')} 
                            className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all ${view==='DAILY' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <CalendarDays size={14}/> แผนหลักรายเดือน
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="relative flex-1 xl:flex-none">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400"/>
                        <input 
                            className="pl-8 pr-3 py-1.5 border rounded-lg text-xs outline-none w-full xl:w-64 h-9" 
                            placeholder="ค้นหา (เครื่องจักร, รหัส)..." 
                            value={search} 
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    
                    {/* Department Filter (Moved) */}
                    <select 
                        className="px-3 py-1.5 border rounded-lg text-xs outline-none cursor-pointer bg-white hover:bg-slate-50 focus:ring-2 focus:ring-brand-500/20 h-9 min-w-[150px] max-w-[200px]"
                        value={filterDept} 
                        onChange={e => setFilterDept(e.target.value)}
                    >
                        <option value="">ทุกแผนก</option>
                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>

                    {/* Asset Type Filter (New) */}
                    <select 
                        className="px-3 py-1.5 border rounded-lg text-xs outline-none cursor-pointer bg-white hover:bg-slate-50 focus:ring-2 focus:ring-brand-500/20 h-9 min-w-[150px] max-w-[200px]"
                        value={filterType} 
                        onChange={e => setFilterType(e.target.value)}
                    >
                        <option value="">ทุกประเภท</option>
                        {pmTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <SymbolFilter selected={filterSymbols} onChange={setFilterSymbols} />
                </div>

                {/* Right: Stats Summary (Cards) - Moved from Footer */}
                <div className="grid grid-cols-4 gap-2 w-full xl:w-auto xl:min-w-[320px]">
                    <div className="flex flex-col items-center justify-center bg-yellow-50 border border-yellow-200 p-1 rounded-lg">
                        <span className="text-[9px] text-yellow-700 font-bold uppercase tracking-wider">แผน (P)</span>
                        <span className="text-xs font-black text-yellow-800">{totalStats.totalPlan}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-green-50 border border-green-200 p-1 rounded-lg">
                        <span className="text-[9px] text-green-700 font-bold uppercase tracking-wider">เสร็จ (A)</span>
                        <span className="text-xs font-black text-green-800">{totalStats.totalDone}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-blue-50 border border-blue-200 p-1 rounded-lg">
                        <span className="text-[9px] text-blue-700 font-bold uppercase tracking-wider">ทำ (W)</span>
                        <span className="text-xs font-black text-blue-800">{totalStats.totalWip}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center bg-red-50 border border-red-200 p-1 rounded-lg">
                        <span className="text-[9px] text-red-700 font-bold uppercase tracking-wider">พลาด (X)</span>
                        <span className="text-xs font-black text-red-800">{totalStats.totalMissed}</span>
                    </div>
                </div>
            </div>

            {/* Bottom Row: Time Navigation (Full Width) */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-slate-50/50 p-2 rounded-xl border border-slate-200">
                 {/* Year Control (Always Visible) */}
                 <div className="flex items-center justify-between md:justify-start gap-2 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm shrink-0">
                    <button onClick={() => setYear(y => y-1)} className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors"><ChevronLeft size={18}/></button>
                    <span className="font-bold text-sm text-slate-800 w-20 text-center select-none">
                        {year + 543}
                    </span>
                    <button onClick={() => setYear(y => y+1)} className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors"><ChevronRight size={18}/></button>
                 </div>

                 {/* Month Control (Only Visible in Daily View) */}
                 {view === 'DAILY' && (
                     <div className="flex-1 w-full">
                        <div className="grid grid-cols-6 lg:grid-cols-12 gap-1 h-full">
                            {MONTHS_TH.map((m, i) => (
                                <button
                                    key={i}
                                    onClick={() => setMonth(i)}
                                    className={`px-1 py-1.5 text-[10px] sm:text-xs rounded-md border transition-all truncate ${
                                        month === i 
                                        ? 'bg-slate-800 text-white border-slate-800 shadow-sm font-bold scale-[1.02]' 
                                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700'
                                    }`}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                     </div>
                 )}
            </div>
        </div>

        {/* Legend (Compact) */}
        <div className="px-4 py-1.5 border-b border-slate-100 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-600 bg-white shrink-0">
            <div className="font-bold mr-2 flex items-center gap-1"><Info size={12}/> Symbols:</div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-black text-red-600 border border-red-200 bg-red-50 px-1 py-0 rounded">S</span> Start</div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-black text-yellow-600 border border-yellow-200 bg-yellow-50 px-1 py-0 rounded">P</span> Plan</div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-black text-orange-600 border border-orange-200 bg-orange-50 px-1 py-0 rounded">EP</span> Ext.Plan</div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-black text-cyan-600 border border-cyan-200 bg-cyan-50 px-1 py-0 rounded">C</span> Check</div>
            <div className="w-px h-3 bg-slate-300 mx-1"></div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-black text-green-600 border border-green-200 bg-green-50 px-1 py-0 rounded shadow-sm">A</span> Actual</div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-black text-purple-600 border border-purple-200 bg-purple-50 px-1 py-0 rounded shadow-sm">EC</span> Ext.Done</div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-black text-blue-600 border border-blue-200 bg-blue-50 px-1 py-0 rounded shadow-sm">W</span> WIP</div>
            <div className="flex items-center gap-1"><span className="text-[9px] font-black text-red-600 border border-red-200 bg-red-50 px-1 py-0 rounded shadow-sm">X</span> Missed</div>
        </div>

        {/* Content Table */}
        <div 
            className="flex-1 overflow-auto select-none relative"
            ref={scroll.ref}
            {...scroll.events}
            style={scroll.style}
        >
            <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-30 shadow-sm">
                    <tr>
                        <th rowSpan={2} className="px-2 py-2 bg-slate-100 sticky left-0 z-40 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] w-[220px] text-[11px]">รายการเครื่องจักร (Machine)</th>
                        {/* Compact Header Columns */}
                        <th rowSpan={2} className="px-1 py-2 text-center border-r border-slate-200 bg-slate-100 w-[90px] text-[10px]">ประเภท</th>
                        <th rowSpan={2} className="px-1 py-2 text-center border-r border-slate-200 bg-slate-100 w-[70px] text-[10px]">รหัส</th>
                        <th rowSpan={2} className="px-1 py-2 text-center border-r border-slate-200 bg-slate-100 w-[70px] text-[10px]">แผนก</th>
                        <th rowSpan={2} className="px-1 py-2 text-center border-r border-slate-200 bg-slate-100 w-[40px] text-[10px]">Freq</th>
                        <th rowSpan={2} className="px-1 py-2 text-center border-r border-slate-200 bg-slate-100 w-[40px] text-[10px]">Plan</th> 
                        
                        {view === 'MASTER_PLAN' && (
                            <th colSpan={12} className="px-1 py-1 text-center border-b border-slate-200 bg-brand-50 text-brand-700 text-[11px]">{year + 543}</th>
                        )}

                        {view === 'DAILY' && daysHeader.map(d => {
                             const date = new Date(year, month, d);
                             const dayIdx = date.getDay();
                             const isSunday = dayIdx === 0;
                             const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                             const isHoliday = holidays.some(h => h.date === dateStr);
                             return (
                                 <th key={d} className={`px-0 py-1 text-center border-r border-slate-200 min-w-[30px] ${isHoliday ? 'bg-red-50 text-red-700' : (isSunday ? 'bg-rose-50 text-rose-600' : '')}`}>
                                     <div className="text-[9px] font-normal opacity-70">{DAYS_TH[dayIdx]}</div>
                                     <div className="text-[10px]">{d}</div>
                                 </th>
                             );
                        })}
                    </tr>
                    {/* Month Sub-headers */}
                    {view === 'MASTER_PLAN' && (
                        <tr>
                            {MONTHS_TH.map((m, i) => <th key={`m-${i}`} className="px-1 py-1 text-center border-r border-b border-slate-200 min-w-[40px] text-[10px] bg-white text-slate-600">{m}</th>)}
                        </tr>
                    )}
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {displayedRows.map(row => (
                        <tr key={row.id} className="hover:bg-slate-50 group transition-colors h-8">
                            <td className="px-2 py-1 border-r border-slate-100 bg-white group-hover:bg-slate-50 sticky left-0 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] align-middle">
                                <div className="font-bold text-slate-700 truncate max-w-[200px] text-[11px]" title={row.name}>{row.name}</div>
                            </td>
                            {/* Compact Body Columns */}
                            <td className="px-1 py-1 text-center border-r border-slate-100 text-[10px] text-slate-500 truncate max-w-[90px] align-middle" title={row.type}>{row.type || '-'}</td>
                            <td className="px-1 py-1 text-center border-r border-slate-100 text-[10px] font-mono text-brand-600 align-middle">{row.assetId || '-'}</td>
                            <td className="px-1 py-1 text-center border-r border-slate-100 truncate max-w-[70px] text-[10px] align-middle" title={row.department}>
                                {(() => {
                                    const match = row.department.match(/\(([^)]+)\)/);
                                    return match ? match[1] : row.department;
                                })()}
                            </td>
                            <td className="px-1 py-1 text-center border-r border-slate-100 text-[10px] font-bold text-slate-400 align-middle">{row.frequency}</td>
                            
                            <td className="px-1 py-1 text-center border-r border-slate-100 align-middle">
                                {onUpdatePlan ? (
                                    <PlanTypeSelect 
                                        value={row.planType || 'P'} 
                                        onChange={(newType) => onUpdatePlan({ ...row, planType: newType as any })} 
                                    />
                                ) : (
                                    <span className="text-[10px] font-bold text-slate-400">{row.planType || 'P'}</span>
                                )}
                            </td>

                            {row.schedule.map((status, i) => (
                                <td key={i} className={`px-0 py-0.5 text-center border-r border-slate-100 relative align-middle ${view === 'DAILY' && daysHeader[i] ? (() => {
                                    const d = daysHeader[i];
                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                    const isHoliday = holidays.some(h => h.date === dateStr);
                                    const isSunday = new Date(year, month, d).getDay() === 0;
                                    return isHoliday ? 'bg-red-50/50' : (isSunday ? 'bg-rose-50/30' : '');
                                })() : ''}`}>
                                    {renderSymbol(status)}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
                {/* FOOTER REMOVED AS REQUESTED */}
            </table>
            {((view !== 'DAILY' && masterMatrixData.length === 0) || (view === 'DAILY' && dailyMatrixData.length === 0)) && (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                    <Info size={32} className="mb-2 opacity-50"/>
                    <p>ไม่มีข้อมูลแผนงานในช่วงเวลานี้</p>
                </div>
            )}
        </div>

        {/* --- Pagination Controls --- */}
        {totalPages > 1 && (
            <div className="p-2 border-t border-slate-100 bg-white flex justify-between items-center shrink-0">
                <div className="text-xs text-slate-500">
                    หน้า {currentPage} / {totalPages} ({currentData.length} รายการ)
                </div>
                <div className="flex gap-1">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage===1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronsLeft size={16}/></button>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={16}/></button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={16}/></button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage===totalPages} className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"><ChevronsRight size={16}/></button>
                </div>
            </div>
        )}
    </div>
  );
};

export default MasterPMSchedule;
