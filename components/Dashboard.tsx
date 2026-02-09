
import React, { useState, useMemo, useEffect } from 'react';
import { Job, JobStatus, RepairGroup, Technician, JOB_STATUS_DISPLAY } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend, LabelList, LineChart, Line } from 'recharts';
import { FileText, CheckCircle, Clock, TrendingUp, Filter, DollarSign, Users, Briefcase, Building2, Wallet, CalendarRange, ListFilter, XCircle, Camera, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, RotateCcw, Download, Layers, ArrowRight, Activity, Percent, AlertCircle } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

interface DashboardProps {
  jobs: Job[];
  technicians: Technician[];
  companies?: string[];
  jobTypes: string[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#3b82f6', '#64748b'];
const getJobTypeColor = (index: number) => COLORS[index % COLORS.length];

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// --- Helper for Balanced Percentage ---
const getBalancedPercentages = (values: number[]): number[] => {
    const total = values.reduce((a, b) => a + b, 0);
    if (total === 0) return values.map(() => 0);

    const rawPercentages = values.map(v => (v / total) * 100);
    const rounded = rawPercentages.map(Math.round);
    const sumRounded = rounded.reduce((a, b) => a + b, 0);
    const diff = 100 - sumRounded;

    if (diff !== 0) {
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

// Helper to export chart to image
const handleExportChart = async (elementId: string, filename: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;

    // 1. Snapshot dimensions of charts in the original element to lock them in the clone
    const chartElements = el.querySelectorAll('.recharts-responsive-container');
    const chartDimensions = Array.from(chartElements).map(node => {
        const rect = node.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    });

    try {
        const canvas = await html2canvas(el, { 
            scale: 2, 
            useCORS: true, 
            backgroundColor: '#ffffff',
            logging: false,
            onclone: (clonedDoc) => {
                const target = clonedDoc.getElementById(elementId);
                if (target) {
                    target.style.padding = '20px';
                    target.style.boxSizing = 'border-box';
                    target.style.height = 'auto';
                    target.style.maxHeight = 'none';
                    target.style.overflow = 'visible';
                    target.style.backgroundColor = '#ffffff';
                    
                    // 2. Lock Chart Dimensions to match screen exactly
                    const clonedCharts = target.querySelectorAll('.recharts-responsive-container');
                    clonedCharts.forEach((node: any, index) => {
                        if (chartDimensions[index]) {
                            node.style.width = `${chartDimensions[index].width}px`;
                            node.style.height = `${chartDimensions[index].height}px`;
                            node.style.flex = 'none'; 
                        }
                        
                        const svg = node.querySelector('svg');
                        if (svg) {
                            svg.style.overflow = 'visible';
                        }
                    });

                    // 3. Expand internal scrollable containers
                    const scrollables = target.querySelectorAll('.overflow-y-auto, .overflow-auto, .custom-scrollbar');
                    scrollables.forEach((node: any) => {
                        node.style.height = 'auto';
                        node.style.maxHeight = 'none';
                        node.style.overflow = 'visible';
                    });
                }
            }
        });
        const link = document.createElement('a');
        link.download = `${filename}_${new Date().toISOString().split('T')[0]}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) {
        console.error("Export failed", e);
        alert("บันทึกรูปภาพไม่สำเร็จ");
    }
};

interface ChartCardProps {
    title: string;
    children: React.ReactNode;
    id: string;
    onExport?: () => void;
    height?: string;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, children, id, onExport, height = "h-[500px]" }) => (
    <div id={id} className={`bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col ${height} relative group`}>
        <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
            <h3 className="font-black text-slate-800 uppercase tracking-widest text-base">{title}</h3>
            {onExport && (
                <button 
                    onClick={onExport} 
                    className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    title="บันทึกเป็นรูปภาพ"
                >
                    <Download size={16}/>
                </button>
            )}
        </div>
        <div className="flex-1 w-full h-full min-h-0 relative">
            {children}
        </div>
    </div>
);

// --- NEW: Custom Breakdown Tooltip ---
const CustomBreakdownTooltip = ({ active, payload, unit = '' }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const value = payload[0].value;
        const breakdown = data.deptBreakdown || {};
        const sortedBreakdown = Object.entries(breakdown)
            .sort(([,a]: any, [,b]: any) => b - a)
            .slice(0, 10);

        return (
            <div className="bg-white/95 p-3 border border-slate-200 shadow-xl rounded-xl text-xs z-50 min-w-[200px]">
                <div className="flex justify-between items-center border-b pb-2 mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: data.color || payload[0].fill}}></div>
                        <span className="font-black text-slate-800 text-sm">{data.name}</span>
                    </div>
                    <span className="font-black text-brand-600 text-sm">
                        {(value || 0).toLocaleString()} {unit}
                    </span>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                    {sortedBreakdown.length > 0 ? sortedBreakdown.map(([dept, val]: any, i: number) => (
                        <div key={i} className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-500 truncate max-w-[140px]">{dept}</span>
                            <span className="font-bold text-slate-700">{val.toLocaleString()}</span>
                        </div>
                    )) : (
                        <div className="text-center text-slate-300 italic">ไม่มีข้อมูลแยกแผนก</div>
                    )}
                    {Object.keys(breakdown).length > 10 && (
                        <div className="text-center text-[9px] text-slate-400 italic pt-1">
                            ...และอีก {Object.keys(breakdown).length - 10} แผนก
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

const PieChartWithLegend = ({ data, dataKey, nameKey = "name", unit = "" }: { data: any[], dataKey: string, nameKey?: string, unit?: string }) => {
    const total = data.reduce((sum, item) => sum + (item[dataKey] || 0), 0);
    
    const balancedPercents = useMemo(() => {
        const values = data.map(d => d[dataKey] || 0);
        return getBalancedPercentages(values);
    }, [data, dataKey]);

    const showDetails = data.length > 0 && typeof data[0].finished === 'number' && unit !== '฿';

    return (
        <div className="flex flex-col md:flex-row items-center h-full gap-4 md:gap-8">
            <div className={`w-full ${showDetails ? 'md:w-[35%]' : 'md:w-1/2'} h-[250px] md:h-full relative`}>
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={showDetails ? 60 : 80}
                            outerRadius={showDetails ? 90 : 120}
                            paddingAngle={2}
                            dataKey={dataKey}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} strokeWidth={2} stroke="#fff" />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomBreakdownTooltip unit={unit} />} />
                    </PieChart>
                </ResponsiveContainer>
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <p className="text-[10px] md:text-sm text-slate-400 font-bold uppercase">Total</p>
                    <p className={`font-black text-slate-800 ${showDetails ? 'text-xl' : 'text-3xl'}`}>{total.toLocaleString()}</p>
                </div>
            </div>

            <div className={`w-full ${showDetails ? 'md:w-[65%]' : 'md:w-1/2'} h-full overflow-y-auto pr-2 custom-scrollbar`}>
                <table className="w-full text-xs md:text-sm">
                    <thead>
                        <tr className="text-[10px] text-slate-400 border-b border-slate-100">
                            <th className="text-left pb-2 font-bold uppercase tracking-wider pl-2">รายการ</th>
                            {showDetails && (
                                <>
                                    <th className="text-center pb-2 font-bold uppercase tracking-wider text-green-600">เสร็จ</th>
                                    <th className="text-center pb-2 font-bold uppercase tracking-wider text-amber-500">ค้าง</th>
                                    <th className="text-center pb-2 font-bold uppercase tracking-wider text-red-500">ยกเลิก</th>
                                </>
                            )}
                            <th className="text-right pb-2 font-bold uppercase tracking-wider">รวม</th>
                            <th className="text-right pb-2 font-bold uppercase tracking-wider pr-2">%</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {data.map((item, index) => {
                            const value = item[dataKey] || 0;
                            const percent = balancedPercents[index];
                            const color = item.color || COLORS[index % COLORS.length];
                            
                            return (
                                <tr key={index} className="group hover:bg-slate-50 transition-colors">
                                    <td className="py-3 pl-2 align-top">
                                        <div className="flex items-start gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0 mt-1.5" style={{ backgroundColor: color }}></div>
                                            <span className="font-bold text-slate-700 leading-relaxed block text-xs" title={item[nameKey]}>{item[nameKey]}</span>
                                        </div>
                                    </td>
                                    {showDetails && (
                                        <>
                                            <td className="py-3 text-center font-bold text-green-600 align-top pt-3 text-xs">{item.finished}</td>
                                            <td className="py-3 text-center font-bold text-amber-500 align-top pt-3 text-xs">{item.active}</td>
                                            <td className="py-3 text-center font-bold text-red-500 align-top pt-3 text-xs">{item.cancelled}</td>
                                        </>
                                    )}
                                    <td className="py-3 text-right font-medium text-slate-600 align-top pt-3 text-xs">
                                        {value.toLocaleString()}
                                    </td>
                                    <td className="py-3 text-right pr-2 align-top pt-2.5">
                                        <span className="font-black text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                                            {percent}%
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ jobs, technicians, companies = [], jobTypes }) => {
  const currentYear = new Date().getFullYear();
  const yearScroll = useDraggableScroll<HTMLDivElement>();
  const [isFilterExpanded, setIsFilterExpanded] = useState(true);
  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth()]); 
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(jobTypes); 
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]); 
  const [deptVolPage, setDeptVolPage] = useState(1);
  const [deptCostPage, setDeptCostPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  useEffect(() => {
      setSelectedJobTypes(prev => {
          const newTypes = jobTypes.filter(t => !prev.includes(t));
          return newTypes.length > 0 ? [...prev, ...newTypes] : prev;
      });
  }, [jobTypes]);

  useEffect(() => {
      setDeptVolPage(1);
      setDeptCostPage(1);
  }, [selectedYears, selectedMonths, selectedJobTypes, selectedCompanies]);

  const availableYears = useMemo(() => {
    const jobYears = jobs.map(j => new Date(j.dateReceived).getFullYear());
    jobYears.push(currentYear); 
    const minYear = Math.min(...jobYears);
    const maxYear = Math.max(...jobYears);
    const years = [];
    for (let y = maxYear; y >= minYear; y--) years.push(y);
    return years;
  }, [jobs, currentYear]);

  // --- FILTER & BACKLOG LOGIC ---
  const { filteredJobs, backlogData } = useMemo(() => {
    let periodStartDate: Date;
    if (selectedYears.length === 0) {
        periodStartDate = new Date(0);
    } else {
        const minYear = Math.min(...selectedYears);
        const minMonth = selectedMonths.length > 0 ? Math.min(...selectedMonths) : 0;
        periodStartDate = new Date(minYear, minMonth, 1);
    }

    const currentPeriodJobs = jobs.filter(job => {
        const d = new Date(job.dateReceived);
        const matchYear = selectedYears.includes(d.getFullYear());
        const matchMonth = selectedMonths.includes(d.getMonth());
        const matchType = selectedJobTypes.includes(job.jobType || '');
        return matchYear && matchMonth && matchType;
    });

    const backlogPending = jobs.filter(job => {
        const d = new Date(job.dateReceived);
        const isBefore = d < periodStartDate;
        const isActive = job.status === JobStatus.IN_PROGRESS;
        const matchType = selectedJobTypes.includes(job.jobType || '');
        return isBefore && isActive && matchType;
    });

    // NEW: Calculate overdue within active backlog
    const now = new Date();
    const backlogOverdue = backlogPending.filter(j => j.dueDate && new Date(j.dueDate) < now).length;

    const backlogCleared = jobs.filter(job => {
        const dReceived = new Date(job.dateReceived);
        const isBefore = dReceived < periodStartDate;
        const matchType = selectedJobTypes.includes(job.jobType || '');
        
        let isFinishedInPeriod = false;
        if (job.status === JobStatus.FINISHED && job.finishedDate) {
            const dFinished = new Date(job.finishedDate);
            const matchYear = selectedYears.includes(dFinished.getFullYear());
            const matchMonth = selectedMonths.includes(dFinished.getMonth());
            if (matchYear && matchMonth) isFinishedInPeriod = true;
        }

        return isBefore && isFinishedInPeriod && matchType;
    });

    return {
        filteredJobs: currentPeriodJobs,
        backlogData: {
            pending: backlogPending.length,
            overdue: backlogOverdue,
            cleared: backlogCleared.length,
            totalLegacy: backlogPending.length + backlogCleared.length
        }
    };
  }, [jobs, selectedYears, selectedMonths, selectedJobTypes]);

  const filteredCosts = useMemo(() => {
      return jobs.flatMap(job => 
          (job.costs || []).map(cost => ({
                ...cost,
                jobType: job.jobType,
                department: job.department,
                effectiveDate: cost.date || job.dateReceived,
                parentStatus: job.status
          }))
      ).filter(cost => {
          if (cost.parentStatus === JobStatus.CANCELLED || cost.parentStatus === JobStatus.UNREPAIRABLE) return false;
          const d = new Date(cost.effectiveDate);
          
          const matchYear = selectedYears.includes(d.getFullYear());
          const matchMonth = selectedMonths.includes(d.getMonth());
          const matchType = selectedJobTypes.includes(cost.jobType || '');
          const matchCompany = selectedCompanies.length === 0 || (cost.company && selectedCompanies.includes(cost.company));

          return matchYear && matchMonth && matchType && matchCompany;
      });
  }, [jobs, selectedYears, selectedMonths, selectedJobTypes, selectedCompanies]);

  const totalJobs = filteredJobs.length;
  const pendingJobs = filteredJobs.filter(j => j.status === JobStatus.IN_PROGRESS).length;
  const finishedJobs = filteredJobs.filter(j => j.status === JobStatus.FINISHED).length;
  const cancelledJobsCount = filteredJobs.filter(j => j.status === JobStatus.CANCELLED || j.status === JobStatus.UNREPAIRABLE).length;
  const totalCostSum = filteredCosts.reduce((acc, curr) => acc + curr.totalPrice, 0);

  // New: Calculate Overdue Finished Jobs
  const overdueFinishedJobsCount = filteredJobs.filter(j => {
      if (j.status !== JobStatus.FINISHED || !j.finishedDate || !j.dueDate) return false;
      return new Date(j.finishedDate) > new Date(j.dueDate);
  }).length;

  const overduePct = totalJobs > 0 ? Math.round((overdueFinishedJobsCount / totalJobs) * 100) : 0;

  const [activePct, finishedPct, cancelledPct] = useMemo(() => {
      return getBalancedPercentages([pendingJobs, finishedJobs, cancelledJobsCount]);
  }, [pendingJobs, finishedJobs, cancelledJobsCount]);

  // --- CHART DATA PREPARATION ---

  const monthlyTrendData = useMemo(() => {
      const targetYear = selectedYears.length > 0 ? Math.max(...selectedYears) : currentYear;
      
      const data = Array.from({ length: 12 }, (_, i) => {
          const monthJobs = jobs.filter(j => {
              const d = new Date(j.dateReceived);
              return d.getFullYear() === targetYear && d.getMonth() === i && selectedJobTypes.includes(j.jobType || '');
          });

          return {
              name: MONTHS_TH[i],
              finished: monthJobs.filter(j => j.status === JobStatus.FINISHED).length,
              active: monthJobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
              cancelled: monthJobs.filter(j => j.status === JobStatus.CANCELLED || j.status === JobStatus.UNREPAIRABLE).length,
              total: monthJobs.length
          };
      });
      return data;
  }, [jobs, selectedYears, selectedJobTypes, currentYear]);

  const monthlyCostData = useMemo(() => {
      const targetYear = selectedYears.length > 0 ? Math.max(...selectedYears) : currentYear;
      const data = Array.from({ length: 12 }, (_, i) => {
          const row: any = { name: MONTHS_TH[i], total: 0 };
          const monthJobs = jobs.filter(j => {
              const d = new Date(j.dateReceived);
              return d.getFullYear() === targetYear && d.getMonth() === i;
          });
          monthJobs.forEach(j => {
              if (!selectedJobTypes.includes(j.jobType || '')) return;
              if (j.status === JobStatus.CANCELLED || j.status === JobStatus.UNREPAIRABLE) return;
              const jobCost = j.costs?.reduce((sum, c) => sum + c.totalPrice, 0) || 0;
              if (jobCost > 0) row.total += jobCost;
          });
          return row;
      });
      return data;
  }, [jobs, selectedYears, selectedJobTypes, currentYear]);

  // 1. Repair Group (Pie)
  const repairGroupStats = useMemo(() => {
    return Object.values(RepairGroup).map((group, idx) => {
      const groupJobs = filteredJobs.filter(j => j.repairGroup === group);
      
      const deptBreakdown: Record<string, number> = {};
      groupJobs.forEach(j => {
          const dept = j.department.match(/\(([^)]+)\)$/)?.[1] || j.department; 
          if(dept) deptBreakdown[dept] = (deptBreakdown[dept] || 0) + 1;
      });

      return {
        name: group,
        count: groupJobs.length,
        finished: groupJobs.filter(j => j.status === JobStatus.FINISHED).length,
        active: groupJobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
        cancelled: groupJobs.filter(j => j.status === JobStatus.CANCELLED || j.status === JobStatus.UNREPAIRABLE).length,
        color: COLORS[idx % COLORS.length],
        deptBreakdown
      };
    }).filter(d => d.count > 0);
  }, [filteredJobs]);

  // 2. Department Stats
  const departmentStats = useMemo(() => {
    const stats: Record<string, any> = {};
    filteredJobs.forEach(job => {
        const dept = job.department;
        if (!stats[dept]) stats[dept] = { name: dept, totalCount: 0, totalCost: 0 };
        stats[dept].totalCount += 1;
        const typeKey = `count_${job.jobType}`;
        stats[dept][typeKey] = (stats[dept][typeKey] || 0) + 1;
    });
    filteredCosts.forEach(cost => {
        const dept = cost.department;
        if (!stats[dept]) stats[dept] = { name: dept, totalCount: 0, totalCost: 0 };
        stats[dept].totalCost += cost.totalPrice;
        const typeKey = `cost_${cost.jobType}`;
        stats[dept][typeKey] = (stats[dept][typeKey] || 0) + cost.totalPrice;
    });
    const getShortName = (name: string) => {
        const match = name.match(/\(([^)]+)\)$/);
        return match ? match[1] : name;
    };
    const baseData = Object.values(stats).filter((s: any) => s.totalCount > 0 || s.totalCost > 0);
    baseData.forEach(d => { d.displayName = getShortName(d.name); d.zero = 0; });
    return { 
        byCount: [...baseData].sort((a: any, b: any) => b.totalCount - a.totalCount), 
        byCost: [...baseData].sort((a: any, b: any) => b.totalCost - a.totalCost)
    };
  }, [filteredJobs, filteredCosts]);

  const paginatedDeptVol = useMemo(() => departmentStats.byCount.slice((deptVolPage - 1) * ITEMS_PER_PAGE, deptVolPage * ITEMS_PER_PAGE), [departmentStats.byCount, deptVolPage]);
  const totalVolPages = Math.ceil(departmentStats.byCount.length / ITEMS_PER_PAGE) || 1;
  const paginatedDeptCost = useMemo(() => departmentStats.byCost.slice((deptCostPage - 1) * ITEMS_PER_PAGE, deptCostPage * ITEMS_PER_PAGE), [departmentStats.byCost, deptCostPage]);
  const totalCostPages = Math.ceil(departmentStats.byCost.length / ITEMS_PER_PAGE) || 1;

  // 4. Job Type Stats (Pie)
  const jobTypeStats = useMemo(() => {
    const data = jobTypes.map((type, idx) => {
      const typeJobs = filteredJobs.filter(j => j.jobType === type);
      const count = typeJobs.length;
      const typeCosts = filteredCosts.filter(c => c.jobType === type);
      const cost = typeCosts.reduce((sum, c) => sum + c.totalPrice, 0);
      
      const deptBreakdown: Record<string, number> = {};
      typeJobs.forEach(j => {
          const dept = j.department.match(/\(([^)]+)\)$/)?.[1] || j.department;
          if(dept) deptBreakdown[dept] = (deptBreakdown[dept] || 0) + 1;
      });

      const deptCostBreakdown: Record<string, number> = {};
      typeCosts.forEach(c => {
          const dept = c.department.match(/\(([^)]+)\)$/)?.[1] || c.department;
          if(dept) deptCostBreakdown[dept] = (deptCostBreakdown[dept] || 0) + c.totalPrice;
      });

      return { 
          name: type, 
          count, 
          cost, 
          finished: typeJobs.filter(j => j.status === JobStatus.FINISHED).length,
          active: typeJobs.filter(j => j.status === JobStatus.IN_PROGRESS).length,
          cancelled: typeJobs.filter(j => j.status === JobStatus.CANCELLED || j.status === JobStatus.UNREPAIRABLE).length,
          color: getJobTypeColor(idx),
          deptBreakdown,
          deptCostBreakdown
      };
    }).filter(d => d.count > 0 || d.cost > 0);
    
    return {
        byCount: [...data].sort((a,b) => b.count - a.count),
        byCost: [...data].sort((a,b) => b.cost - a.cost).map(d => ({ ...d, deptBreakdown: d.deptCostBreakdown }))
    };
  }, [filteredJobs, filteredCosts, jobTypes]);

  // 6. PM Summary
  const pmStats = useMemo(() => {
      const pmJobs = filteredJobs.filter(j => j.pmPlanId);
      const data: Record<string, { total: number, finished: number, pending: number, zero: number }> = {};
      pmJobs.forEach(j => {
          const type = j.jobType || 'Unknown';
          if (!data[type]) data[type] = { total: 0, finished: 0, pending: 0, zero: 0 };
          data[type].total++;
          if (j.status === JobStatus.FINISHED) data[type].finished++;
          else if (j.status === JobStatus.IN_PROGRESS) data[type].pending++;
      });
      return Object.entries(data).map(([name, val]) => ({ name, ...val })).sort((a,b) => b.total - a.total);
  }, [filteredJobs]);

  // 7. Tech Workload
  const techWorkload = useMemo(() => {
    const stats: Record<string, { finished: number; inProgress: number; cancelled: number; total: number; zero: number }> = {};
    technicians.filter(t => t.position === 'ช่าง').forEach(t => { stats[t.id] = { finished: 0, inProgress: 0, cancelled: 0, total: 0, zero: 0 }; });
    filteredJobs.forEach(job => {
        job.technicianIds?.forEach(tid => {
            if (!stats[tid]) return;
            if (job.status === JobStatus.FINISHED) stats[tid].finished++;
            else if (job.status === JobStatus.IN_PROGRESS) stats[tid].inProgress++;
            else if (job.status === JobStatus.CANCELLED || job.status === JobStatus.UNREPAIRABLE) stats[tid].cancelled++;
            stats[tid].total++;
        });
    });
    return technicians.filter(t => t.position === 'ช่าง').map(t => ({
            name: t.firstName, 
            nickName: t.nickName,
            displayName: `${t.firstName} (${t.nickName})`,
            chartName: t.firstName.split(' ')[0], 
            finished: stats[t.id]?.finished || 0,
            inProgress: stats[t.id]?.inProgress || 0,
            cancelled: stats[t.id]?.cancelled || 0,
            total: stats[t.id]?.total || 0,
            zero: 0
    })).sort((a, b) => b.total - a.total);
  }, [filteredJobs, technicians]);

  // 8. Tech Workload By Type
  const techTypeWorkload = useMemo(() => {
      const stats: Record<string, any> = {};
      const techList = technicians.filter(t => t.position === 'ช่าง');
      
      techList.forEach(t => {
          stats[t.id] = { 
              name: t.firstName, 
              displayName: `${t.firstName} (${t.nickName})`, 
              chartName: t.firstName.split(' ')[0],
              total: 0,
              zero: 0
          };
          jobTypes.forEach(type => {
              stats[t.id][type] = 0;
          });
      });

      filteredJobs.forEach(job => {
          job.technicianIds?.forEach(tid => {
              if (stats[tid] && job.jobType) {
                  stats[tid][job.jobType] = (stats[tid][job.jobType] || 0) + 1;
                  stats[tid].total++;
              }
          });
      });

      return Object.values(stats).sort((a: any, b: any) => b.total - a.total);
  }, [filteredJobs, technicians, jobTypes]);

  const applyPreset = (preset: 'THIS_MONTH' | 'THIS_YEAR' | 'ALL_TIME') => {
      if (preset === 'THIS_MONTH') { setSelectedYears([currentYear]); setSelectedMonths([new Date().getMonth()]); }
      else if (preset === 'THIS_YEAR') { setSelectedYears([currentYear]); setSelectedMonths(Array.from({length: 12}, (_, i) => i)); }
      else if (preset === 'ALL_TIME') { setSelectedYears(availableYears); setSelectedMonths(Array.from({length: 12}, (_, i) => i)); }
  };

  const CustomTooltip = ({ active, payload, unit = '', label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 p-3 border border-slate-200 shadow-xl rounded-xl text-sm z-50">
          <div className="border-b pb-1 mb-1 font-black text-slate-800">
             {label || payload[0].payload.displayName || payload[0].payload.name}
          </div>
          <div className="space-y-1">
              {payload.map((p: any, i: number) => (
                  (p.dataKey !== 'zero' && p.value > 0) && ( 
                      <div key={i} className="flex justify-between items-center gap-6">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{backgroundColor: p.fill || p.color}}></div>
                            <span className="text-slate-500 font-bold text-[10px]">
                                {p.name}
                            </span>
                          </div>
                          <span className="font-black text-slate-700 text-[11px]">{p.value.toLocaleString()} {unit}</span>
                      </div>
                  )
              ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const volExportHeight = Math.max(600, departmentStats.byCount.length * 60 + 100); 
  const costExportHeight = Math.max(600, departmentStats.byCost.length * 60 + 100);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Filters */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 transition-all duration-300 ease-in-out overflow-hidden">
            <div className={`p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isFilterExpanded ? 'border-b border-slate-100' : ''}`}>
                <div className="flex items-center gap-3">
                    <button onClick={() => setIsFilterExpanded(!isFilterExpanded)} className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors text-sm font-black">
                        {isFilterExpanded ? <><ChevronUp size={18} /><span>ซ่อนตัวกรอง</span></> : <><ChevronDown size={18} /><span>แสดงตัวกรอง</span></>}
                    </button>
                    <div className="hidden md:flex items-center gap-2 text-slate-800 font-black uppercase tracking-tighter select-none cursor-pointer" onClick={() => setIsFilterExpanded(!isFilterExpanded)}>
                        <Filter size={20} className="text-brand-600" /> <span>Dashboard Filters</span>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => applyPreset('THIS_MONTH')} className="px-4 py-1.5 text-xs font-black rounded-xl hover:bg-slate-100 text-slate-600 transition-all">เดือนนี้</button>
                    <button onClick={() => applyPreset('THIS_YEAR')} className="px-4 py-1.5 text-xs font-black rounded-xl hover:bg-slate-100 text-slate-600 transition-all">ปีนี้</button>
                    <button onClick={() => applyPreset('ALL_TIME')} className="px-4 py-1.5 text-xs font-black rounded-xl bg-slate-800 text-white shadow-lg flex items-center gap-1"><ListFilter size={14}/> ทั้งหมด</button>
                </div>
            </div>
            {isFilterExpanded && (
                <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-8 animate-fade-in origin-top">
                    <div className="md:col-span-2 space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Clock size={12}/> เลือกปี (Year)</label>
                        <div ref={yearScroll.ref} {...yearScroll.events} style={yearScroll.style} className="flex flex-row md:flex-col gap-2 overflow-x-auto md:max-h-48 md:overflow-y-auto select-none pr-1 custom-scrollbar">
                            {availableYears.map(y => (
                                <button key={y} onClick={() => {if(!yearScroll.isDragging) setSelectedYears(prev => prev.includes(y) ? prev.filter(i => i !== y) : [...prev, y])}} className={`px-4 py-2.5 text-xs font-black rounded-xl border transition-all flex justify-between items-center whitespace-nowrap shrink-0 ${selectedYears.includes(y) ? 'bg-slate-800 text-white border-slate-800 shadow-lg' : 'bg-slate-50 text-slate-600 hover:bg-white border-slate-100'}`}>
                                    {y + 543} {selectedYears.includes(y) && <CheckCircle size={14} className="text-emerald-400 ml-2"/>}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="md:col-span-5 space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><TrendingUp size={12}/> เลือกเดือน (Month)</label>
                            <button onClick={() => setSelectedMonths(Array.from({length: 12}, (_, i) => i))} className="text-[9px] font-black bg-brand-50 text-brand-600 px-2 py-0.5 rounded-lg uppercase">Select All</button>
                        </div>
                        <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                            {MONTHS_TH.map((m, idx) => (
                                <button key={idx} onClick={() => setSelectedMonths(prev => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx])} className={`py-2.5 text-[10px] font-black rounded-xl border transition-all ${selectedMonths.includes(idx) ? 'bg-brand-600 text-white border-brand-600 shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-100'}`}>{m}</button>
                            ))}
                        </div>
                    </div>
                    <div className="md:col-span-5 space-y-5">
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-3"><Briefcase size={12}/> ประเภทงาน (Job Type)</label>
                            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                                {jobTypes.map(t => (
                                    <button key={t} onClick={() => setSelectedJobTypes(prev => prev.includes(t) ? prev.filter(i => i !== t) : [...prev, t])} className={`px-3 py-1.5 text-[10px] rounded-full border transition-all font-black ${selectedJobTypes.includes(t) ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'}`}>{t}</button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-3"><Building2 size={12}/> บริษัท (Company)</label>
                            <div className="flex flex-wrap gap-2">
                                {companies.map(c => (
                                    <button key={c} onClick={() => setSelectedCompanies(prev => prev.includes(c) ? prev.filter(i => i !== c) : [...prev, c])} className={`px-4 py-1.5 text-[10px] rounded-full border transition-all font-black ${selectedCompanies.includes(c) ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-500 hover:bg-slate-50 border-slate-200'}`}>{c}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
      </div>

      {/* --- Backlog & Accumulated Jobs Summary --- */}
      {(backlogData.pending > 0 || backlogData.cleared > 0) && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-5 flex flex-col md:flex-row items-center justify-between shadow-sm animate-fade-in gap-4">
              <div className="flex items-start gap-4">
                  <div className="bg-white p-3 rounded-2xl shadow-sm text-amber-500 border border-amber-100 shrink-0">
                      <Layers size={24}/>
                  </div>
                  <div>
                      <h3 className="text-lg font-black text-amber-800 flex items-center gap-2">
                          งานค้างสะสม (Accumulated Backlog)
                          <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-amber-200 text-amber-600 font-bold uppercase tracking-wider">จากเดือนก่อนหน้า</span>
                      </h3>
                      <p className="text-sm text-amber-700/80 mt-1">
                          งานที่เปิดก่อนช่วงเวลาที่เลือก ({selectedMonths.map(m => MONTHS_TH[m]).join(', ')} {Math.min(...selectedYears) + 543}) และยังดำเนินการอยู่
                      </p>
                  </div>
              </div>
              
              <div className="flex gap-4 w-full md:w-auto">
                  <div className="flex-1 md:flex-none bg-white/60 p-3 rounded-2xl border border-amber-100 flex flex-col items-center justify-center min-w-[140px]">
                      <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">ค้างสะสม (Active)</span>
                      <span className="text-2xl font-black text-amber-700">{backlogData.pending.toLocaleString()}</span>
                      {backlogData.overdue > 0 && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-100">
                              <AlertCircle size={10} />
                              <span className="font-bold">เกินกำหนด {backlogData.overdue} ({Math.round((backlogData.overdue / backlogData.pending) * 100)}%)</span>
                          </div>
                      )}
                  </div>
                  <div className="flex-1 md:flex-none bg-white/60 p-3 rounded-2xl border border-amber-100 flex flex-col items-center justify-center min-w-[140px]">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">เคลียร์แล้ว (Cleared)</span>
                      <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-black text-emerald-600">{backlogData.cleared.toLocaleString()}</span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-lg border border-emerald-200 transform -translate-y-0.5">
                              {backlogData.totalLegacy > 0 ? Math.round((backlogData.cleared / backlogData.totalLegacy) * 100) : 0}%
                          </span>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Statistics Section (Split into 2 specific rows) */}
      <div className="space-y-4">
          {/* Row 1: General Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "งานทั้งหมด (Total)", value: totalJobs, icon: <FileText size={26} />, color: "text-brand-600", bg: "bg-brand-50", percentage: 100, percentColor: "bg-brand-100 text-brand-700" },
              { title: "ดำเนินการ (Active)", value: pendingJobs, icon: <Clock size={26} />, color: "text-amber-600", bg: "bg-amber-50", percentage: activePct, percentColor: "bg-amber-100 text-amber-700" },
              { title: "ปิดงานแล้ว (Finished)", value: finishedJobs, icon: <CheckCircle size={26} />, color: "text-emerald-600", bg: "bg-emerald-50", percentage: finishedPct, percentColor: "bg-emerald-100 text-emerald-700" },
              { title: "ยกเลิก/ซ่อมไม่ได้", value: cancelledJobsCount, icon: <XCircle size={26} />, color: "text-slate-500", bg: "bg-slate-100", percentage: cancelledPct, percentColor: "bg-slate-200 text-slate-700" }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all relative overflow-hidden">
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">{s.title}</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-slate-800 leading-none">{s.value.toLocaleString()}</h3>
                    {s.percentage !== undefined && (
                       <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-black ${s.percentColor} shadow-sm border border-white/50`}>
                          {s.percentage}%
                       </span>
                    )}
                  </div>
                </div>
                <div className={`p-4 rounded-2xl ${s.bg} ${s.color} group-hover:scale-110 transition-transform shadow-sm`}>{s.icon}</div>
              </div>
            ))}
          </div>

          {/* Row 2: Performance & Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "เสร็จล่าช้า (Overdue)", value: overdueFinishedJobsCount, icon: <AlertCircle size={26} />, color: "text-rose-600", bg: "bg-rose-50", percentage: overduePct, percentColor: "bg-rose-100 text-rose-700" },
              { title: "ค่าใช้จ่ายรวม", value: totalCostSum, icon: <DollarSign size={26} />, color: "text-blue-600", bg: "bg-blue-50", sub: "THB" }
            ].map((s, i) => (
              <div key={i} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all relative overflow-hidden">
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1.5">{s.title}</p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-slate-800 leading-none">{s.value.toLocaleString()}</h3>
                    {s.percentage !== undefined && (
                       <span className={`text-[10px] px-1.5 py-0.5 rounded-lg font-black ${s.percentColor} shadow-sm border border-white/50`}>
                          {s.percentage}%
                       </span>
                    )}
                  </div>
                  {s.sub && <p className="text-[9px] text-slate-400 mt-1 font-black uppercase tracking-tighter">{s.sub}</p>}
                </div>
                <div className={`p-4 rounded-2xl ${s.bg} ${s.color} group-hover:scale-110 transition-transform shadow-sm`}>{s.icon}</div>
              </div>
            ))}
          </div>
      </div>

      {/* --- Charts Section (Full Width Layout) --- */}
      <div className="space-y-8">
          
          <ChartCard id="chart-monthly-trend" title="แนวโน้มปริมาณงานรายเดือน (Monthly Job Volume)" onExport={() => handleExportChart('chart-monthly-trend', 'monthly_trend')} height="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyTrendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 700}} />
                      <YAxis tick={{fontSize: 10}} />
                      <Tooltip content={<CustomTooltip unit="งาน" />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                      <Bar dataKey="finished" name="ปิดงานแล้ว" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]}>
                          <LabelList dataKey="finished" position="center" style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                      </Bar>
                      <Bar dataKey="active" name="ดำเนินการ" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]}>
                          <LabelList dataKey="active" position="center" style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                      </Bar>
                      <Bar dataKey="cancelled" name="ยกเลิก" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="cancelled" position="center" style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                          <LabelList dataKey="total" position="top" style={{ fill: '#64748b', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </ChartCard>

          <ChartCard id="chart-monthly-cost" title="แนวโน้มค่าใช้จ่ายรายเดือน (Monthly Cost Trend)" onExport={() => handleExportChart('chart-monthly-cost', 'monthly_cost')} height="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyCostData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 700}} />
                      <YAxis tick={{fontSize: 10}} tickFormatter={(val) => `${val/1000}k`} />
                      <Tooltip content={<CustomTooltip unit="฿" />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                      <Bar dataKey="total" name="ค่าใช้จ่ายรวม" fill="#6366f1" radius={[4, 4, 0, 0]}>
                          <LabelList dataKey="total" position="top" style={{ fill: '#6366f1', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} />
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </ChartCard>

          <ChartCard id="chart-repair-group" title="กลุ่มงานซ่อม (Repair Groups)" onExport={() => handleExportChart('chart-repair-group', 'repair_group')} height="h-[400px]">
                <PieChartWithLegend data={repairGroupStats} dataKey="count" unit="งาน" />
          </ChartCard>

          <ChartCard id="chart-type-count" title="สัดส่วนจำนวนงานแยกตามหมวด (Job Count by Type)" onExport={() => handleExportChart('chart-type-count', 'job_type_count')} height="h-[400px]">
                <PieChartWithLegend data={jobTypeStats.byCount} dataKey="count" unit="งาน" />
          </ChartCard>

          <ChartCard id="chart-type-cost" title="สัดส่วนค่าใช้จ่ายแยกตามหมวด (Cost by Type)" onExport={() => handleExportChart('chart-type-cost', 'job_type_cost')} height="h-[400px]">
                <PieChartWithLegend data={jobTypeStats.byCost} dataKey="cost" unit="฿" />
          </ChartCard>

          <ChartCard id="chart-dept-vol" title="ปริมาณงานตามแผนก (Job Volume by Dept)" onExport={() => handleExportChart('hidden-chart-dept-vol-full', 'dept_volume_full')} height="h-[600px]">
              <div className="flex flex-col h-full">
                  <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={paginatedDeptVol} layout="vertical" margin={{ top: 5, right: 60, left: 40, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                              <XAxis type="number" hide />
                              <YAxis type="category" dataKey="displayName" width={100} tick={{fontSize: 10, fontWeight: 700}} />
                              <Tooltip content={<CustomTooltip unit="งาน" />} />
                              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                              {jobTypes.map((type, index) => (
                                  <Bar key={type} dataKey={`count_${type}`} name={type} stackId="a" fill={getJobTypeColor(index)} radius={[0, 0, 0, 0]}>
                                     <LabelList dataKey={`count_${type}`} position="center" style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                  </Bar>
                              ))}
                              <Bar dataKey="zero" fill="transparent" stackId="a">
                                  <LabelList dataKey="totalCount" position="right" style={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
                  {totalVolPages > 1 && (
                      <div className="flex justify-center items-center gap-4 mt-2 pt-2 border-t border-slate-50">
                          <button 
                              onClick={() => setDeptVolPage(p => Math.max(1, p - 1))} 
                              disabled={deptVolPage === 1}
                              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                              <ChevronLeft size={18} className="text-slate-500"/>
                          </button>
                          <span className="text-xs font-bold text-slate-500">หน้าที่ {deptVolPage} / {totalVolPages}</span>
                          <button 
                              onClick={() => setDeptVolPage(p => Math.min(totalVolPages, p + 1))} 
                              disabled={deptVolPage === totalVolPages}
                              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                              <ChevronRight size={18} className="text-slate-500"/>
                          </button>
                      </div>
                  )}
              </div>
          </ChartCard>

          <ChartCard id="chart-dept-cost" title="ค่าใช้จ่ายตามแผนก (Cost by Dept)" onExport={() => handleExportChart('hidden-chart-dept-cost-full', 'dept_cost_full')} height="h-[600px]">
              <div className="flex flex-col h-full">
                  <div className="flex-1 min-h-0">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={paginatedDeptCost} layout="vertical" margin={{ top: 5, right: 80, left: 40, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                              <XAxis type="number" hide />
                              <YAxis type="category" dataKey="displayName" width={100} tick={{fontSize: 10, fontWeight: 700}} />
                              <Tooltip content={<CustomTooltip unit="฿" />} />
                              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                              {jobTypes.map((type, index) => (
                                  <Bar key={type} dataKey={`cost_${type}`} name={type} stackId="a" fill={getJobTypeColor(index)} radius={[0, 0, 0, 0]}>
                                      <LabelList dataKey={`cost_${type}`} position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} />
                                  </Bar>
                              ))}
                              <Bar dataKey="zero" fill="transparent" stackId="a">
                                  <LabelList dataKey="totalCost" position="right" style={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} formatter={(val: number) => val.toLocaleString()} />
                              </Bar>
                          </BarChart>
                      </ResponsiveContainer>
                  </div>
                  {totalCostPages > 1 && (
                      <div className="flex justify-center items-center gap-4 mt-2 pt-2 border-t border-slate-50">
                          <button 
                              onClick={() => setDeptCostPage(p => Math.max(1, p - 1))} 
                              disabled={deptCostPage === 1}
                              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                              <ChevronLeft size={18} className="text-slate-500"/>
                          </button>
                          <span className="text-xs font-bold text-slate-500">หน้าที่ {deptCostPage} / {totalCostPages}</span>
                          <button 
                              onClick={() => setDeptCostPage(p => Math.min(totalCostPages, p + 1))} 
                              disabled={deptCostPage === totalCostPages}
                              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          >
                              <ChevronRight size={18} className="text-slate-500"/>
                          </button>
                      </div>
                  )}
              </div>
          </ChartCard>

          <ChartCard id="chart-pm-summary" title="สรุปงาน PM แยกตามหมวด (PM Summary)" onExport={() => handleExportChart('chart-pm-summary', 'pm_summary')} height="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pmStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 700}} />
                        <YAxis tick={{fontSize: 10}} />
                        <Tooltip content={<CustomTooltip unit="งาน" />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                        <Bar dataKey="finished" name="ปิดงานแล้ว" stackId="a" fill="#10b981">
                            <LabelList dataKey="finished" position="center" style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                        </Bar>
                        <Bar dataKey="pending" name="รอดำเนินการ" stackId="a" fill="#f59e0b">
                            <LabelList dataKey="pending" position="center" style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                        </Bar>
                        <Bar dataKey="zero" fill="transparent" stackId="a">
                            <LabelList dataKey="total" position="top" style={{ fill: '#64748b', fontSize: '12px', fontWeight: 'bold' }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
          </ChartCard>

          <ChartCard id="chart-tech-load" title="ปริมาณงานรายบุคคล (Technician Workload)" onExport={() => handleExportChart('chart-tech-load', 'tech_workload')} height="h-[600px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={techWorkload} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="chartName" interval={0} tick={{fontSize: 10, fontWeight: 700}} />
                        <YAxis tick={{fontSize: 10}} />
                        <Tooltip content={<CustomTooltip unit="งาน" />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                        <Bar dataKey="finished" name="ปิดงานแล้ว" stackId="a" fill="#3b82f6">
                             <LabelList dataKey="finished" position="center" style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                        </Bar>
                        <Bar dataKey="inProgress" name="รอดำเนินการ" stackId="a" fill="#f59e0b">
                             <LabelList dataKey="inProgress" position="center" style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                        </Bar>
                        <Bar dataKey="cancelled" name="ยกเลิก" stackId="a" fill="#ef4444">
                             <LabelList dataKey="cancelled" position="center" style={{ fill: '#fff', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                        </Bar>
                        <Bar dataKey="zero" fill="transparent" stackId="a">
                            <LabelList dataKey="total" position="top" style={{ fill: '#64748b', fontSize: '12px', fontWeight: 'bold' }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
          </ChartCard>

          {/* NEW CHART: Technician Workload by Job Type */}
          <ChartCard id="chart-tech-type-load" title="ปริมาณงานรายบุคคลแยกหมวดงาน (Technician Workload by Type)" onExport={() => handleExportChart('chart-tech-type-load', 'tech_type_workload')} height="h-[600px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={techTypeWorkload} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="chartName" interval={0} tick={{fontSize: 10, fontWeight: 700}} />
                        <YAxis tick={{fontSize: 10}} />
                        <Tooltip content={<CustomTooltip unit="งาน" />} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                        {jobTypes.map((type, index) => (
                            <Bar key={type} dataKey={type} name={type} stackId="a" fill={getJobTypeColor(index)}>
                                <LabelList dataKey={type} position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                            </Bar>
                        ))}
                        <Bar dataKey="zero" fill="transparent" stackId="a">
                            <LabelList dataKey="total" position="top" style={{ fill: '#64748b', fontSize: '12px', fontWeight: 'bold' }} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
          </ChartCard>
      </div>

      {/* --- HIDDEN FULL CHARTS FOR EXPORT --- */}
      <div style={{ position: 'fixed', left: '-10000px', top: 0 }}>
          {/* Full Department Volume Chart */}
          <div id="hidden-chart-dept-vol-full" style={{ width: '1200px', height: `${Math.max(600, departmentStats.byCount.length * 60 + 100)}px`, backgroundColor: 'white', padding: '40px' }}>
              <h3 className="text-2xl font-black text-slate-800 mb-6 text-center">ปริมาณงานตามแผนก (Job Volume by Dept) - ข้อมูลทั้งหมด</h3>
              <BarChart 
                  width={1120} 
                  height={Math.max(500, departmentStats.byCount.length * 60)} 
                  data={departmentStats.byCount} 
                  layout="vertical" 
                  margin={{ top: 20, right: 100, left: 40, bottom: 20 }}
              >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="displayName" width={150} tick={{fontSize: 12, fontWeight: 700}} />
                  <Legend iconType="circle" iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700 }} />
                  {jobTypes.map((type, index) => (
                      <Bar key={type} dataKey={`count_${type}`} name={type} stackId="a" fill={getJobTypeColor(index)} radius={[0, 0, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey={`count_${type}`} position="center" style={{ fill: '#fff', fontSize: '12px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                      </Bar>
                  ))}
                  <Bar dataKey="zero" fill="transparent" stackId="a" isAnimationActive={false}>
                      <LabelList dataKey="totalCount" position="right" style={{ fill: '#64748b', fontSize: 16, fontWeight: 'bold' }} />
                  </Bar>
              </BarChart>
          </div>

          {/* Full Department Cost Chart */}
          <div id="hidden-chart-dept-cost-full" style={{ width: '1200px', height: `${Math.max(600, departmentStats.byCost.length * 60 + 100)}px`, backgroundColor: 'white', padding: '40px' }}>
              <h3 className="text-2xl font-black text-slate-800 mb-6 text-center">ค่าใช้จ่ายตามแผนก (Cost by Dept) - ข้อมูลทั้งหมด</h3>
              <BarChart 
                  width={1120} 
                  height={Math.max(500, departmentStats.byCost.length * 60)} 
                  data={departmentStats.byCost} 
                  layout="vertical" 
                  margin={{ top: 20, right: 100, left: 40, bottom: 20 }}
              >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="displayName" width={150} tick={{fontSize: 12, fontWeight: 700}} />
                  <Legend iconType="circle" iconSize={12} wrapperStyle={{ fontSize: '14px', fontWeight: 700 }} />
                  {jobTypes.map((type, index) => (
                      <Bar key={type} dataKey={`cost_${type}`} name={type} stackId="a" fill={getJobTypeColor(index)} radius={[0, 0, 0, 0]} isAnimationActive={false}>
                          <LabelList dataKey={`cost_${type}`} position="center" style={{ fill: '#fff', fontSize: '11px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} />
                      </Bar>
                  ))}
                  <Bar dataKey="zero" fill="transparent" stackId="a" isAnimationActive={false}>
                      <LabelList dataKey="totalCost" position="right" style={{ fill: '#64748b', fontSize: 16, fontWeight: 'bold' }} formatter={(val: number) => val.toLocaleString()} />
                  </Bar>
              </BarChart>
          </div>
      </div>

    </div>
  );
};

export default Dashboard;
