import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Job, JobStatus, RepairGroup, CostItem } from '../types';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    Legend, LabelList, ReferenceLine, PieChart, Pie, Cell, LineChart, Line, ComposedChart, Area, ReferenceArea
} from 'recharts';
import { 
    Target, CheckSquare, Square, Filter, Calendar, Activity, Zap, Car, Briefcase,
    BarChart2, PieChart as PieChartIcon, DollarSign, TrendingUp, XCircle, Factory, Download, Layers, Wrench, FileText, CheckCircle, AlertTriangle, ChevronDown, ChevronLeft, ChevronRight
} from 'lucide-react';
import html2canvas from 'html2canvas';

interface DepartmentDashboardProps {
    jobs: Job[];
    divisionMappings?: Record<string, 'MTN' | 'MOT'>;
    departmentGroupMappings?: Record<string, string>;
    jobTypes: string[];
}

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#3b82f6', '#64748b'];

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

// Helper to export chart to image with high fidelity
const handleExportChart = async (elementId: string, filename: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;

    // 1. Snapshot dimensions of the container and internal charts
    const rect = el.getBoundingClientRect();
    const chartElements = el.querySelectorAll('.recharts-responsive-container');
    const chartDimensions = Array.from(chartElements).map(node => {
        const nodeRect = node.getBoundingClientRect();
        return { width: nodeRect.width, height: nodeRect.height };
    });

    try {
        const canvas = await html2canvas(el, { 
            scale: 3, 
            useCORS: true, 
            backgroundColor: '#ffffff',
            logging: false,
            onclone: (clonedDoc) => {
                const target = clonedDoc.getElementById(elementId);
                if (target) {
                    target.style.padding = '20px';
                    target.style.boxSizing = 'border-box';
                    target.style.backgroundColor = '#ffffff';
                    target.style.width = `${rect.width}px`;
                    // Remove max-height restrictions for full export
                    target.style.height = 'auto'; 
                    target.style.maxHeight = 'none';
                    target.style.overflow = 'visible';
                    target.style.border = 'none';
                    target.style.boxShadow = 'none';

                    const clonedCharts = target.querySelectorAll('.recharts-responsive-container');
                    clonedCharts.forEach((node: any, index) => {
                        if (chartDimensions[index]) {
                            // If we are exporting a hidden full chart, we might want to respect the hidden div's natural height
                            // But for standard charts, lock dimensions.
                            if (!elementId.startsWith('hidden-chart')) {
                                node.style.width = `${chartDimensions[index].width}px`;
                                node.style.height = `${chartDimensions[index].height}px`;
                            }
                            node.style.flex = 'none'; 
                        }
                        const svg = node.querySelector('svg');
                        if (svg) svg.style.overflow = 'visible';
                    });

                    const textElements = target.querySelectorAll('text');
                    textElements.forEach((text: any) => {
                        text.style.fontFamily = '"Sarabun", sans-serif'; 
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

const CustomTooltip = ({ active, payload, label, unit = '' }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white/95 p-3 border border-slate-200 shadow-xl rounded-xl text-xs z-50">
                <p className="font-bold text-slate-800 border-b pb-1 mb-1">{label}</p>
                {payload.map((p: any, i: number) => {
                    // Determine unit dynamically if it's mixed
                    let displayUnit = unit;
                    if (p.dataKey === 'successRate' || (p.dataKey && p.dataKey.includes('Stack'))) {
                        displayUnit = '%';
                    } else if (p.dataKey === 'total' || p.dataKey === 'finished' || p.dataKey === 'active' || p.dataKey === 'cancelled') {
                        displayUnit = ' งาน';
                    } else if (p.dataKey === 'cost' || p.dataKey === 'value') {
                        displayUnit = ' ฿';
                    }

                    // Skip "zero" or dummy bars in tooltip
                    if (p.dataKey === 'zero') return null;

                    // Helper to display nicer names
                    let displayName = p.name;
                    if (p.name === 'Count: เสร็จ') displayName = 'งานเสร็จ';
                    if (p.name === 'Count: ค้าง') displayName = 'งานค้าง';
                    if (p.name === 'Count: ยกเลิก') displayName = 'งานยกเลิก';

                    return (
                        <div key={i} className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || p.fill }}></div>
                            <span className="text-slate-500">{displayName}:</span>
                            <span className="font-bold text-slate-700">
                                {p.value.toLocaleString()} {displayUnit}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }
    return null;
};

// --- New MultiSelectDropdown Component ---
const MultiSelectDropdown = ({ 
    label, 
    options, 
    selected, 
    onChange 
}: { 
    label: string; 
    options: string[]; 
    selected: string[]; 
    onChange: (val: string[]) => void; 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (opt: string) => {
        if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
        else onChange([...selected, opt]);
    };

    const isAllSelected = options.length > 0 && selected.length === options.length;

    return (
        <div className="relative" ref={ref}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 border rounded-lg text-xs font-bold transition-all shadow-sm
                    ${selected.length > 0 ? 'bg-white border-brand-300 text-slate-700' : 'bg-slate-50 border-slate-200 text-slate-400'}
                `}
            >
                <Filter size={14} className={selected.length > 0 ? "text-brand-600" : "text-slate-400"}/>
                {selected.length === 0 ? `เลือก${label}` : isAllSelected ? `ทุก${label}` : `${selected.length} ${label}`}
                <ChevronDown size={14} className="text-slate-400"/>
            </button>
            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-50 p-2 max-h-60 overflow-y-auto">
                    <div className="flex justify-between px-2 mb-2 pb-2 border-b border-slate-50">
                        <button onClick={() => onChange(options)} className="text-[10px] text-brand-600 font-bold hover:underline">เลือกทั้งหมด</button>
                        <button onClick={() => onChange([])} className="text-[10px] text-red-500 font-bold hover:underline">ล้าง</button>
                    </div>
                    {options.map(opt => (
                        <label key={opt} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={selected.includes(opt)} 
                                onChange={() => toggleOption(opt)}
                                className="rounded text-brand-600 focus:ring-brand-500 w-4 h-4"
                            />
                            <span className="text-xs text-slate-700 font-medium">{opt}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ 
    jobs, 
    divisionMappings = {}, 
    departmentGroupMappings = {}, 
    jobTypes 
}) => {
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<number>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
    
    // Pagination for Factory Breakdown
    const [breakdownPage, setBreakdownPage] = useState(1);
    const BREAKDOWN_ITEMS_PER_PAGE = 10;
    
    // Available Divisions
    const availableDivisions = useMemo(() => {
        const divs = new Set(Object.values(divisionMappings));
        return Array.from(divs).sort();
    }, [divisionMappings]);
    
    // --- Local Filters for Each Section (Now Array<string>) ---
    const [cardFilter, setCardFilter] = useState<string[]>([]);
    const [summaryChartFilter, setSummaryChartFilter] = useState<string[]>([]);
    const [performanceChartFilter, setPerformanceChartFilter] = useState<string[]>([]);
    const [yearlyPerformanceFilter, setYearlyPerformanceFilter] = useState<string[]>([]);
    const [repairGroupFilter, setRepairGroupFilter] = useState<string[]>([]);
    const [factoryCostFilter, setFactoryCostFilter] = useState<string[]>([]);
    // New Filters
    const [monthlyCostFilter, setMonthlyCostFilter] = useState<string[]>([]);
    const [factoryBreakdownFilter, setFactoryBreakdownFilter] = useState<string[]>([]);

    // Initialize filters to select all available divisions on mount/change
    useEffect(() => {
        setCardFilter(availableDivisions);
        setSummaryChartFilter(availableDivisions);
        setPerformanceChartFilter(availableDivisions);
        setYearlyPerformanceFilter(availableDivisions);
        setRepairGroupFilter(availableDivisions);
        setFactoryCostFilter(availableDivisions);
        setMonthlyCostFilter(availableDivisions);
        setFactoryBreakdownFilter(availableDivisions);
    }, [availableDivisions]);

    // Reset pagination when filter changes
    useEffect(() => {
        setBreakdownPage(1);
    }, [factoryBreakdownFilter, selectedYear, selectedMonth]);

    const jobsForYear = useMemo(() => {
        return jobs.filter(j => {
            const d = new Date(j.dateReceived);
            return d.getFullYear() === selectedYear;
        });
    }, [jobs, selectedYear]);

    // --- 1. Division Summaries (Cards) ---
    // Filtered by `cardFilter`
    const divisionSummaries = useMemo(() => {
        const targetDivisions = cardFilter.length > 0 ? cardFilter : availableDivisions;
        
        return targetDivisions.map(div => {
            const divJobs = jobsForYear.filter(j => {
                const jobDiv = divisionMappings[j.jobType || ''] || 'Others';
                const matchMonth = selectedMonth === -1 || new Date(j.dateReceived).getMonth() === selectedMonth;
                return jobDiv === div && matchMonth;
            });
            
            const total = divJobs.length;
            const finished = divJobs.filter(j => j.status === JobStatus.FINISHED || j.status === 'เสร็จสิ้น' as any).length;
            const active = divJobs.filter(j => j.status === JobStatus.IN_PROGRESS || j.status === 'ดำเนินการ' as any).length;
            const cancelled = divJobs.filter(j => j.status === JobStatus.CANCELLED || j.status === 'ยกเลิก' as any || j.status === JobStatus.UNREPAIRABLE).length;
            const cost = divJobs.reduce((sum, j) => sum + (j.costs?.reduce((s, c) => s + c.totalPrice, 0) || 0), 0);
            const successRate = total > 0 ? Math.round((finished / total) * 100) : 0;

            return { name: div, total, finished, active, cancelled, cost, successRate };
        });
    }, [jobsForYear, selectedMonth, cardFilter, divisionMappings, availableDivisions]);

    // --- 2. Chart Data Generator Helper ---
    const getMonthlyData = (divisionFilters: string[]) => {
        return Array.from({length: 12}, (_, i) => {
            const monthJobs = jobsForYear.filter(j => {
                const d = new Date(j.dateReceived);
                const jobDiv = divisionMappings[j.jobType || ''] || 'Others';
                const matchDiv = divisionFilters.length === 0 || divisionFilters.includes(jobDiv);
                return d.getMonth() === i && matchDiv;
            });

            const total = monthJobs.length;
            const finished = monthJobs.filter(j => j.status === JobStatus.FINISHED || j.status === 'เสร็จสิ้น' as any).length;
            const active = monthJobs.filter(j => j.status === JobStatus.IN_PROGRESS || j.status === 'ดำเนินการ' as any).length;
            const cancelled = monthJobs.filter(j => j.status === JobStatus.CANCELLED || j.status === 'ยกเลิก' as any || j.status === JobStatus.UNREPAIRABLE).length;
            
            const successRate = total > 0 ? Math.round((finished / total) * 100) : 0;
            const [finishedStack, activeStack, cancelledStack] = getBalancedPercentages([finished, active, cancelled]);

            return {
                name: MONTHS_TH[i],
                finished,
                active,
                cancelled,
                total,
                successRate,
                finishedStack,
                activeStack,
                cancelledStack
            };
        });
    };

    // Chart Data 1: Summary
    const chartSummaryData = useMemo(() => {
        const data = getMonthlyData(summaryChartFilter);
        if (selectedMonth !== -1) {
            return data.filter((_, i) => i === selectedMonth);
        }
        return data;
    }, [jobsForYear, summaryChartFilter, selectedMonth, divisionMappings]);

    // Chart Data 2: Monthly Performance
    const chartMonthlyPerformanceData = useMemo(() => {
        const data = getMonthlyData(performanceChartFilter);
        if (selectedMonth !== -1) {
            return data.filter((_, i) => i === selectedMonth);
        }
        return data;
    }, [jobsForYear, performanceChartFilter, selectedMonth, divisionMappings]);

    // Chart Data 3: Yearly Performance
    const chartYearlyPerformanceData = useMemo(() => {
        return getMonthlyData(yearlyPerformanceFilter);
    }, [jobsForYear, yearlyPerformanceFilter, divisionMappings]);

    // --- NEW: Monthly Expense Trend ---
    const monthlyExpenseData = useMemo(() => {
        return Array.from({length: 12}, (_, i) => {
            const monthJobs = jobsForYear.filter(j => {
                const d = new Date(j.dateReceived);
                const jobDiv = divisionMappings[j.jobType || ''] || 'Others';
                const matchDiv = monthlyCostFilter.length === 0 || monthlyCostFilter.includes(jobDiv);
                return d.getMonth() === i && matchDiv;
            });
            const cost = monthJobs.reduce((sum, j) => sum + (j.costs?.reduce((s, c) => s + c.totalPrice, 0) || 0), 0);
            return { name: MONTHS_TH[i], cost };
        });
    }, [jobsForYear, monthlyCostFilter, divisionMappings]);

    // --- 4. Repair Group Stacked Bar ---
    const repairGroupData = useMemo(() => {
        const groups: Record<string, { finished: number, active: number, cancelled: number, total: number }> = {};
        
        jobsForYear.forEach(j => {
            const d = new Date(j.dateReceived);
            const matchMonth = selectedMonth === -1 || d.getMonth() === selectedMonth;
            const jobDiv = divisionMappings[j.jobType || ''] || 'Others';
            const matchDiv = repairGroupFilter.length === 0 || repairGroupFilter.includes(jobDiv);

            if (matchMonth && matchDiv) {
                const group = j.repairGroup || 'ไม่ระบุ';
                if (!groups[group]) groups[group] = { finished: 0, active: 0, cancelled: 0, total: 0 };
                
                groups[group].total++;
                if (j.status === JobStatus.FINISHED || j.status === 'เสร็จสิ้น' as any) groups[group].finished++;
                else if (j.status === JobStatus.IN_PROGRESS || j.status === 'ดำเนินการ' as any) groups[group].active++;
                else if (j.status === JobStatus.CANCELLED || j.status === 'ยกเลิก' as any || j.status === JobStatus.UNREPAIRABLE) groups[group].cancelled++;
            }
        });

        return Object.entries(groups).map(([name, val]) => ({
            name,
            ...val,
            zero: 0 
        })).sort((a,b) => b.total - a.total);
    }, [jobsForYear, selectedMonth, repairGroupFilter, divisionMappings]);

    // --- 5. Cost by Factory Group ---
    const factoryCostData = useMemo(() => {
        const stats: Record<string, number> = {};
        
        jobsForYear.forEach(j => {
            const d = new Date(j.dateReceived);
            const matchMonth = selectedMonth === -1 || d.getMonth() === selectedMonth;
            const jobDiv = divisionMappings[j.jobType || ''] || 'Others';
            const matchDiv = factoryCostFilter.length === 0 || factoryCostFilter.includes(jobDiv);

            if (matchMonth && matchDiv) {
                const group = departmentGroupMappings[j.department] || 'Others';
                const cost = j.costs?.reduce((s, c) => s + c.totalPrice, 0) || 0;
                stats[group] = (stats[group] || 0) + cost;
            }
        });

        return Object.entries(stats)
            .map(([name, value]) => ({ name, value }))
            .sort((a,b) => b.value - a.value);
    }, [jobsForYear, selectedMonth, factoryCostFilter, departmentGroupMappings, divisionMappings]);

    // --- NEW: Factory Breakdown (Horizontal, Flat List, Grouped by Factory) ---
    const { factoryBreakdownList, paginatedBreakdownList, totalBreakdownPages, factoryLegends } = useMemo(() => {
        const map: Record<string, {name: string, factory: string, value: number}> = {};
        const factories = new Set<string>();

        jobsForYear.forEach(j => {
            const d = new Date(j.dateReceived);
            const matchMonth = selectedMonth === -1 || d.getMonth() === selectedMonth;
            const jobDiv = divisionMappings[j.jobType || ''] || 'Others';
            const matchDiv = factoryBreakdownFilter.length === 0 || factoryBreakdownFilter.includes(jobDiv);

            if (matchMonth && matchDiv) {
                const factory = departmentGroupMappings[j.department] || 'Others';
                const deptName = j.department.match(/\(([^)]+)\)$/)?.[1] || j.department; // Short name
                const cost = j.costs?.reduce((s, c) => s + c.totalPrice, 0) || 0;
                
                if (!map[deptName]) {
                    map[deptName] = { name: deptName, factory, value: 0 };
                }
                map[deptName].value += cost;
                factories.add(factory);
            }
        });

        const sortedFactories = Array.from(factories).sort();
        
        // Flatten and sort: Primary Sort = Factory, Secondary Sort = Value Desc
        const list = Object.values(map)
            .filter(item => item.value > 0)
            .sort((a, b) => {
                if (a.factory !== b.factory) return a.factory.localeCompare(b.factory);
                return b.value - a.value;
            });

        // Add colors based on factory index
        const listWithColor = list.map(item => ({
            ...item,
            fill: COLORS[sortedFactories.indexOf(item.factory) % COLORS.length]
        }));

        const totalPages = Math.ceil(listWithColor.length / BREAKDOWN_ITEMS_PER_PAGE) || 1;
        const start = (breakdownPage - 1) * BREAKDOWN_ITEMS_PER_PAGE;
        const paginated = listWithColor.slice(start, start + BREAKDOWN_ITEMS_PER_PAGE);

        // Generate Legend Data
        const factoryLegends = sortedFactories.map((factory, index) => ({
            name: factory,
            color: COLORS[index % COLORS.length]
        }));

        return { factoryBreakdownList: listWithColor, paginatedBreakdownList: paginated, totalBreakdownPages: totalPages, factoryLegends };
    }, [jobsForYear, selectedMonth, factoryBreakdownFilter, departmentGroupMappings, divisionMappings, breakdownPage]);

    return (
        <div className="space-y-6 animate-fade-in pb-12">
            {/* Header / Filters */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col xl:flex-row justify-between items-center gap-4 sticky top-0 z-30">
                <div className="flex items-center gap-2">
                    <Activity size={24} className="text-brand-600"/>
                    <h2 className="text-lg font-bold text-slate-800">ภาพรวมแยกตามหน่วยงาน (Division Overview)</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Year Selector */}
                    <select 
                        className="px-3 py-2 border rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                        value={selectedYear}
                        onChange={e => setSelectedYear(Number(e.target.value))}
                    >
                        {Array.from({length: 5}, (_, i) => currentYear - i).map(y => (
                            <option key={y} value={y}>ปี {y + 543}</option>
                        ))}
                    </select>
                    {/* Month Selector */}
                    <select
                        className="px-3 py-2 border rounded-xl text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-pointer"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(Number(e.target.value))}
                    >
                        <option value={-1}>ทุกเดือน (ทั้งปี)</option>
                        {MONTHS_TH.map((m, i) => (
                            <option key={i} value={i}>{m}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 1. Division Summary Cards */}
            <div className="flex justify-end mb-2">
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                    <MultiSelectDropdown label="หน่วยงาน" options={availableDivisions} selected={cardFilter} onChange={setCardFilter} />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {divisionSummaries.map((div) => (
                    <div key={div.name} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden group hover:shadow-md transition-all">
                        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="font-black text-slate-800 flex items-center gap-2">
                                <Layers size={18} className="text-brand-600"/> {div.name}
                            </h3>
                            <span className={`text-xs font-black px-2 py-1 rounded-lg border ${div.successRate >= 90 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                Success: {div.successRate}%
                            </span>
                        </div>
                        <div className="p-5 grid grid-cols-2 gap-y-4 gap-x-2">
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">งานทั้งหมด</p>
                                <p className="text-2xl font-black text-slate-800">{div.total}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ค่าใช้จ่าย</p>
                                <p className="text-xl font-black text-blue-600">{div.cost.toLocaleString()} ฿</p>
                            </div>
                            <div className="col-span-2 grid grid-cols-3 gap-2 mt-2">
                                <div className="bg-green-50 p-2 rounded-xl text-center border border-green-100">
                                    <p className="text-[9px] text-green-600 font-bold">เสร็จ</p>
                                    <p className="text-lg font-black text-green-700">{div.finished}</p>
                                </div>
                                <div className="bg-amber-50 p-2 rounded-xl text-center border border-amber-100">
                                    <p className="text-[9px] text-amber-600 font-bold">ทำ</p>
                                    <p className="text-lg font-black text-amber-700">{div.active}</p>
                                </div>
                                <div className="bg-red-50 p-2 rounded-xl text-center border border-red-100">
                                    <p className="text-[9px] text-red-500 font-bold">ยกเลิก</p>
                                    <p className="text-lg font-black text-red-700">{div.cancelled}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Row 2: Yearly KPI Target (Full Width) */}
            <div id="chart-yearly-performance" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50">
                    <div className="flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-600"/>
                        <h3 className="font-bold text-slate-800 text-sm">เป้าหมายความสำเร็จงานซ่อมทั้งปี (Yearly KPI Target 90%)</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <MultiSelectDropdown label="หน่วยงาน" options={availableDivisions} selected={yearlyPerformanceFilter} onChange={setYearlyPerformanceFilter} />
                        <button onClick={() => handleExportChart('chart-yearly-performance', 'yearly_performance')} className="text-slate-400 hover:text-brand-600"><Download size={16}/></button>
                    </div>
                </div>
                
                <div className="flex-1 flex flex-col justify-center gap-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartYearlyPerformanceData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 700}} interval={0} />
                            <YAxis tick={{fontSize: 11}} domain={[0, 100]} label={{ value: '% Ratio', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                            <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip unit="%" />}/>
                            <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: '10px'}}/>
                            
                            {/* Target Zone Highlight (90-100%) */}
                            <ReferenceArea y1={90} y2={100} fill="rgba(16, 185, 129, 0.1)" stroke="none" />
                            <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 3" strokeWidth={2} label={{ position: 'right', value: 'Target 90%', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} />
                            
                            <Bar dataKey="finishedStack" name="เสร็จ (%)" stackId="a" fill="#10b981" barSize={40}>
                                <LabelList dataKey="finishedStack" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? `${val}%` : ''} />
                            </Bar>
                            <Bar dataKey="activeStack" name="ค้าง (%)" stackId="a" fill="#f59e0b" barSize={40}>
                                <LabelList dataKey="activeStack" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? `${val}%` : ''} />
                            </Bar>
                            <Bar dataKey="cancelledStack" name="ยกเลิก (%)" stackId="a" fill="#ef4444" barSize={40}>
                                <LabelList dataKey="cancelledStack" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? `${val}%` : ''} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Row 3: Monthly Summary & Monthly KPI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* 3.1 Monthly Repair Summary (Dual Stacked: Count vs %) */}
                <div id="chart-monthly-summary" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50">
                        <div className="flex items-center gap-2">
                            <BarChart2 size={18} className="text-indigo-600"/>
                            <h3 className="font-bold text-slate-800 text-sm">รวมงานซ่อม (Monthly Summary)</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <MultiSelectDropdown label="หน่วยงาน" options={availableDivisions} selected={summaryChartFilter} onChange={setSummaryChartFilter} />
                            <button onClick={() => handleExportChart('chart-monthly-summary', 'monthly_repair_summary')} className="text-slate-400 hover:text-brand-600"><Download size={16}/></button>
                        </div>
                    </div>
                    
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartSummaryData} margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="name" tick={{fontSize: 11}} scale="band" padding={{ left: 10, right: 10 }} />
                                
                                <YAxis 
                                    orientation="left"
                                    tick={{fontSize: 11}} 
                                    domain={[0, 100]} // Force both to 100 visual scale
                                    label={{ value: 'Equal Height Ratio (0-100)', angle: -90, position: 'insideLeft', fontSize: 10 }} 
                                />
                                
                                <Tooltip cursor={{fill: 'transparent'}} />
                                <Legend wrapperStyle={{fontSize: '11px', paddingTop: '10px'}}/>
                                
                                {/* STACK 1 (LEFT): COUNT BREAKDOWN (Main Legend displayed here) */}
                                <Bar dataKey="finishedStack" name="งานเสร็จ" stackId="count" fill="#10b981" barSize={30}>
                                    <LabelList dataKey="finished" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                </Bar>
                                <Bar dataKey="activeStack" name="งานค้าง" stackId="count" fill="#f59e0b" barSize={30}>
                                    <LabelList dataKey="active" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                </Bar>
                                <Bar dataKey="cancelledStack" name="งานยกเลิก" stackId="count" fill="#ef4444" barSize={30}>
                                    <LabelList dataKey="cancelled" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                </Bar>

                                {/* STACK 2 (RIGHT): PERCENT BREAKDOWN (Hide from legend to simplify references) */}
                                <Bar dataKey="finishedStack" name="งานเสร็จ (%)" stackId="percent" fill="#10b981" barSize={30} radius={[4, 4, 0, 0]} legendType="none">
                                    <LabelList dataKey="finishedStack" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? `${val}%` : ''} />
                                </Bar>
                                <Bar dataKey="activeStack" name="งานค้าง (%)" stackId="percent" fill="#f59e0b" barSize={30} legendType="none">
                                    <LabelList dataKey="activeStack" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? `${val}%` : ''} />
                                </Bar>
                                <Bar dataKey="cancelledStack" name="งานยกเลิก (%)" stackId="percent" fill="#ef4444" barSize={30} legendType="none">
                                    <LabelList dataKey="cancelledStack" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? `${val}%` : ''} />
                                </Bar>

                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 3.2 Monthly KPI (Single Month View) */}
                <div id="chart-monthly-performance" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50">
                        <div className="flex items-center gap-2">
                            <Target size={18} className="text-emerald-600"/>
                            <h3 className="font-bold text-slate-800 text-sm">เป้าหมายความสำเร็จงานซ่อมรายเดือน (KPI 90%)</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <MultiSelectDropdown label="หน่วยงาน" options={availableDivisions} selected={performanceChartFilter} onChange={setPerformanceChartFilter} />
                            <button onClick={() => handleExportChart('chart-monthly-performance', 'monthly_performance')} className="text-slate-400 hover:text-brand-600"><Download size={16}/></button>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col justify-center gap-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartMonthlyPerformanceData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 700}} interval={0} />
                                <YAxis tick={{fontSize: 11}} domain={[0, 100]} label={{ value: '% Ratio', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                                <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip unit="%" />}/>
                                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize: '10px'}}/>
                                
                                {/* Target Zone Highlight (90-100%) */}
                                <ReferenceArea y1={90} y2={100} fill="rgba(16, 185, 129, 0.1)" stroke="none" />
                                <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 3" strokeWidth={2} label={{ position: 'right', value: 'Target 90%', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }} />
                                
                                <Bar dataKey="finishedStack" name="เสร็จ (%)" stackId="a" fill="#10b981" barSize={40}>
                                    <LabelList dataKey="finishedStack" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? `${val}%` : ''} />
                                </Bar>
                                <Bar dataKey="activeStack" name="ค้าง (%)" stackId="a" fill="#f59e0b" barSize={40}>
                                    <LabelList dataKey="activeStack" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? `${val}%` : ''} />
                                </Bar>
                                <Bar dataKey="cancelledStack" name="ยกเลิก (%)" stackId="a" fill="#ef4444" barSize={40}>
                                    <LabelList dataKey="cancelledStack" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? `${val}%` : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 4. Charts Row 4: Repair Group & Factory Cost */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">
                
                {/* Repair Group Stacked Bar */}
                <div id="chart-repair-group-stack" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                            <Wrench size={18} className="text-amber-600"/> งานแยกตามกลุ่มงาน (Repair Group Breakdown)
                        </h3>
                        <div className="flex items-center gap-2">
                            <MultiSelectDropdown label="หน่วยงาน" options={availableDivisions} selected={repairGroupFilter} onChange={setRepairGroupFilter} />
                            <button onClick={() => handleExportChart('chart-repair-group-stack', 'repair_group_stack')} className="text-slate-400 hover:text-brand-600"><Download size={16}/></button>
                        </div>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={repairGroupData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                                <XAxis type="number" hide />
                                <YAxis type="category" dataKey="name" width={100} tick={{fontSize: 10, fontWeight: 700}} interval={0} />
                                <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip unit="งาน" />}/>
                                <Legend wrapperStyle={{fontSize: '10px'}} iconType="circle"/>
                                <Bar dataKey="finished" name="เสร็จ" stackId="a" fill="#10b981" barSize={20}>
                                    <LabelList dataKey="finished" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                </Bar>
                                <Bar dataKey="active" name="ดำเนินการ" stackId="a" fill="#f59e0b" barSize={20}>
                                    <LabelList dataKey="active" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                </Bar>
                                <Bar dataKey="cancelled" name="ยกเลิก/ซ่อมไม่ได้" stackId="a" fill="#ef4444" barSize={20}>
                                    <LabelList dataKey="cancelled" position="center" style={{ fill: '#fff', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val : ''} />
                                </Bar>
                                {/* Invisible bar to anchor the Total label at the end of the stack */}
                                <Bar dataKey="zero" name="รวม" fill="transparent" stackId="a">
                                    <LabelList dataKey="total" position="right" style={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Factory Cost Bar */}
                <div id="chart-factory-cost" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                            <Factory size={18} className="text-purple-600"/> ค่าใช้จ่ายแยกตามกลุ่มโรงงาน (Factory Cost)
                        </h3>
                        <div className="flex items-center gap-2">
                            <MultiSelectDropdown label="หน่วยงาน" options={availableDivisions} selected={factoryCostFilter} onChange={setFactoryCostFilter} />
                            <button onClick={() => handleExportChart('chart-factory-cost', 'factory_cost')} className="text-slate-400 hover:text-brand-600"><Download size={16}/></button>
                        </div>
                    </div>
                    <div className="flex-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={factoryCostData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 700}}/>
                                <YAxis tick={{fontSize: 11}} tickFormatter={(val) => `${val/1000}k`}/>
                                <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip unit="฿" />}/>
                                <Bar dataKey="value" name="ค่าใช้จ่าย" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={40}>
                                    <LabelList dataKey="value" position="top" style={{ fill: '#8b5cf6', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Row 5 (NEW POSITION): Factory Breakdown by Department - Horizontal with Pagination */}
            <div id="chart-factory-breakdown" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[600px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                        <Factory size={18} className="text-indigo-600"/> ค่าใช้จ่ายแยกตามกลุ่มโรงงานและแผนก (Breakdown)
                    </h3>
                    <div className="flex items-center gap-2">
                        <MultiSelectDropdown label="หน่วยงาน" options={availableDivisions} selected={factoryBreakdownFilter} onChange={setFactoryBreakdownFilter} />
                        <button onClick={() => handleExportChart('hidden-chart-factory-breakdown-full', 'factory_breakdown_full')} className="text-slate-400 hover:text-brand-600"><Download size={16}/></button>
                    </div>
                </div>
                
                {/* Factory Legend (New) */}
                <div className="flex flex-wrap gap-3 mb-2 px-4">
                    {factoryLegends.map(legend => (
                        <div key={legend.name} className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: legend.color }}></div>
                            <span className="text-[10px] font-bold text-slate-600">{legend.name}</span>
                        </div>
                    ))}
                </div>

                <div className="flex-1 flex flex-col">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                            data={paginatedBreakdownList} 
                            layout="vertical" 
                            margin={{ top: 5, right: 80, left: 60, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                            <XAxis type="number" tickFormatter={(val) => `${val/1000}k`} />
                            <YAxis type="category" dataKey="name" width={150} tick={{fontSize: 10, fontWeight: 700}} interval={0} />
                            <Tooltip cursor={{fill: 'transparent'}} content={<CustomTooltip unit="฿" />}/>
                            {/* <Legend wrapperStyle={{fontSize: '10px'}} iconType="circle" /> */}
                            
                            <Bar dataKey="value" name="ค่าใช้จ่าย" radius={[0, 4, 4, 0]} barSize={25}>
                                <LabelList dataKey="value" position="right" style={{ fill: '#64748b', fontSize: '10px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} />
                                {paginatedBreakdownList.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>

                    {/* Pagination Controls */}
                    {totalBreakdownPages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-4 pt-2 border-t border-slate-50">
                            <button 
                                onClick={() => setBreakdownPage(p => Math.max(1, p - 1))} 
                                disabled={breakdownPage === 1}
                                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft size={18} className="text-slate-500"/>
                            </button>
                            <span className="text-xs font-bold text-slate-500">หน้าที่ {breakdownPage} / {totalBreakdownPages}</span>
                            <button 
                                onClick={() => setBreakdownPage(p => Math.min(totalBreakdownPages, p + 1))} 
                                disabled={breakdownPage === totalBreakdownPages}
                                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronRight size={18} className="text-slate-500"/>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Row 6 (NEW POSITION): Monthly Expenses Trend (Yearly) */}
            <div id="chart-monthly-expenses" className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                        <DollarSign size={18} className="text-green-600"/> ค่าใช้จ่ายประจำเดือนตลอดปี (Monthly Expenses)
                    </h3>
                    <div className="flex items-center gap-2">
                        <MultiSelectDropdown label="หน่วยงาน" options={availableDivisions} selected={monthlyCostFilter} onChange={setMonthlyCostFilter} />
                        <button onClick={() => handleExportChart('chart-monthly-expenses', 'monthly_expenses_trend')} className="text-slate-400 hover:text-brand-600"><Download size={16}/></button>
                    </div>
                </div>
                <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyExpenseData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                            <XAxis dataKey="name" tick={{fontSize: 11, fontWeight: 700}}/>
                            <YAxis tick={{fontSize: 11}} tickFormatter={(val) => `${val/1000}k`}/>
                            <Tooltip cursor={{fill: '#f8fafc'}} content={<CustomTooltip unit="฿" />}/>
                            <Bar dataKey="cost" name="ค่าใช้จ่าย" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30}>
                                <LabelList dataKey="cost" position="top" style={{ fill: '#10b981', fontSize: '9px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* --- HIDDEN FULL CHARTS FOR EXPORT --- */}
            <div style={{ position: 'fixed', left: '-10000px', top: 0 }}>
                {/* Full Factory Breakdown Chart */}
                <div id="hidden-chart-factory-breakdown-full" style={{ width: '1200px', height: `${Math.max(600, factoryBreakdownList.length * 60 + 100)}px`, backgroundColor: 'white', padding: '40px' }}>
                    <h3 className="text-2xl font-black text-slate-800 mb-6 text-center">ค่าใช้จ่ายแยกตามกลุ่มโรงงานและแผนก (Breakdown) - ข้อมูลทั้งหมด</h3>
                    
                    {/* Factory Legend (Duplicate for Export) */}
                    <div className="flex flex-wrap gap-4 mb-4 justify-center">
                        {factoryLegends.map(legend => (
                            <div key={legend.name} className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: legend.color }}></div>
                                <span className="text-sm font-bold text-slate-700">{legend.name}</span>
                            </div>
                        ))}
                    </div>

                    <BarChart 
                        width={1120} 
                        height={Math.max(500, factoryBreakdownList.length * 60)} 
                        data={factoryBreakdownList} 
                        layout="vertical" 
                        margin={{ top: 20, right: 100, left: 60, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                        <XAxis type="number" tickFormatter={(val) => `${val/1000}k`} />
                        <YAxis type="category" dataKey="name" width={200} tick={{fontSize: 12, fontWeight: 700}} interval={0} />
                        <Bar dataKey="value" name="ค่าใช้จ่าย" radius={[0, 4, 4, 0]} barSize={30} isAnimationActive={false}>
                            <LabelList dataKey="value" position="right" style={{ fill: '#64748b', fontSize: '12px', fontWeight: 'bold' }} formatter={(val: number) => val > 0 ? val.toLocaleString() : ''} />
                            {factoryBreakdownList.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </BarChart>
                </div>
            </div>

        </div>
    );
};

export default DepartmentDashboard;