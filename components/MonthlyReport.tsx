
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Job, Technician, JobStatus, PMPlan, RepairGroup, formatDate } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts';
import { 
  ChevronLeft, ChevronRight, Monitor, Printer, FileText, TrendingUp, CheckCircle, AlertCircle, Clock, Wrench, Activity, ChevronDown, CheckSquare, Square, Filter, Coins, List, XCircle
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface MonthlyReportProps {
  jobs: Job[];
  technicians: Technician[];
  departments: string[];
  companies: string[];
  jobTypes: string[]; 
  pmPlans?: PMPlan[];
  repairGroups: string[]; // Add repairGroups prop
}

const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#3b82f6', '#64748b'];

// Use System Standard Font (Sarabun)
const FORMAL_FONT = '"Sarabun", sans-serif'; 

// A4 Dimensions in Pixels (96 DPI) - Standard
const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

// Helper to check status (Robust for legacy data)
const isFinished = (status: string) => status === JobStatus.FINISHED || status === 'เสร็จสิ้น' || status === 'ปิดงานแล้ว';
const isPending = (status: string) => status === JobStatus.IN_PROGRESS || status === 'รอดำเนินการ' || status === 'ดำเนินการ';
const isCancelled = (status: string) => status === JobStatus.CANCELLED || status === JobStatus.UNREPAIRABLE || status === 'ยกเลิก' || status === 'ซ่อมไม่ได้';

// --- Helper for Balanced Percentage ---
// Ensures the sum of percentages is exactly 100 by adjusting the largest value
const getBalancedPercentages = (values: number[]): number[] => {
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return values.map(() => 0);

    const rawPercentages = values.map(v => (v / total) * 100);
    const rounded = rawPercentages.map(Math.round);
    const sumRounded = rounded.reduce((a, b) => a + b, 0);
    const diff = 100 - sumRounded;

    if (diff !== 0) {
        // Find index of the largest value in the ORIGINAL data to absorb the diff
        let maxVal = -1;
        let maxIdx = 0;
        values.forEach((v, i) => {
            if (v > maxVal) {
                maxVal = v;
                maxIdx = i;
            }
        });
        rounded[maxIdx] += diff;
    }
    return rounded;
};

const PageContainer: React.FC<{ 
    children: React.ReactNode; 
    pageNum: number; 
    totalPages: number; 
    month: number; 
    year: number; 
    id?: string;
}> = ({ children, pageNum, totalPages, month, year, id }) => (
  <div 
    className="preview-wrapper shadow-2xl bg-white relative"
    style={{ 
        width: A4_WIDTH, 
        height: A4_HEIGHT, 
        transform: 'scale(1)', 
        transformOrigin: 'top center',
        marginBottom: '2rem', // Spacing between pages
        flexShrink: 0
    }}
  >
    <div
        id={id}
        className="flex flex-col relative pdf-page bg-white"
        style={{ 
            width: '100%', 
            height: '100%', 
            fontFamily: FORMAL_FONT,
            padding: '40px 50px', // Standard A4 Padding
            color: '#1e293b', // Slate-800 for better readability
            boxSizing: 'border-box',
            lineHeight: 1.5, // Increased line height slightly
            backgroundColor: 'white'
        }}
    >
        {/* Header */}
        <div className="border-b-2 border-slate-800 pb-2 mb-4 flex justify-between items-end shrink-0 h-[80px]">
            <div className="flex gap-4 items-center">
                <div className="w-14 h-14 bg-slate-900 text-white flex items-center justify-center rounded-xl shadow-sm print:bg-black">
                    <Monitor size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 leading-none tracking-tight">Maintenance Report</h1>
                    <p className="text-sm font-medium text-slate-500 mt-1">Better World Green Public Company Limited</p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-lg font-bold text-slate-900">ประจำเดือน {MONTHS_TH[month]} {year + 543}</p>
                <p className="text-xs text-slate-400">Page {pageNum} of {totalPages}</p>
            </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col relative overflow-hidden pb-4 space-y-3">
            {children}
        </div>

        {/* Footer Information */}
        <div className="absolute bottom-5 left-10 right-10 pt-3 border-t border-slate-200 flex justify-between items-center text-xs text-slate-400">
            <p>System Generated Report • Internal Use Only</p>
            <p>พิมพ์เมื่อ: {new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })}</p>
        </div>
    </div>
  </div>
);

const MonthlyReport: React.FC<MonthlyReportProps> = ({ jobs, technicians, departments, companies, jobTypes, pmPlans = [], repairGroups = [] }) => {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  
  // Multi-select for Job Types
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(jobTypes);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  const [isExporting, setIsExporting] = useState(false);

  // Close dropdown on click outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
              setIsTypeDropdownOpen(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync types on prop change
  useEffect(() => {
      setSelectedJobTypes(jobTypes);
  }, [jobTypes]);

  const reportData = useMemo(() => {
    const monthlyJobs = jobs.filter(j => {
      const d = new Date(j.dateReceived);
      const matchDate = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      const matchType = selectedJobTypes.length === 0 || selectedJobTypes.includes(j.jobType || '');
      return matchDate && matchType;
    }).sort((a,b) => a.jobRunningId.localeCompare(b.jobRunningId));

    const pmSummary = {
        totalPlan: 0,
        done: 0,
        wip: 0,
        missed: 0
    };

    pmPlans.forEach(plan => {
        let isRelevant = false;
        if (plan.nextDueDate) {
            const d = new Date(plan.nextDueDate);
            if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) isRelevant = true;
        }
        const jobForPlan = monthlyJobs.find(j => j.pmPlanId === plan.id);
        if (jobForPlan) isRelevant = true;

        if (isRelevant) {
            pmSummary.totalPlan++;
            if (jobForPlan) {
                if (isFinished(jobForPlan.status)) pmSummary.done++;
                else if (isPending(jobForPlan.status)) pmSummary.wip++;
                else pmSummary.missed++;
            } else {
                const today = new Date();
                const due = new Date(plan.nextDueDate!);
                if (today > due) pmSummary.missed++; 
                else pmSummary.wip++;
            }
        }
    });

    return { monthlyJobs, pmSummary };
  }, [jobs, pmPlans, selectedYear, selectedMonth, selectedJobTypes]);

  const stats = useMemo(() => {
    const total = reportData.monthlyJobs.length;
    const finished = reportData.monthlyJobs.filter(j => isFinished(j.status)).length;
    const inProgress = reportData.monthlyJobs.filter(j => isPending(j.status)).length;
    const cancelled = reportData.monthlyJobs.filter(j => isCancelled(j.status)).length;
    
    // Balanced percentages for top level summary
    const [completionRate, inProgressRate, cancelledRate] = getBalancedPercentages([finished, inProgress, cancelled]);
    
    const totalCost = reportData.monthlyJobs.reduce((sum, j) => sum + (j.costs?.reduce((s, c) => s + c.totalPrice, 0) || 0), 0);
    
    // Dept Stats - Show ALL departments
    const deptStats = departments.map(dept => {
      const deptJobs = reportData.monthlyJobs.filter(j => j.department === dept);
      const finishedCount = deptJobs.filter(j => isFinished(j.status)).length;
      const pendingCount = deptJobs.filter(j => isPending(j.status)).length;
      const cancelledCount = deptJobs.filter(j => isCancelled(j.status)).length;
      const cost = deptJobs.reduce((sum, j) => sum + (j.costs?.reduce((s, c) => s + c.totalPrice, 0) || 0), 0);
      
      return { 
        name: dept.match(/\(([^)]+)\)/)?.[1] || dept, 
        fullName: dept, 
        total: deptJobs.length, 
        finished: finishedCount,
        pending: pendingCount,
        cancelled: cancelledCount,
        cost
      };
    }).sort((a,b) => b.total - a.total); 

    const techStats = technicians.filter(t => t.position === 'ช่าง').map(t => {
      const myJobs = reportData.monthlyJobs.filter(j => j.technicianIds?.includes(t.id) && isFinished(j.status));
      let totalScore = 0;
      let ratedJobs = 0;
      myJobs.forEach(j => {
          const speed = j.evaluation?.speed || 3;
          const quality = j.evaluation?.quality || 3;
          totalScore += (speed + quality);
          ratedJobs++;
      });
      const percent = ratedJobs > 0 ? (totalScore / (ratedJobs * 10)) * 100 : 0;
      let grade = '-'; 
      if (ratedJobs > 0) {
        if (percent >= 90) grade = 'A';
        else if (percent >= 75) grade = 'B';
        else if (percent >= 60) grade = 'C';
        else grade = 'D';
      }
      return { 
          name: t.firstName, 
          nickName: t.nickName, 
          count: myJobs.length, 
          percent: Math.round(percent), 
          grade 
      };
    }).sort((a,b) => {
        if (a.grade !== b.grade) return a.grade.localeCompare(b.grade);
        return b.count - a.count;
    });

    // 1. Job Type Stats (Updated with Balancing)
    const rawJobTypeData = jobTypes.map(t => {
        const typeJobs = reportData.monthlyJobs.filter(j => (j.jobType || '').includes(t));
        const finishedCount = typeJobs.filter(j => isFinished(j.status)).length;
        const pendingCount = typeJobs.filter(j => isPending(j.status)).length;
        const cancelledCount = typeJobs.filter(j => isCancelled(j.status)).length;
        const cost = typeJobs.reduce((sum, j) => sum + (j.costs?.reduce((s, c) => s + c.totalPrice, 0) || 0), 0);
        return { name: t, value: typeJobs.length, finished: finishedCount, pending: pendingCount, cancelled: cancelledCount, cost };
    }).sort((a,b) => b.value - a.value);

    // Calculate balanced percentages for Job Types
    const jobTypeCounts = rawJobTypeData.map(d => d.value);
    const jobTypePercents = getBalancedPercentages(jobTypeCounts);
    
    // Add costPercent (default 0, will be updated later)
    const jobTypeData = rawJobTypeData.map((d, i) => ({ ...d, percent: jobTypePercents[i], costPercent: 0 }));

    // --- Repair Group Data (Updated with Balancing) ---
    const rawRepairGroupData: { name: string; total: number; finished: number; pending: number; cancelled: number }[] = [];
    const groupsToIterate = repairGroups.length > 0 ? repairGroups : Object.values(RepairGroup);

    groupsToIterate.forEach((groupName) => {
        const groupJobs = reportData.monthlyJobs.filter(j => j.repairGroup === groupName);
        if (groupJobs.length > 0) {
            rawRepairGroupData.push({
                name: groupName,
                total: groupJobs.length,
                finished: groupJobs.filter(j => isFinished(j.status)).length,
                pending: groupJobs.filter(j => isPending(j.status)).length,
                cancelled: groupJobs.filter(j => isCancelled(j.status)).length
            });
        }
    });
    // Calculate balanced percentages for Repair Groups
    rawRepairGroupData.sort((a,b) => b.total - a.total);
    const repairGroupCounts = rawRepairGroupData.map(d => d.total);
    const repairGroupPercents = getBalancedPercentages(repairGroupCounts);
    const repairGroupData = rawRepairGroupData.map((d, i) => ({ ...d, percent: repairGroupPercents[i] }));

    // --- Cost Data by Expense Category (With Breakdown by JobType) ---
    const costByCategory: Record<string, { total: number; byJobType: Record<string, number> }> = {};
    
    reportData.monthlyJobs.forEach(j => {
        const jType = j.jobType || 'อื่นๆ';
        j.costs?.forEach(c => {
            const cat = c.category || 'ไม่ระบุหมวด';
            if (!costByCategory[cat]) {
                costByCategory[cat] = { total: 0, byJobType: {} };
            }
            costByCategory[cat].total += c.totalPrice;
            costByCategory[cat].byJobType[jType] = (costByCategory[cat].byJobType[jType] || 0) + c.totalPrice;
        });
    });

    const costData = Object.entries(costByCategory).map(([name, data]) => ({ 
        name, 
        value: data.total,
        breakdown: data.byJobType 
    })).sort((a,b) => b.value - a.value);

    // Calculate percentages for Costs
    const costValues = jobTypeData.map(d => d.cost);
    const costPercents = getBalancedPercentages(costValues);
    // Apply back to jobTypeData for the cost chart/table
    jobTypeData.forEach((d, i) => { d.costPercent = costPercents[i]; });

    return { total, finished, inProgress, inProgressRate, cancelled, completionRate, cancelledRate, totalCost, deptStats, techStats, jobTypeData, repairGroupData, costData };
  }, [reportData, departments, technicians, jobTypes, repairGroups]);

  // Split Techs (2 Columns for wide view)
  const techChunks = useMemo(() => {
      const chunkSize = Math.ceil(stats.techStats.length / 2);
      return [
          stats.techStats.slice(0, chunkSize),
          stats.techStats.slice(chunkSize)
      ];
  }, [stats.techStats]);

  // Split Depts (2 Columns)
  const midPointDept = Math.ceil(stats.deptStats.length / 2);
  const deptCol1 = stats.deptStats.slice(0, midPointDept);
  const deptCol2 = stats.deptStats.slice(midPointDept);

  const handleExportPDF = async () => {
      const pages = Array.from(document.querySelectorAll('.pdf-page'));
      if (!pages.length || isExporting) return;
      setIsExporting(true);
      try { await document.fonts.ready; } catch (e) {}
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = 210; 
      const pdfHeight = 297; 
      try {
          for (let i = 0; i < pages.length; i++) {
              const page = pages[i] as HTMLElement;
              const canvas = await html2canvas(page, {
                  scale: 3, // Increased scale for better quality
                  useCORS: true,
                  logging: false,
                  width: A4_WIDTH,
                  height: A4_HEIGHT,
                  windowWidth: A4_WIDTH,
                  windowHeight: A4_HEIGHT,
                  backgroundColor: '#ffffff',
                  onclone: (clonedDoc) => {
                      const clonedPage = clonedDoc.getElementById(page.id);
                      if (clonedPage) {
                          if(clonedPage.parentElement) {
                              clonedPage.parentElement.style.transform = 'scale(1)';
                          }
                          // Fix for SVG text clipping
                          const svgs = clonedPage.querySelectorAll('svg');
                          svgs.forEach(svg => {
                              svg.style.overflow = 'visible';
                          });
                      }
                  }
              });
              
              const imgData = canvas.toDataURL('image/png');
              if (i > 0) pdf.addPage();
              pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
          }
          pdf.save(`monthly_report_${selectedMonth + 1}_${selectedYear}.pdf`);
      } catch (err) {
          console.error(err);
          alert("เกิดข้อผิดพลาดในการสร้าง PDF");
      } finally {
          setIsExporting(false);
      }
  };

  return (
    <div className="space-y-6 pb-20 animate-fade-in flex flex-col items-center bg-slate-50 min-h-screen">
      
      {/* Control Bar (No Print) */}
      <div className="w-full max-w-5xl flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-4 z-50 no-print">
          <div className="flex items-center gap-4">
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                  <button onClick={() => setSelectedYear(y => y - 1)} className="p-1 hover:bg-white rounded text-slate-500"><ChevronLeft size={20} /></button>
                  <span className="font-bold px-3 text-slate-800">{selectedYear + 543}</span>
                  <button onClick={() => setSelectedYear(y => y + 1)} className="p-1 hover:bg-white rounded text-slate-500"><ChevronRight size={20} /></button>
              </div>
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                  <button onClick={() => setSelectedMonth(m => (m === 0 ? 11 : m - 1))} className="p-1 hover:bg-white rounded text-slate-500"><ChevronLeft size={20} /></button>
                  <span className="font-bold px-3 text-slate-800 w-24 text-center">{MONTHS_TH[selectedMonth]}</span>
                  <button onClick={() => setSelectedMonth(m => (m === 11 ? 0 : m + 1))} className="p-1 hover:bg-white rounded text-slate-500"><ChevronRight size={20} /></button>
              </div>
              {/* Type Filter */}
              <div className="relative" ref={typeDropdownRef}>
                  <button 
                      onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all ${selectedJobTypes.length > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                      <Filter size={16}/> 
                      ประเภทงาน {selectedJobTypes.length > 0 && `(${selectedJobTypes.length})`}
                  </button>
                  
                  {isTypeDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 max-h-60 overflow-y-auto">
                          <div className="flex justify-between items-center mb-2 px-2">
                              <span className="text-xs font-bold text-slate-500">เลือกประเภท</span>
                              <div className="flex gap-2">
                                  <button onClick={() => setSelectedJobTypes(jobTypes)} className="text-[10px] text-brand-600 hover:underline">All</button>
                                  <button onClick={() => setSelectedJobTypes([])} className="text-[10px] text-red-500 hover:underline">Clear</button>
                              </div>
                          </div>
                          {jobTypes.map(t => (
                              <label key={t} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                  <input 
                                      type="checkbox"
                                      className="rounded text-brand-600 focus:ring-brand-500"
                                      checked={selectedJobTypes.includes(t)}
                                      onChange={(e) => {
                                          if (e.target.checked) setSelectedJobTypes([...selectedJobTypes, t]);
                                          else setSelectedJobTypes(selectedJobTypes.filter(type => type !== t));
                                      }}
                                  />
                                  <span className="text-sm text-slate-700">{t}</span>
                              </label>
                          ))}
                      </div>
                  )}
              </div>
          </div>
          <button 
            onClick={handleExportPDF} 
            disabled={isExporting}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg hover:bg-black transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isExporting ? <span className="animate-spin">⏳</span> : <Printer size={20} />}
            <span>Export PDF</span>
          </button>
      </div>

      {/* PAGE 1: Overview */}
      <PageContainer pageNum={1} totalPages={2} month={selectedMonth} year={selectedYear} id="page-1">
          {/* Executive Summary Cards */}
          <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Jobs</p>
                  <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-black text-slate-800">{stats.total}</h3>
                      <span className="text-xs text-slate-400 font-bold">งาน</span>
                  </div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl border border-green-100">
                  <p className="text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Success Rate</p>
                  <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-black text-green-700">{stats.completionRate}%</h3>
                      <span className="text-xs text-green-600 font-bold">({stats.finished})</span>
                  </div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">In Progress</p>
                  <div className="flex items-baseline gap-2">
                      <h3 className="text-3xl font-black text-amber-700">{stats.inProgressRate}%</h3>
                      <span className="text-xs text-amber-600 font-bold">({stats.inProgress})</span>
                  </div>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Total Cost</p>
                  <div className="flex items-baseline gap-2">
                      <h3 className="text-2xl font-black text-blue-700">{stats.totalCost.toLocaleString()}</h3>
                      <span className="text-xs text-blue-600 font-bold">฿</span>
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-2 gap-6 h-[280px]">
              {/* Job Type Breakdown Chart */}
              <div className="border border-slate-200 rounded-xl p-4 flex flex-col">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-sm"><FileText size={16}/> สัดส่วนงานแยกตามหมวด (Job Type)</h3>
                  <div className="flex-1 flex items-center justify-center">
                      <div className="w-[120px] h-[120px] relative">
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie data={stats.jobTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={2}>
                                      {stats.jobTypeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={1}/>)}
                                  </Pie>
                              </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                              <span className="text-[10px] font-bold text-slate-400">TOTAL</span>
                              <span className="text-lg font-black text-slate-800">{stats.total}</span>
                          </div>
                      </div>
                      <div className="ml-4 space-y-1 flex-1 overflow-y-auto max-h-[220px] pr-2 custom-scrollbar pb-2">
                          {stats.jobTypeData.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-[10px]">
                                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                                      <span className="text-slate-600 font-medium break-words leading-tight">{item.name}</span>
                                  </div>
                                  <div className="flex gap-2 shrink-0 ml-2">
                                      <span className="font-bold text-slate-800">{item.value}</span>
                                      <span className="text-slate-400 w-6 text-right">{item.percent}%</span>
                                  </div>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              {/* Repair Group Chart */}
              <div className="border border-slate-200 rounded-xl p-4 flex flex-col">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-sm"><Wrench size={16}/> กลุ่มงานซ่อม (Repair Group)</h3>
                  <div className="flex-1 overflow-auto">
                      <table className="w-full text-[10px]">
                          <thead className="bg-slate-50 font-bold text-slate-500">
                              <tr>
                                  <th className="text-left py-1 px-2 rounded-l-lg">กลุ่มงาน</th>
                                  <th className="text-center py-1 px-2">งาน</th>
                                  <th className="text-center py-1 px-2 text-green-600">เสร็จ</th>
                                  <th className="text-center py-1 px-2 text-amber-600">ค้าง</th>
                                  <th className="text-center py-1 px-2 text-red-500 rounded-r-lg">ยกเลิก</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                              {stats.repairGroupData.map((group, idx) => (
                                  <tr key={idx}>
                                      <td className="py-1.5 px-2 font-medium text-slate-700">{group.name}</td>
                                      <td className="py-1.5 px-2 text-center font-bold">{group.total}</td>
                                      <td className="py-1.5 px-2 text-center text-green-600 font-bold">{group.finished}</td>
                                      <td className="py-1.5 px-2 text-center text-amber-600 font-bold">{group.pending}</td>
                                      <td className="py-1.5 px-2 text-center text-red-500 font-bold">{group.cancelled}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>

          {/* Department Table */}
          <div className="mt-4 border border-slate-200 rounded-xl p-4 flex-1 flex flex-col min-h-0">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm"><Activity size={16}/> สรุปแยกตามแผนก (Department Summary)</h3>
              <div className="flex-1 flex gap-4">
                  {[deptCol1, deptCol2].map((colData, colIdx) => (
                      <div key={colIdx} className="flex-1">
                          <table className="w-full text-[10px]">
                              <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
                                  <tr>
                                      <th className="text-left py-1.5 px-2">แผนก</th>
                                      <th className="text-center py-1.5 px-1">รวม</th>
                                      <th className="text-center py-1.5 px-1 text-green-600">✓</th>
                                      <th className="text-center py-1.5 px-1 text-amber-600">⟳</th>
                                      <th className="text-center py-1.5 px-1 text-red-500">✕</th>
                                      <th className="text-right py-1.5 px-2">Cost</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {colData.map((dept, idx) => (
                                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                          <td className="py-1.5 px-2 font-medium text-slate-700 truncate max-w-[100px]">{dept.name}</td>
                                          <td className="py-1.5 px-1 text-center font-bold">{dept.total}</td>
                                          <td className="py-1.5 px-1 text-center text-green-600 font-bold">{dept.finished}</td>
                                          <td className="py-1.5 px-1 text-center text-amber-600 font-bold">{dept.pending}</td>
                                          <td className="py-1.5 px-1 text-center text-red-500 font-bold">{dept.cancelled}</td>
                                          <td className="py-1.5 px-2 text-right text-slate-600">{dept.cost > 0 ? dept.cost.toLocaleString() : '-'}</td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  ))}
              </div>
          </div>
      </PageContainer>

      {/* PAGE 2: Performance & Cost */}
      <PageContainer pageNum={2} totalPages={2} month={selectedMonth} year={selectedYear} id="page-2">
          
          {/* 1. PM Stats - Full Width */}
          <div className="h-[300px] mb-4 border border-slate-200 rounded-xl p-4 flex flex-col">
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-sm"><Clock size={16}/> ประสิทธิภาพแผน PM</h3>
              <div className="flex-1 flex gap-6">
                  {/* Summary Boxes */}
                  <div className="flex flex-col gap-3 justify-center w-1/4">
                      <div className="text-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Total Plan</p>
                          <p className="text-xl font-black text-slate-800">{reportData.pmSummary.totalPlan}</p>
                      </div>
                      <div className="text-center bg-green-50 p-2 rounded-lg border border-green-100">
                          <p className="text-[10px] text-green-600 font-bold uppercase">Done</p>
                          <p className="text-xl font-black text-green-700">{reportData.pmSummary.done}</p>
                      </div>
                      <div className="text-center bg-red-50 p-2 rounded-lg border border-red-100">
                          <p className="text-[10px] text-red-500 font-bold uppercase">Missed</p>
                          <p className="text-xl font-black text-red-600">{reportData.pmSummary.missed}</p>
                      </div>
                  </div>
                  {/* Chart */}
                  <div className="flex-1 bg-slate-50 rounded-lg p-3 border border-slate-100 flex items-center justify-center relative">
                      <div className="w-full h-full">
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={[{ name: 'PM', ...reportData.pmSummary }]} layout="vertical" barSize={35}>
                                  <XAxis type="number" hide />
                                  <YAxis type="category" dataKey="name" hide />
                                  <Tooltip cursor={{fill: 'transparent'}} />
                                  <Bar dataKey="done" stackId="a" fill="#10b981" radius={[4, 0, 0, 4]}>
                                       <LabelList dataKey="done" position="center" style={{ fill: '#fff', fontSize: '12px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                  </Bar>
                                  <Bar dataKey="wip" stackId="a" fill="#3b82f6">
                                       <LabelList dataKey="wip" position="center" style={{ fill: '#fff', fontSize: '12px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                  </Bar>
                                  <Bar dataKey="missed" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]}>
                                       <LabelList dataKey="missed" position="center" style={{ fill: '#fff', fontSize: '12px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                  </Bar>
                              </BarChart>
                          </ResponsiveContainer>
                      </div>
                      {/* Legend */}
                      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-4 text-[10px]">
                          <span className="flex items-center gap-1"><div className="w-2 h-2 bg-green-500 rounded-full"></div> Done</span>
                          <span className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-500 rounded-full"></div> WIP</span>
                          <span className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Missed</span>
                      </div>
                  </div>
              </div>
          </div>

          {/* 2. Cost Summary Chart - Full Width (Moved Below PM) */}
          <div className="h-[280px] mb-4 border border-slate-200 rounded-xl p-4 flex flex-col">
              <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2 text-sm"><Coins size={16}/> สรุปค่าใช้จ่าย (Cost Breakdown)</h3>
              <div className="flex-1 flex flex-col justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.jobTypeData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                          <XAxis dataKey="name" tick={{fontSize: 10}} interval={0} />
                          <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `${val/1000}k`} />
                          <Tooltip cursor={{fill: '#f8fafc'}} />
                          <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40}>
                              <LabelList dataKey="cost" position="top" style={{ fill: '#6366f1', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} />
                          </Bar>
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          {/* 3. Technician Performance Table - Remaining Space */}
          <div className="flex-1 border border-slate-200 rounded-xl p-4 flex flex-col min-h-0">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm"><CheckSquare size={16}/> ประสิทธิภาพรายบุคคล (Technician Performance)</h3>
              <div className="flex-1 flex gap-4">
                  {techChunks.map((colData, colIdx) => (
                      <div key={colIdx} className="flex-1">
                          <table className="w-full text-[10px]">
                              <thead className="bg-slate-50 font-bold text-slate-500 border-b border-slate-200">
                                  <tr>
                                      <th className="text-left py-1.5 px-2">ชื่อช่าง</th>
                                      <th className="text-center py-1.5 px-2">งานเสร็จ</th>
                                      <th className="text-center py-1.5 px-2">คะแนน %</th>
                                      <th className="text-center py-1.5 px-2">เกรด</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                  {colData.map((tech, idx) => (
                                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                          <td className="py-1.5 px-2 font-medium text-slate-700">{tech.name} ({tech.nickName})</td>
                                          <td className="py-1.5 px-2 text-center font-bold">{tech.count}</td>
                                          <td className="py-1.5 px-2 text-center">
                                              <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                  <div className="bg-brand-500 h-full" style={{ width: `${tech.percent}%` }}></div>
                                              </div>
                                              <span className="text-[9px] text-slate-500 mt-0.5 block">{tech.percent}%</span>
                                          </td>
                                          <td className="py-1.5 px-2 text-center font-black">
                                              <span className={`px-2 py-0.5 rounded ${
                                                  tech.grade === 'A' ? 'bg-green-100 text-green-700' : 
                                                  tech.grade === 'B' ? 'bg-blue-100 text-blue-700' :
                                                  tech.grade === 'C' ? 'bg-yellow-100 text-yellow-700' : 
                                                  'bg-red-100 text-red-700'
                                              }`}>
                                                  {tech.grade}
                                              </span>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  ))}
              </div>
          </div>
      </PageContainer>
    </div>
  );
};

export default MonthlyReport;
