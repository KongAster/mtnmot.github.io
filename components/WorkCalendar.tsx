
import React, { useState, useMemo } from 'react';
import { Job, JobStatus, FactoryHoliday, formatDate, PMPlan, JOB_STATUS_DISPLAY } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, CheckCircle, MapPin, Wrench, AlertTriangle, XCircle, FileText } from 'lucide-react';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

interface WorkCalendarProps {
  jobs: Job[];
  holidays: FactoryHoliday[];
  pmPlans: PMPlan[];
  onJobClick: (job: Job) => void;
}

const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const WorkCalendar: React.FC<WorkCalendarProps> = ({ jobs, holidays, pmPlans, onJobClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Right Panel View Mode: 'REPAIR' or 'PM'
  const [detailViewMode, setDetailViewMode] = useState<'REPAIR' | 'PM'>('REPAIR');

  // Draggable hook for the detail panel list
  const detailScroll = useDraggableScroll<HTMLDivElement>();

  // Actions
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => {
      const now = new Date();
      setCurrentDate(now);
      setSelectedDate(now);
  };

  const handleDayClick = (day: number) => {
      setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
  };

  // --- Logic Helpers ---

  const getTodayStr = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  // --- PM PROJECTION LOGIC (Synced with MasterPMSchedule) ---
  const isHolidayOrSunday = (date: Date): boolean => {
      const day = date.getDay();
      if (day === 0) return true; // Sunday
      
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return holidays.some(h => h.date === dateStr);
  };

  const getNextWorkingDay = (date: Date): Date => {
      const d = new Date(date);
      let checks = 0;
      while (isHolidayOrSunday(d) && checks < 30) {
          d.setDate(d.getDate() + 1);
          checks++;
      }
      return d;
  };

  // Pre-calculate PMs for the current month view
  // Returns a Map: dateString -> PMPlan[]
  const projectedPMsMap = useMemo(() => {
      const map = new Map<string, PMPlan[]>();
      const viewYear = currentDate.getFullYear();
      const viewMonth = currentDate.getMonth();

      // Absolute month index for current view
      const viewAbsMonth = (viewYear * 12) + viewMonth;

      pmPlans.forEach(plan => {
          if (!plan.nextDueDate) return;

          const freq = Math.max(1, Number(plan.frequency) || 1);
          const nextDue = new Date(plan.nextDueDate);
          
          // Anchor
          const anchorDay = nextDue.getDate();
          const anchorAbsMonth = (nextDue.getFullYear() * 12) + nextDue.getMonth();

          // Calculate approximate cycle difference
          const diffMonth = viewAbsMonth - anchorAbsMonth;
          
          // Determine Range of K (Cycles) to check
          // We check k-1 to k+1 to catch plans that shift INTO this month from neighbors
          // e.g. Plan on Jan 31 shifts to Feb 1. In Feb view (diff=1), we need to check k=0 (Jan cycle)
          const minK = Math.floor((diffMonth - 1) / freq);
          const maxK = Math.ceil((diffMonth + 1) / freq);

          for (let k = minK; k <= maxK; k++) {
              const targetAbsMonth = anchorAbsMonth + (k * freq);
              
              // 1. Reconstruct Target Date
              const targetYear = Math.floor(targetAbsMonth / 12);
              const targetMonth = targetAbsMonth % 12;
              
              // Handle End-of-Month (e.g. 31st -> 28th)
              const maxDaysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
              const targetDay = Math.min(anchorDay, maxDaysInTargetMonth);
              
              const rawDate = new Date(targetYear, targetMonth, targetDay);

              // 2. Apply Holiday Shift
              const finalDate = getNextWorkingDay(rawDate);

              // 3. Store if it falls in the CURRENT view month
              if (finalDate.getMonth() === viewMonth && finalDate.getFullYear() === viewYear) {
                  const dateKey = `${finalDate.getFullYear()}-${String(finalDate.getMonth() + 1).padStart(2, '0')}-${String(finalDate.getDate()).padStart(2, '0')}`;
                  
                  if (!map.has(dateKey)) map.set(dateKey, []);
                  map.get(dateKey)?.push(plan);
              }
          }
      });

      return map;
  }, [pmPlans, currentDate, holidays]); // Recalculate when month changes

  // Generate Calendar Grid (Fixed 6 rows = 42 cells)
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); 
    const daysInMonth = lastDay.getDate();
    
    const grid: (number | null)[] = [];
    for (let i = 0; i < startOffset; i++) grid.push(null);
    for (let i = 1; i <= daysInMonth; i++) grid.push(i);
    while (grid.length < 42) grid.push(null);
    return grid;
  }, [currentDate]);

  // Optimized Data Map for the whole month (For Badges)
  const monthData = useMemo(() => {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const todayStr = getTodayStr();
      
      const dataMap = new Map<number, { activeCount: number, overdueCount: number, pmCount: number }>();
      const activeJobs = jobs.filter(j => j.status === JobStatus.IN_PROGRESS);

      for (let day = 1; day <= daysInMonth; day++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          
          let activeCount = 0;
          let overdueCount = 0;

          // 1. Calculate Repair Badges
          activeJobs.forEach(job => {
              if (dateStr >= job.dateReceived) {
                  if (job.dueDate && dateStr > job.dueDate) {
                      if (dateStr <= todayStr) overdueCount++;
                  } else {
                      activeCount++;
                  }
              }
          });

          // 2. Count PMs (Using Projected Map)
          const pmsOnDay = projectedPMsMap.get(dateStr) || [];
          const pmCount = pmsOnDay.length;

          dataMap.set(day, { activeCount, overdueCount, pmCount });
      }

      return dataMap;
  }, [jobs, projectedPMsMap, currentDate]);

  const getHolidayForDate = (day: number) => {
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return holidays.find(h => h.date === dateStr);
  };

  // --- Right Panel Data ---
  const selectedDateInfo = useMemo(() => {
      const sYear = selectedDate.getFullYear();
      const sMonth = selectedDate.getMonth();
      const sDay = selectedDate.getDate();
      const sDateStr = `${sYear}-${String(sMonth + 1).padStart(2, '0')}-${String(sDay).padStart(2, '0')}`;
      const todayStr = getTodayStr();

      // 1. REPAIRS List
      const repairs = jobs.filter(job => {
          if (job.status === JobStatus.FINISHED || job.status === JobStatus.CANCELLED || job.status === JobStatus.UNREPAIRABLE) {
              const endStr = job.finishedDate || (job.lastUpdated ? job.lastUpdated.split('T')[0] : '');
              return endStr === sDateStr;
          }
          if (job.status === JobStatus.IN_PROGRESS) {
              if (sDateStr < job.dateReceived) return false;
              if (job.dueDate && sDateStr > job.dueDate && sDateStr > todayStr) return false;
              return true;
          }
          return false;
      }).sort((a, b) => {
          const getWeight = (j: Job) => {
              if (j.status === JobStatus.IN_PROGRESS) {
                  if (j.dueDate && sDateStr > j.dueDate) return 4;
                  return 3;
              }
              if (j.status === JobStatus.FINISHED) return 2;
              return 1;
          };
          return getWeight(b) - getWeight(a);
      });

      // 2. PM List (Using Projected Map)
      const pms = projectedPMsMap.get(sDateStr) || [];

      const holiday = holidays.find(h => h.date === sDateStr);

      return { repairs, pms, holiday, sDateStr };
  }, [selectedDate, jobs, projectedPMsMap, holidays]);

  const safeString = (val: any) => {
      if (typeof val === 'string') return val;
      if (typeof val === 'number') return String(val);
      return '';
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row bg-slate-50 rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
        
        {/* LEFT: Calendar Grid (70-75%) */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="bg-brand-50 p-2 rounded-lg text-brand-600">
                        <CalendarIcon size={20} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">ปฏิทินแผนงาน</h2>
                        <p className="text-xs text-slate-500 hidden sm:block">ภาพรวมปริมาณงานประจำวัน</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={goToToday} className="text-xs font-bold text-brand-600 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors">วันนี้</button>
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                        <button onClick={prevMonth} className="p-1 hover:bg-white rounded-md transition-all shadow-sm text-slate-600"><ChevronLeft size={18}/></button>
                        <span className="text-sm font-bold text-slate-800 w-32 text-center select-none">
                            {MONTHS_TH[currentDate.getMonth()]} {currentDate.getFullYear() + 543}
                        </span>
                        <button onClick={nextMonth} className="p-1 hover:bg-white rounded-md transition-all shadow-sm text-slate-600"><ChevronRight size={18}/></button>
                    </div>
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 p-4 overflow-y-auto pb-20">
                <div className="grid grid-cols-7 border border-slate-200 rounded-xl overflow-hidden bg-slate-200 gap-px shadow-sm">
                    {/* Day Headers */}
                    {DAYS_TH.map((day, i) => (
                        <div key={day} className={`bg-slate-50 p-2 text-center text-xs font-bold uppercase tracking-wider ${i===0||i===6 ? 'text-rose-500' : 'text-slate-500'}`}>
                            {day}
                        </div>
                    ))}

                    {/* Day Cells */}
                    {calendarGrid.map((day, index) => {
                        if (!day) return <div key={`empty-${index}`} className="bg-slate-50/50 min-h-[120px]"></div>;
                        
                        const stats = monthData.get(day) || { activeCount: 0, overdueCount: 0, pmCount: 0 };
                        const holiday = getHolidayForDate(day);
                        const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === currentDate.getMonth() && selectedDate.getFullYear() === currentDate.getFullYear();
                        const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();

                        return (
                            <div 
                                key={day}
                                onClick={() => handleDayClick(day)}
                                className={`p-1 cursor-pointer transition-colors relative flex flex-col gap-1 group min-h-[120px]
                                    ${isSelected ? 'bg-blue-50 ring-2 ring-inset ring-brand-400 z-10' : 
                                      holiday ? 'bg-rose-50 hover:bg-rose-100/80' : 
                                      'bg-white hover:bg-slate-50'}
                                `}
                            >
                                {/* Date Header */}
                                <div className="flex justify-between items-start px-1 pt-1 shrink-0">
                                    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full 
                                        ${isToday ? 'bg-brand-600 text-white shadow-md' : 'text-slate-700'}
                                        ${holiday ? 'text-rose-600' : ''}
                                    `}>
                                        {day}
                                    </span>
                                </div>

                                {/* Count Badges */}
                                <div className="flex flex-col gap-1 px-1 mt-auto pb-1 shrink-0 w-full">
                                    {stats.overdueCount > 0 && (
                                        <div className="flex items-center justify-between text-[9px] bg-red-50 text-red-700 px-2 py-0.5 rounded font-bold border border-red-100 truncate w-full">
                                            <span>เลยกำหนด</span>
                                            <span>{stats.overdueCount}</span>
                                        </div>
                                    )}
                                    {stats.activeCount > 0 && (
                                        <div className="flex items-center justify-between text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold border border-blue-100 truncate w-full">
                                            <span>งานซ่อม</span>
                                            <span>{stats.activeCount}</span>
                                        </div>
                                    )}
                                    {stats.pmCount > 0 && (
                                        <div className="flex items-center justify-between text-[9px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded font-bold border border-orange-100 truncate w-full">
                                            <span>PM</span>
                                            <span>{stats.pmCount}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* RIGHT: Detail Panel */}
        <div className="w-full md:w-80 xl:w-96 bg-white border-l border-slate-200 flex flex-col shadow-xl z-20">
            {/* Panel Header */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    {selectedDate.getDate()} {MONTHS_TH[selectedDate.getMonth()]} {selectedDate.getFullYear() + 543}
                </h3>
                {selectedDateInfo.holiday && (
                    <div className="mt-2 bg-rose-50 text-rose-700 px-3 py-2 rounded-lg text-sm font-bold border border-rose-200 flex items-center gap-2 w-full animate-fade-in shadow-sm">
                        <CalendarIcon size={16} className="shrink-0 text-rose-600" /> 
                        <span>{safeString(selectedDateInfo.holiday.name)}</span>
                    </div>
                )}
                
                {/* Tabs */}
                <div className="flex bg-slate-200 p-1 rounded-lg mt-4">
                    <button 
                        onClick={() => setDetailViewMode('REPAIR')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${detailViewMode === 'REPAIR' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Wrench size={14} /> งานซ่อม ({selectedDateInfo.repairs.length})
                    </button>
                    <button 
                        onClick={() => setDetailViewMode('PM')}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-2 ${detailViewMode === 'PM' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <FileText size={14} /> PM ({selectedDateInfo.pms.length})
                    </button>
                </div>
            </div>

            {/* List Content */}
            <div 
                className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 pb-20"
                ref={detailScroll.ref}
                {...detailScroll.events}
                style={detailScroll.style}
            >
                {detailViewMode === 'REPAIR' ? (
                    selectedDateInfo.repairs.length > 0 ? (
                        selectedDateInfo.repairs.map(job => {
                            const isOverdue = job.status === JobStatus.IN_PROGRESS && job.dueDate && selectedDateInfo.sDateStr > job.dueDate;
                            const isFinished = job.status === JobStatus.FINISHED;
                            const isCancelled = job.status === JobStatus.CANCELLED || job.status === JobStatus.UNREPAIRABLE;

                            return (
                                <div 
                                    key={job.id}
                                    onClick={() => onJobClick(job)}
                                    className={`p-4 rounded-xl border shadow-sm transition-all relative overflow-hidden cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
                                        ${isFinished ? 'border-emerald-200 bg-emerald-50/30 hover:border-emerald-300' : 
                                          isCancelled ? 'border-slate-200 bg-slate-100/50 opacity-75 hover:border-slate-300' :
                                          isOverdue ? 'border-red-300 ring-1 ring-red-100 bg-red-50/30 hover:border-red-400' :
                                          'border-blue-200 hover:border-blue-300'}
                                    `}
                                >
                                    {isOverdue && <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-bl-lg font-bold z-10">เลยกำหนด</div>}
                                    
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border
                                            ${isFinished ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                              isCancelled ? 'bg-slate-200 text-slate-700 border-slate-300' :
                                              'bg-blue-50 text-blue-700 border-blue-100'}
                                        `}>
                                            {JOB_STATUS_DISPLAY[job.status] || safeString(job.status)}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-mono mr-auto ml-2">{safeString(job.jobRunningId)}</span>
                                    </div>
                                    
                                    <h4 className="font-bold text-sm text-slate-800 mb-1 line-clamp-2">{safeString(job.itemDescription)}</h4>
                                    
                                    <div className="space-y-1 mt-3 pt-3 border-t border-slate-50">
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <MapPin size={12} className="shrink-0"/> 
                                            <span className="truncate">{safeString(job.department)}</span>
                                        </div>
                                        
                                        {job.status === JobStatus.IN_PROGRESS && (
                                            <div className={`flex items-center gap-2 text-xs font-medium ${isOverdue ? 'text-red-600' : 'text-amber-600'}`}>
                                                <Clock size={12} className="shrink-0"/> 
                                                <span>ครบกำหนด: {formatDate(job.dueDate)}</span>
                                            </div>
                                        )}
                                        {isFinished && (
                                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                                                <CheckCircle size={12} className="shrink-0"/> 
                                                <span>ปิดงานแล้ว</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400 opacity-60">
                            <Wrench size={32} className="mb-2 opacity-50"/>
                            <p className="text-sm">ไม่มีรายการในวันนี้</p>
                        </div>
                    )
                ) : (
                    selectedDateInfo.pms.length > 0 ? (
                        selectedDateInfo.pms.map(pm => (
                            <div key={pm.id} className="p-4 rounded-xl border border-orange-200 bg-white shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-orange-50 text-orange-700 border-orange-100">
                                        แผน PM
                                    </span>
                                    {pm.type && <span className="text-[10px] text-slate-400">{pm.type}</span>}
                                </div>
                                <h4 className="font-bold text-sm text-slate-800 mb-1">{pm.name}</h4>
                                <div className="mt-2 pt-2 border-t border-slate-50 space-y-1">
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <MapPin size={12}/> {pm.department}
                                    </div>
                                    {pm.assetId && (
                                        <div className="text-xs text-slate-400 font-mono pl-5">ID: {pm.assetId}</div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-10 text-slate-400 opacity-60">
                            <FileText size={32} className="mb-2 opacity-50"/>
                            <p className="text-sm">ไม่มีแผนงาน PM</p>
                        </div>
                    )
                )}
            </div>
        </div>
    </div>
  );
};

export default WorkCalendar;
