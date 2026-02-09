
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Job, JobType, CostItem, UserRole, formatDate, RepairGroup } from '../types';
import { Filter, DollarSign, Calendar, Save, X, Edit2, CheckCircle, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Building2, List, Briefcase, Download, PieChart, Wrench, RotateCcw, Search, Layers } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

interface ExpenseSummaryProps {
  jobs: Job[];
  expenseCategories: string[];
  departments: string[];
  companies?: string[]; // Add companies prop
  jobTypes: string[]; // Dynamic job types
  onUpdateJob: (job: Job) => void;
  onEditJob?: (job: Job) => void; // New prop for editing job
  userRole?: UserRole;
  divisionMappings?: Record<string, 'MTN' | 'MOT'>;
}

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// --- Helper Component: Compact Multi-Select Dropdown ---
const MultiSelectDropdown = ({ 
    label, 
    icon: Icon, 
    options, 
    selected, 
    onChange,
    colorClass = 'text-brand-600' // e.g. text-indigo-600
}: {
    label: string;
    icon: any;
    options: string[];
    selected: string[];
    onChange: (val: string[]) => void;
    colorClass?: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        if (selected.includes(option)) {
            onChange(selected.filter((i: string) => i !== option));
        } else {
            onChange([...selected, option]);
        }
    };

    const selectAll = () => onChange(options);
    const clear = () => onChange([]);

    // Determine active state style
    const isAllSelected = selected.length === options.length;
    const isNoneSelected = selected.length === 0;
    const isActive = !isAllSelected && !isNoneSelected;
    
    // Extract base color name from class (e.g. text-indigo-600 -> indigo)
    const baseColor = colorClass.split('-')[1] || 'brand';

    return (
        <div className="relative" ref={containerRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all whitespace-nowrap
                    ${isActive 
                        ? `bg-white border-${baseColor}-200 ${colorClass} shadow-sm ring-1 ring-${baseColor}-100` 
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
            >
                <Icon size={14} />
                <span>{label}</span>
                {isActive && (
                    <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-${baseColor}-100`}>
                        {selected.length}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-100 z-[60] p-2 animate-fade-in-up">
                    <div className="flex justify-between items-center px-2 pb-2 mb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500">เลือกรายการ ({selected.length}/{options.length})</span>
                        <div className="flex gap-2">
                            <button onClick={selectAll} className="text-[10px] text-brand-600 hover:underline font-bold">ทั้งหมด</button>
                            <button onClick={clear} className="text-[10px] text-red-500 hover:underline font-bold">ล้าง</button>
                        </div>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                        {options.map((option: string) => (
                            <label key={option} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                                <div className="relative flex items-center">
                                    <input 
                                        type="checkbox"
                                        checked={selected.includes(option)}
                                        onChange={() => toggleOption(option)}
                                        className={`peer h-4 w-4 rounded border-slate-300 text-${baseColor}-600 focus:ring-${baseColor}-500 cursor-pointer`}
                                    />
                                </div>
                                <span className={`text-xs ${selected.includes(option) ? 'font-bold text-slate-800' : 'text-slate-600'}`}>{option}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ExpenseSummary: React.FC<ExpenseSummaryProps> = ({ jobs, expenseCategories, departments, companies = [], jobTypes, onUpdateJob, onEditJob, userRole, divisionMappings }) => {
  const currentYear = new Date().getFullYear();
  
  // -- Filter State --
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  // -1 for All Months, 0-11 for specific month
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); 
  // 0 for None, 1-4 for Q1-Q4
  const [selectedQuarter, setSelectedQuarter] = useState<number>(0); 

  // Changed: Allow multiple job types
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>(jobTypes);
  
  // New Filters
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedRepairGroups, setSelectedRepairGroups] = useState<string[]>([]); 
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]); // New Department Filter
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]); // New Division Filter

  // ** NEW: Local Search for Transaction List **
  const [transactionSearch, setTransactionSearch] = useState('');

  // -- Pagination State --
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20; // Reduced items per page since we group them

  // -- Editing State --
  const [editingCost, setEditingCost] = useState<{jobId: string, cost: CostItem} | null>(null);

  // -- Drag Scroll Hooks --
  const matrixScroll = useDraggableScroll<HTMLDivElement>();
  const listScroll = useDraggableScroll<HTMLDivElement>();

  // Check permission
  const canEdit = userRole !== 'TECHNICIAN';

  // Update selected types when jobTypes prop changes
  useMemo(() => {
      setSelectedJobTypes(jobTypes);
  }, [jobTypes]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedYear, selectedMonth, selectedQuarter, selectedJobTypes, selectedCompanies, selectedCategories, selectedRepairGroups, selectedDepartments, selectedDivisions, transactionSearch]);

  // Handle Month/Quarter exclusivity
  const handleMonthChange = (val: number) => {
      setSelectedMonth(val);
      if (val !== -1) setSelectedQuarter(0); // Reset quarter if specific month selected
  };

  const handleQuarterChange = (val: number) => {
      setSelectedQuarter(val);
      if (val !== 0) setSelectedMonth(-1); // Reset month if quarter selected
  };

  const resetFilters = () => {
      setSelectedYear(currentYear);
      setSelectedMonth(new Date().getMonth());
      setSelectedQuarter(0);
      setSelectedJobTypes(jobTypes);
      setSelectedCompanies([]);
      setSelectedCategories([]);
      setSelectedRepairGroups([]);
      setSelectedDepartments([]);
      setSelectedDivisions([]);
      setTransactionSearch('');
  };

  // Sort Options
  const sortedJobTypes = useMemo(() => [...jobTypes].sort((a,b) => a.localeCompare(b, 'th')), [jobTypes]);
  const sortedRepairGroups = useMemo(() => Object.values(RepairGroup).sort((a,b) => (a as string).localeCompare((b as string), 'th')), []);
  const sortedCompanies = useMemo(() => [...companies].sort((a,b) => a.localeCompare(b, 'th')), [companies]);
  const sortedExpenseCategories = useMemo(() => [...expenseCategories].sort((a,b) => a.localeCompare(b, 'th')), [expenseCategories]);
  const sortedDepartments = useMemo(() => [...departments].sort((a,b) => a.localeCompare(b, 'th')), [departments]);
  const sortedDivisions = useMemo(() => {
      if (!divisionMappings) return ['MTN', 'MOT']; // Fallback
      return Array.from(new Set(Object.values(divisionMappings))).sort();
  }, [divisionMappings]);

  // -- Available Options (Continuous Year Range) --
  const availableYears = useMemo(() => {
    const jobYears = jobs.map(j => new Date(j.dateReceived).getFullYear());
    jobYears.push(currentYear); // Ensure current year is always included
    
    const minYear = Math.min(...jobYears);
    const maxYear = Math.max(...jobYears);
    
    const years = [];
    for (let y = maxYear; y >= minYear; y--) {
        years.push(y);
    }
    return years;
  }, [jobs, currentYear]);

  // -- Aggregation Logic --
  // 1. Flatten all costs and filter based on COST DATE (not job date)
  // This produces a flat list for calculation
  const allCosts = useMemo(() => {
      const costs = jobs.flatMap(job => 
          (job.costs || []).map((cost, index) => {
              // Determine effective date: Cost Date > Job DateReceived
              const effectiveDate = cost.date || job.dateReceived;
              return {
                ...cost,
                jobId: job.id,
                jobRunningId: job.jobRunningId,
                jobType: job.jobType || '', // Ensure string for types
                department: job.department,
                repairGroup: job.repairGroup,
                effectiveDate: effectiveDate, 
                category: cost.category || 'ไม่ระบุ',
                originalIndex: index,
                // Parent Job Data for Display
                parentItemDescription: job.itemDescription,
                parentAssetId: job.assetId,
                parentDamageDescription: job.damageDescription
              };
          })
      );

      return costs.filter(c => {
          const d = new Date(c.effectiveDate);
          const matchYear = d.getFullYear() === selectedYear;
          
          let matchTime = true;
          if (selectedQuarter > 0) {
              const m = d.getMonth();
              if (selectedQuarter === 1) matchTime = m >= 0 && m <= 2; // Jan-Mar
              else if (selectedQuarter === 2) matchTime = m >= 3 && m <= 5; // Apr-Jun
              else if (selectedQuarter === 3) matchTime = m >= 6 && m <= 8; // Jul-Sep
              else if (selectedQuarter === 4) matchTime = m >= 9 && m <= 11; // Oct-Dec
          } else {
              matchTime = selectedMonth === -1 || d.getMonth() === selectedMonth;
          }

          const matchType = selectedJobTypes.includes(c.jobType);
          
          // Company Filter
          const matchCompany = selectedCompanies.length === 0 || selectedCompanies.includes(c.company || '');
          
          // Category Filter
          const matchCategory = selectedCategories.length === 0 || selectedCategories.includes(c.category || 'ไม่ระบุ');

          // Repair Group Filter
          // FIX: Handle undefined repairGroup by providing fallback
          const matchRepairGroup = selectedRepairGroups.length === 0 || selectedRepairGroups.includes(c.repairGroup || '');

          // Department Filter
          const matchDept = selectedDepartments.length === 0 || selectedDepartments.includes(c.department);

          // Division Filter
          const division = (divisionMappings && c.jobType) ? divisionMappings[c.jobType] : 'N/A';
          const matchDivision = selectedDivisions.length === 0 || selectedDivisions.includes(division || '');

          // Search Filter (Items, Job ID, Company)
          let matchSearch = true;
          if (transactionSearch) {
              const lowerSearch = transactionSearch.toLowerCase();
              matchSearch = (
                  c.name.toLowerCase().includes(lowerSearch) ||
                  c.jobRunningId.toLowerCase().includes(lowerSearch) ||
                  (c.company && c.company.toLowerCase().includes(lowerSearch)) ||
                  (c.code && c.code.toLowerCase().includes(lowerSearch)) ||
                  c.department.toLowerCase().includes(lowerSearch)
              );
          }

          return matchYear && matchTime && matchType && matchCompany && matchCategory && matchRepairGroup && matchDept && matchDivision && matchSearch;
      }).sort((a, b) => {
          const dateA = new Date(a.effectiveDate).getTime();
          const dateB = new Date(b.effectiveDate).getTime();
          return dateB - dateA;
      });
  }, [jobs, selectedYear, selectedMonth, selectedQuarter, selectedJobTypes, selectedCompanies, selectedCategories, selectedRepairGroups, selectedDepartments, selectedDivisions, transactionSearch, divisionMappings]);

  // -- Grouping Logic for Display (Hierarchical) --
  const groupedTransactions = useMemo(() => {
      const groups: Record<string, typeof allCosts> = {};
      
      allCosts.forEach(cost => {
          if (!groups[cost.jobRunningId]) {
              groups[cost.jobRunningId] = [];
          }
          groups[cost.jobRunningId].push(cost);
      });

      // Convert to array and sort by latest cost date in group
      return Object.entries(groups).map(([jobId, items]) => {
          // Sort items within job by date desc
          const sortedItems = items.sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());
          return {
              jobId,
              items: sortedItems,
              // Metadata for group header
              jobDescription: sortedItems[0].parentItemDescription,
              jobDamage: sortedItems[0].parentDamageDescription,
              jobDepartment: sortedItems[0].department,
              totalCost: sortedItems.reduce((acc, curr) => acc + curr.totalPrice, 0),
              latestDate: sortedItems[0].effectiveDate
          };
      }).sort((a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime());

  }, [allCosts]);

  // Pagination Slicing (Based on Groups now)
  const totalPages = Math.ceil(groupedTransactions.length / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage;
  const displayedGroups = groupedTransactions.slice(startItem, startItem + itemsPerPage);

  // 2. Summary by Category (Total from all filtered costs)
  const categorySummary = useMemo(() => {
    const summary: Record<string, number> = {};
    expenseCategories.forEach(c => summary[c] = 0);
    summary['ไม่ระบุ'] = 0;

    allCosts.forEach(c => {
        const cat = c.category || 'ไม่ระบุ';
        if (summary[cat] !== undefined) {
            summary[cat] += c.totalPrice;
        } else {
            summary['ไม่ระบุ'] += c.totalPrice;
        }
    });
    return summary;
  }, [allCosts, expenseCategories]);

  // 3. Matrix: Department vs Category
  const deptMatrix = useMemo(() => {
      const matrix: Record<string, Record<string, number>> = {};
      
      departments.forEach(dept => {
          matrix[dept] = {};
          expenseCategories.forEach(cat => matrix[dept][cat] = 0);
          matrix[dept]['ไม่ระบุ'] = 0;
          matrix[dept]['total'] = 0;
      });

      allCosts.forEach(c => {
          const dept = c.department;
          const cat = c.category || 'ไม่ระบุ';
          if (matrix[dept]) {
             if (matrix[dept][cat] !== undefined) {
                 matrix[dept][cat] += c.totalPrice;
             } else {
                 matrix[dept]['ไม่ระบุ'] += c.totalPrice;
             }
             matrix[dept]['total'] += c.totalPrice;
          }
      });
      
      // Filter out departments with 0 cost
      return Object.entries(matrix)
            .filter(([_, values]) => values.total > 0)
            .sort((a, b) => b[1].total - a[1].total);
  }, [allCosts, departments, expenseCategories]);


  // -- Handlers --
  const handleEditSave = () => {
      if (!editingCost) return;

      const jobIndex = jobs.findIndex(j => j.id === editingCost.jobId);
      if (jobIndex === -1) return;

      const job = jobs[jobIndex];
      const updatedCosts = (job.costs || []).map(c => c.id === editingCost.cost.id ? editingCost.cost : c);
      
      onUpdateJob({ ...job, costs: updatedCosts });
      setEditingCost(null);
  };

  // Helper to extract short code
  const getShortDept = (deptName: string) => {
      const match = deptName.match(/\(([^)]+)\)$/);
      return match ? match[1] : deptName;
  };

  // --- Export Functions ---

  const handleExportSummaryExcel = () => {
      // Create Data for Matrix Export
      const exportData = deptMatrix.map(([dept, values]) => {
          const row: any = { 'แผนก': dept };
          expenseCategories.forEach(cat => {
              row[cat] = values[cat] || 0;
          });
          row['ไม่ระบุ'] = values['ไม่ระบุ'] || 0;
          row['รวมทั้งหมด'] = values['total'];
          return row;
      });

      // Add Grand Total Row
      if (exportData.length > 0) {
          const totalRow: any = { 'แผนก': 'ยอดรวมสุทธิ' };
          expenseCategories.forEach(cat => {
              totalRow[cat] = deptMatrix.reduce((sum, [_, v]) => sum + (v[cat] || 0), 0);
          });
          totalRow['ไม่ระบุ'] = deptMatrix.reduce((sum, [_, v]) => sum + (v['ไม่ระบุ'] || 0), 0);
          totalRow['รวมทั้งหมด'] = deptMatrix.reduce((sum, [_, v]) => sum + v.total, 0);
          exportData.push(totalRow);
      }

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Department Summary");
      
      const timeStr = selectedQuarter > 0 ? `Q${selectedQuarter}` : (selectedMonth !== -1 ? MONTHS_TH[selectedMonth] : 'AllYear');
      XLSX.writeFile(wb, `expense_summary_${timeStr}_${selectedYear}.xlsx`);
  };

  const handleExportTransactionsExcel = () => {
      const exportData = allCosts.map(item => ({
          'วันที่': formatDate(item.effectiveDate),
          'เลขที่ใบงาน': item.jobRunningId,
          'หมวดค่าใช้จ่าย': item.category,
          'กลุ่มงานซ่อม': item.repairGroup, 
          'รายการซ่อม/ทรัพย์สิน': item.parentItemDescription,
          'รหัสทรัพย์สิน': item.parentAssetId || '-',
          'ความเสียหาย': item.parentDamageDescription || '-',
          'แผนก': item.department,
          'ชื่อรายการ': item.name,
          'รหัสสินค้า': item.code || '-',
          'บริษัท': item.company || '-',
          'จำนวน': item.quantity,
          'ราคาต่อหน่วย': item.pricePerUnit,
          'ราคารวม': item.totalPrice
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Transactions");
      
      const timeStr = selectedQuarter > 0 ? `Q${selectedQuarter}` : (selectedMonth !== -1 ? MONTHS_TH[selectedMonth] : 'AllYear');
      XLSX.writeFile(wb, `expense_transactions_${timeStr}_${selectedYear}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
        {/* Compact Filters Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between sticky top-0 z-30">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center w-full">
                
                <div className="flex items-center gap-2 text-slate-700 font-bold whitespace-nowrap min-w-fit">
                    <Filter size={18} className="text-brand-600"/>
                    <span className="text-sm">ตัวกรอง</span>
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {/* Time Filters */}
                    <div className="flex gap-2 items-center bg-slate-50 p-1 rounded-lg border border-slate-200">
                        <select 
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer py-1 px-1"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                        >
                            {availableYears.map(y => (
                                <option key={y} value={y}>ปี {y}</option>
                            ))}
                        </select>
                        <div className="w-px h-4 bg-slate-300"></div>
                        <select 
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer py-1 px-1"
                            value={selectedMonth}
                            onChange={(e) => handleMonthChange(parseInt(e.target.value))}
                        >
                            <option value={-1}>ทุกเดือน</option>
                            {MONTHS_TH.map((m, i) => (
                                <option key={i} value={i}>{m}</option>
                            ))}
                        </select>
                        <div className="w-px h-4 bg-slate-300"></div>
                        <select 
                            className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer py-1 px-1"
                            value={selectedQuarter}
                            onChange={(e) => handleQuarterChange(parseInt(e.target.value))}
                        >
                            <option value={0}>ไตรมาส</option>
                            <option value={1}>Q1 (ม.ค.-มี.ค.)</option>
                            <option value={2}>Q2 (เม.ย.-มิ.ย.)</option>
                            <option value={3}>Q3 (ก.ค.-ก.ย.)</option>
                            <option value={4}>Q4 (ต.ค.-ธ.ค.)</option>
                        </select>
                    </div>

                    <div className="hidden md:block w-px h-8 bg-slate-200 mx-1"></div>

                    <MultiSelectDropdown 
                        label="หน่วยงาน" 
                        icon={Layers} 
                        options={sortedDivisions} 
                        selected={selectedDivisions} 
                        onChange={setSelectedDivisions}
                        colorClass="text-emerald-600"
                    />

                    <MultiSelectDropdown 
                        label="แผนก" 
                        icon={Building2} 
                        options={sortedDepartments} 
                        selected={selectedDepartments} 
                        onChange={setSelectedDepartments}
                        colorClass="text-teal-600"
                    />

                    <MultiSelectDropdown 
                        label="หมวดงาน" 
                        icon={Briefcase} 
                        options={sortedJobTypes} 
                        selected={selectedJobTypes} 
                        onChange={setSelectedJobTypes}
                        colorClass="text-indigo-600"
                    />
                    
                    <MultiSelectDropdown 
                        label="กลุ่มงาน" 
                        icon={Wrench} 
                        options={sortedRepairGroups} 
                        selected={selectedRepairGroups} 
                        onChange={setSelectedRepairGroups}
                        colorClass="text-amber-600"
                    />

                    <MultiSelectDropdown 
                        label="บริษัท" 
                        icon={Building2} 
                        options={sortedCompanies} 
                        selected={selectedCompanies} 
                        onChange={setSelectedCompanies}
                        colorClass="text-blue-600"
                    />

                    <MultiSelectDropdown 
                        label="หมวดจ่าย" 
                        icon={List} 
                        options={sortedExpenseCategories} 
                        selected={selectedCategories} 
                        onChange={setSelectedCategories}
                        colorClass="text-purple-600"
                    />
                </div>
            </div>

            {/* Reset Button */}
            <button 
                onClick={resetFilters}
                className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors flex-shrink-0"
                title="ล้างค่าตัวกรองทั้งหมด"
            >
                <RotateCcw size={18}/>
            </button>
        </div>

        {/* 1. Summary Cards by Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 rounded-2xl shadow-lg">
                <p className="text-slate-300 text-sm font-medium mb-1">ยอดรวมทั้งหมด</p>
                <h3 className="text-3xl font-bold">{allCosts.reduce((sum, c) => sum + c.totalPrice, 0).toLocaleString()} <span className="text-sm font-normal text-slate-400">บาท</span></h3>
                <div className="mt-4 text-xs text-slate-400 bg-white/10 p-2 rounded-lg inline-flex items-center">
                    <Calendar size={12} className="mr-1"/> 
                    {selectedQuarter > 0 
                        ? `ไตรมาส ${selectedQuarter} ปี ${selectedYear}`
                        : (selectedMonth === -1 ? `ประจำปี ${selectedYear}` : `ประจำเดือน ${MONTHS_TH[selectedMonth]} ${selectedYear}`)
                    }
                </div>
            </div>
            {Object.entries(categorySummary).map(([cat, total]: [string, number]) => total > 0 && (
                <div key={cat} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                    <p className="text-slate-500 text-xs font-bold uppercase mb-2 truncate" title={cat}>{cat}</p>
                    <h3 className="text-2xl font-bold text-slate-800">{total.toLocaleString()} <span className="text-sm text-slate-400">บาท</span></h3>
                </div>
            ))}
        </div>

        {/* 2. Matrix Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800">สรุปค่าใช้จ่ายแยกตามแผนก</h3>
                <button 
                    onClick={handleExportSummaryExcel}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 shadow-sm transition-all"
                >
                    <Download size={14}/> Export สรุปตามแผนก
                </button>
            </div>
            <div 
                className="overflow-x-auto select-none" 
                ref={matrixScroll.ref}
                {...matrixScroll.events}
                style={matrixScroll.style}
            >
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 min-w-[200px]">แผนก</th>
                            {expenseCategories.map(cat => (
                                <th key={cat} className="px-4 py-4 text-right min-w-[150px]">{cat}</th>
                            ))}
                            <th className="px-4 py-4 text-right min-w-[100px] bg-slate-100 text-slate-800">รวม</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {deptMatrix.map(([dept, values]) => {
                            // Extract code for display if available
                            const shortDept = getShortDept(dept);
                            return (
                                <tr key={dept} className="hover:bg-slate-50">
                                    <td className="px-6 py-3 font-medium text-slate-700" title={dept}>
                                        {shortDept}
                                        {shortDept !== dept && <span className="text-[10px] text-slate-400 block font-normal truncate max-w-[200px]">{dept}</span>}
                                    </td>
                                    {expenseCategories.map(cat => (
                                        <td key={cat} className="px-4 py-3 text-right text-slate-600">
                                            {values[cat] > 0 ? values[cat].toLocaleString() : '-'}
                                        </td>
                                    ))}
                                    <td className="px-4 py-3 text-right font-bold text-brand-600 bg-slate-50">
                                        {values.total.toLocaleString()}
                                    </td>
                                </tr>
                            );
                        })}
                         {deptMatrix.length === 0 && (
                            <tr><td colSpan={expenseCategories.length + 2} className="text-center py-8 text-slate-400">ไม่พบข้อมูลค่าใช้จ่ายในช่วงเวลานี้</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* 3. Detailed Transaction List (Grouped by Job) */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-slate-800">รายการเบิกจ่ายทั้งหมด ({allCosts.length.toLocaleString()})</h3>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto">
                    {/* NEW: Search Box specific to this list */}
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500"
                            placeholder="ค้นหา (รายการ, เลขที่, บริษัท)"
                            value={transactionSearch}
                            onChange={(e) => setTransactionSearch(e.target.value)}
                        />
                    </div>

                    <button 
                        onClick={handleExportTransactionsExcel}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm transition-all whitespace-nowrap"
                    >
                        <Download size={14}/> Export
                    </button>
                </div>
            </div>
            
            <div className="overflow-x-auto select-none" ref={listScroll.ref} {...listScroll.events} style={listScroll.style}>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold">
                        <tr>
                            <th className="px-4 py-3 min-w-[250px]">รายการเบิกจ่าย</th>
                            <th className="px-4 py-3 min-w-[180px]">หมวดค่าใช้จ่าย</th>
                            <th className="px-4 py-3 min-w-[180px]">บริษัทคู่ค้า</th>
                            <th className="px-4 py-3 min-w-[120px] text-right">จำนวน x ราคา</th>
                            <th className="px-4 py-3 min-w-[120px] text-right">ราคารวม</th>
                            {canEdit && <th className="px-4 py-3 text-center w-16">แก้ไข</th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayedGroups.map((group) => (
                            <React.Fragment key={group.jobId}>
                                {/* Group Header Row */}
                                <tr className="bg-slate-50/70 border-b border-slate-200">
                                    <td colSpan={canEdit ? 6 : 5} className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="px-2 py-1 bg-brand-100 text-brand-700 rounded-md text-xs font-black font-mono">
                                                {group.jobId}
                                            </div>
                                            <div className="text-xs text-slate-500 font-bold">
                                                {formatDate(group.latestDate)}
                                            </div>
                                            <div className="flex flex-col justify-center">
                                                <div className="text-sm font-bold text-slate-800 truncate max-w-[350px]" title={group.jobDescription}>
                                                    {group.jobDescription}
                                                </div>
                                                {group.jobDamage && (
                                                    <div className="text-[10px] text-slate-500 truncate max-w-[350px]" title={group.jobDamage}>
                                                        อาการ: {group.jobDamage}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ml-auto flex items-center gap-4">
                                                <div className="text-xs text-slate-500 flex items-center gap-1 hidden md:flex">
                                                    <Building2 size={12}/> {getShortDept(group.jobDepartment)}
                                                </div>
                                                <div className="text-sm font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 whitespace-nowrap">
                                                    รวม {group.totalCost.toLocaleString()} บาท
                                                </div>
                                                {onEditJob && (
                                                    <button 
                                                        onClick={() => {
                                                            const job = jobs.find(j => j.id === group.jobId);
                                                            if (job) onEditJob(job);
                                                        }}
                                                        className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-brand-50 hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm"
                                                        title="แก้ไขใบงาน"
                                                    >
                                                        <Edit2 size={14}/>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                                
                                {/* Cost Item Rows */}
                                {group.items.map((item, idx) => (
                                    <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 pl-12">
                                            <div className="font-medium text-slate-700">{item.name}</div>
                                            {item.code && <div className="text-[10px] text-slate-400">Code: {item.code}</div>}
                                        </td>
                                        <td className="px-4 py-2">
                                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2">
                                            {item.company ? (
                                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                                    {item.company}
                                                </span>
                                            ) : <span className="text-xs text-slate-300">-</span>}
                                        </td>
                                        <td className="px-4 py-2 text-right text-xs text-slate-600">
                                            {item.quantity} x {item.pricePerUnit.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-2 text-right font-bold text-slate-700">
                                            {item.totalPrice.toLocaleString()}
                                        </td>
                                        {canEdit && (
                                            <td className="px-4 py-2 text-center">
                                                <button 
                                                    onClick={() => setEditingCost({ jobId: item.jobId, cost: item })}
                                                    className="text-slate-400 hover:text-brand-600 p-1.5 hover:bg-brand-50 rounded transition-colors"
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </React.Fragment>
                        ))}
                        {displayedGroups.length === 0 && (
                            <tr><td colSpan={canEdit ? 6 : 5} className="text-center py-12 text-slate-400">ไม่พบรายการค่าใช้จ่าย</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            {totalPages > 0 && (
                <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-slate-500 font-medium">
                        แสดง <span className="font-bold text-slate-800">{startItem + 1}</span> ถึง <span className="font-bold text-slate-800">{Math.min(startItem + itemsPerPage, groupedTransactions.length)}</span> จาก <span className="font-bold text-slate-800">{groupedTransactions.length.toLocaleString()}</span> ใบงาน
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <button 
                            disabled={currentPage === 1} 
                            onClick={() => setCurrentPage(1)} 
                            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
                            title="หน้าแรก"
                        >
                            <ChevronsLeft size={18}/>
                        </button>
                        <button 
                            disabled={currentPage === 1} 
                            onClick={() => setCurrentPage(p => p - 1)} 
                            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
                            title="ก่อนหน้า"
                        >
                            <ChevronLeft size={18}/>
                        </button>
                        
                        <div className="flex items-center gap-1 mx-2">
                            <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-md min-w-[3rem] text-center">
                            {currentPage}
                            </span>
                            <span className="text-sm text-slate-400 font-medium">/</span>
                            <span className="text-sm text-slate-500 font-medium">
                            {totalPages || 1}
                            </span>
                        </div>

                        <button 
                            disabled={currentPage === totalPages || totalPages === 0} 
                            onClick={() => setCurrentPage(p => p + 1)} 
                            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
                            title="ถัดไป"
                        >
                            <ChevronRight size={18}/>
                        </button>
                        <button 
                            disabled={currentPage === totalPages || totalPages === 0} 
                            onClick={() => setCurrentPage(totalPages)} 
                            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed text-slate-500 transition-colors"
                            title="หน้าสุดท้าย"
                        >
                            <ChevronsRight size={18}/>
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Edit Modal */}
        {editingCost && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg animate-fade-in-up">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                        <h3 className="text-lg font-bold text-slate-800">แก้ไขรายการค่าใช้จ่าย</h3>
                        <button onClick={() => setEditingCost(null)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">วันที่บันทึกค่าใช้จ่าย</label>
                            <input 
                                type="date"
                                className="w-full p-2.5 border rounded-lg bg-slate-50"
                                value={editingCost.cost.date || new Date().toISOString().split('T')[0]}
                                onChange={e => setEditingCost({...editingCost, cost: {...editingCost.cost, date: e.target.value}})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">รายการ</label>
                            <input 
                                className="w-full p-2.5 border rounded-lg bg-slate-50"
                                value={editingCost.cost.name}
                                onChange={e => setEditingCost({...editingCost, cost: {...editingCost.cost, name: e.target.value}})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">หมวดค่าใช้จ่าย</label>
                            <select 
                                className="w-full p-2.5 border rounded-lg bg-slate-50"
                                value={editingCost.cost.category || ''}
                                onChange={e => setEditingCost({...editingCost, cost: {...editingCost.cost, category: e.target.value}})}
                            >
                                <option value="">-- เลือกหมวด --</option>
                                {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">บริษัท</label>
                            <input 
                                className="w-full p-2.5 border rounded-lg bg-slate-50"
                                value={editingCost.cost.company || ''}
                                onChange={e => setEditingCost({...editingCost, cost: {...editingCost.cost, company: e.target.value}})}
                                placeholder="ระบุชื่อบริษัท"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">จำนวน</label>
                                <input 
                                    type="number" min="1"
                                    className="w-full p-2.5 border rounded-lg bg-slate-50"
                                    value={editingCost.cost.quantity}
                                    onChange={e => {
                                        const qty = parseInt(e.target.value) || 0;
                                        setEditingCost({
                                            ...editingCost, 
                                            cost: {
                                                ...editingCost.cost, 
                                                quantity: qty,
                                                totalPrice: qty * editingCost.cost.pricePerUnit
                                            }
                                        });
                                    }}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">ราคา/หน่วย</label>
                                <input 
                                    type="number" min="0"
                                    className="w-full p-2.5 border rounded-lg bg-slate-50"
                                    value={editingCost.cost.pricePerUnit}
                                    onChange={e => {
                                        const price = parseFloat(e.target.value) || 0;
                                        setEditingCost({
                                            ...editingCost, 
                                            cost: {
                                                ...editingCost.cost, 
                                                pricePerUnit: price,
                                                totalPrice: price * editingCost.cost.quantity
                                            }
                                        });
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
                        <button 
                            onClick={() => setEditingCost(null)}
                            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-bold hover:bg-slate-50"
                        >
                            ยกเลิก
                        </button>
                        <button 
                            onClick={handleEditSave}
                            className="px-4 py-2 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-sm flex items-center"
                        >
                            <Save size={18} className="mr-2"/> บันทึกการแก้ไข
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ExpenseSummary;
