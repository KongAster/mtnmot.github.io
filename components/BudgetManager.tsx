
import React, { useState, useEffect, useMemo } from 'react';
import { BudgetItem, UserRole } from '../types';
import { dataService } from '../services/dataService';
import { 
    Coins, Plus, Calendar, Save, Filter, ChevronDown, ChevronUp, Edit2, Trash2, X, Check, PieChart, TrendingUp, Calculator, CheckSquare, Square, Hash
} from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

interface BudgetManagerProps {
    userRole?: UserRole;
    budgetCategories?: string[]; // Receive configured categories
}

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// Helper for Natural Sort (e.g. 1.1, 1.2, 1.10 instead of 1.1, 1.10, 1.2)
const naturalSort = (a: string, b: string) => {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
};

const BudgetManager: React.FC<BudgetManagerProps> = ({ userRole, budgetCategories = [] }) => {
    const { notify } = useNotification();
    const canEdit = userRole !== 'TECHNICIAN';
    const [year, setYear] = useState<number>(2569);
    const [budgets, setBudgets] = useState<BudgetItem[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Scroll Hook
    const tableScroll = useDraggableScroll<HTMLDivElement>();
    
    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<BudgetItem>>({});
    
    // Distribution Mode in Modal: 'AUTO' (Average/Selective) or 'MANUAL' (Custom)
    const [distMode, setDistMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
    // Selected months for Auto distribution (Indices 0-11)
    const [selectedMonths, setSelectedMonths] = useState<number[]>(Array.from({length: 12}, (_, i) => i));

    // --- Auto Cleanup Old Budget Data ---
    useEffect(() => {
        const performCleanup = async () => {
             const currentYear = new Date().getFullYear() + 543;
             // Policy: Delete budgets older than 2 years
             const targetYear = currentYear - 2;
             
             try {
                 const count = await dataService.cleanupOldBudgets(targetYear);
                 if (count > 0) {
                     notify(`ระบบได้ทำการลบรายการงบประมาณเก่าปี ${targetYear} ออกอัตโนมัติ (${count} รายการ)`, 'info');
                 }
             } catch (e) {
                 console.error("Auto cleanup failed", e);
             }
        };
        performCleanup();
    }, []);

    useEffect(() => {
        loadBudgets();
    }, [year]);

    const loadBudgets = async () => {
        setLoading(true);
        try {
            const data = await dataService.getBudgets(year);
            setBudgets(data);
        } catch (e) {
            notify('โหลดข้อมูลงบประมาณล้มเหลว', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Calculate distribution when Total Budget or Selected Months change (Only in AUTO mode)
    useEffect(() => {
        if (distMode === 'AUTO' && (isAddModalOpen || isEditPlanModalOpen)) {
            const total = editingItem.totalBudget || 0;
            const count = selectedMonths.length;
            
            const newPlan = Array(12).fill(0);
            
            if (count > 0 && total > 0) {
                const avg = Math.floor(total / count);
                const remainder = total % count;
                
                let distributedCount = 0;
                selectedMonths.sort((a,b) => a - b).forEach((monthIdx) => {
                    // Add remainder to the last selected month
                    const isLast = distributedCount === count - 1;
                    newPlan[monthIdx] = avg + (isLast ? remainder : 0);
                    distributedCount++;
                });
            }
            
            setEditingItem(prev => ({ ...prev, monthlyPlan: newPlan }));
        }
    }, [editingItem.totalBudget, selectedMonths, distMode, isAddModalOpen, isEditPlanModalOpen]);

    const suggestNextCode = (category: string) => {
        if (!category) return '';
        const catMatch = category.match(/\d+/);
        const catNum = catMatch ? parseInt(catMatch[0]) : 0;
        const existingInCat = budgets.filter(b => b.category === category);
        if (existingInCat.length === 0) return `${catNum}.1`;

        let maxMinor = 0;
        existingInCat.forEach(b => {
            const code = b.itemCode || b.name.split(' ')[0]; 
            const parts = code.split('.');
            if (parts.length >= 2) {
                const minor = parseInt(parts[1]);
                if (!isNaN(minor) && minor > maxMinor) maxMinor = minor;
            }
        });
        return `${catNum}.${maxMinor + 1}`;
    };

    const handleCategoryChange = (newCategory: string) => {
        const nextCode = suggestNextCode(newCategory);
        setEditingItem(prev => ({ ...prev, category: newCategory, itemCode: nextCode }));
    };

    const handleSaveItem = async () => {
        if (!editingItem.name || !editingItem.category || !editingItem.totalBudget || !editingItem.itemCode) {
            notify('กรุณากรอกข้อมูลให้ครบถ้วน (รวมถึงลำดับหัวข้อ)', 'error');
            return;
        }

        try {
            let finalPlan = editingItem.monthlyPlan || Array(12).fill(0);
            let finalTotal = editingItem.totalBudget;

            if (distMode === 'MANUAL') {
                finalTotal = finalPlan.reduce((a, b) => a + b, 0);
            }

            // --- AUTO-SHIFT LOGIC START ---
            const targetCode = editingItem.itemCode.trim();
            const targetCategory = editingItem.category;
            
            const duplicate = budgets.find(b => 
                b.category === targetCategory && 
                b.itemCode === targetCode && 
                b.id !== editingItem.id
            );

            if (duplicate) {
                const targetParts = targetCode.split('.');
                if (targetParts.length === 2) {
                    const major = targetParts[0];
                    const startMinor = parseInt(targetParts[1]);

                    if (!isNaN(startMinor)) {
                        const itemsToShift = budgets.filter(b => {
                            if (b.category !== targetCategory) return false;
                            if (b.id === editingItem.id) return false; 
                            const parts = (b.itemCode || '').split('.');
                            if (parts.length !== 2) return false;
                            if (parts[0] !== major) return false;
                            const minor = parseInt(parts[1]);
                            return !isNaN(minor) && minor >= startMinor;
                        });

                        itemsToShift.sort((a, b) => {
                            const minA = parseInt((a.itemCode || '0.0').split('.')[1]);
                            const minB = parseInt((b.itemCode || '0.0').split('.')[1]);
                            return minB - minA;
                        });

                        for (const item of itemsToShift) {
                            const parts = (item.itemCode || '').split('.');
                            const newMinor = parseInt(parts[1]) + 1;
                            const newCode = `${parts[0]}.${newMinor}`;
                            await dataService.saveBudget({ ...item, itemCode: newCode });
                        }
                    }
                }
            }
            // --- AUTO-SHIFT LOGIC END ---

            const newItem: BudgetItem = {
                id: editingItem.id || crypto.randomUUID(),
                year: year,
                category: editingItem.category,
                itemCode: editingItem.itemCode,
                name: editingItem.name,
                totalBudget: finalTotal,
                monthlyPlan: finalPlan,
                monthlyActual: editingItem.monthlyActual || Array(12).fill(0)
            };

            await dataService.saveBudget(newItem);
            notify('บันทึกข้อมูลสำเร็จ', 'success');
            setIsAddModalOpen(false);
            setIsEditPlanModalOpen(false);
            setEditingItem({});
            loadBudgets();
        } catch (e) {
            notify('บันทึกข้อมูลล้มเหลว', 'error');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('ยืนยันการลบรายการนี้?')) {
            try {
                await dataService.deleteBudget(id);
                loadBudgets();
                notify('ลบข้อมูลสำเร็จ', 'success');
            } catch (e) {
                notify('ลบข้อมูลล้มเหลว', 'error');
            }
        }
    };

    const handleActualChange = async (item: BudgetItem, monthIndex: number, val: string) => {
        const newValue = parseFloat(val) || 0;
        const updatedActual = [...item.monthlyActual];
        updatedActual[monthIndex] = newValue;
        
        const updatedItem = { ...item, monthlyActual: updatedActual };
        
        setBudgets(prev => prev.map(b => b.id === item.id ? updatedItem : b));
        
        try {
            await dataService.saveBudget(updatedItem);
        } catch (e) {
            console.error(e);
        }
    };

    const toggleMonthSelection = (monthIdx: number) => {
        setSelectedMonths(prev => {
            if (prev.includes(monthIdx)) return prev.filter(m => m !== monthIdx);
            return [...prev, monthIdx];
        });
    };

    const summary = useMemo(() => {
        const monthlyPlanTotal = Array(12).fill(0);
        const monthlyActualTotal = Array(12).fill(0);
        let yearPlanTotal = 0;
        let yearActualTotal = 0;

        budgets.forEach(b => {
            yearPlanTotal += b.totalBudget;
            b.monthlyPlan.forEach((val, i) => monthlyPlanTotal[i] += val);
            b.monthlyActual.forEach((val, i) => {
                monthlyActualTotal[i] += val;
                yearActualTotal += val;
            });
        });

        return { monthlyPlanTotal, monthlyActualTotal, yearPlanTotal, yearActualTotal };
    }, [budgets]);

    // Group by Category with Natural Sort for Items
    const groupedBudgets = useMemo(() => {
        const groups: Record<string, BudgetItem[]> = {};
        budgets.forEach(b => {
            if (!groups[b.category]) groups[b.category] = [];
            groups[b.category].push(b);
        });
        
        // Sort keys (categories)
        const sortedKeys = Object.keys(groups).sort((a,b) => a.localeCompare(b, 'th'));
        
        // Sort items within groups (Natural Sort)
        sortedKeys.forEach(key => {
            groups[key].sort((a, b) => naturalSort(a.itemCode || '', b.itemCode || ''));
        });

        return sortedKeys.map(key => [key, groups[key]] as [string, BudgetItem[]]);
    }, [budgets]);

    const availableCategories = useMemo(() => {
        const existing = new Set(budgets.map(b => b.category));
        const all = new Set([...(budgetCategories || []), ...existing]);
        return Array.from(all).sort((a, b) => a.localeCompare(b, 'th'));
    }, [budgets, budgetCategories]);

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header and Summary Cards */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Coins className="text-brand-600" /> ข้อมูลงบประมาณแผนก
                    </h2>
                    <p className="text-slate-500 text-sm mt-1">บริหารจัดการและติดตามงบประมาณประจำปี</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1">
                        <button onClick={() => setYear(y => y-1)} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all"><ChevronDown size={16}/></button>
                        <span className="font-bold text-lg w-24 text-center text-brand-700">ปี {year}</span>
                        <button onClick={() => setYear(y => y+1)} className="p-2 hover:bg-white rounded-lg text-slate-500 transition-all"><ChevronUp size={16}/></button>
                    </div>
                    {canEdit && (
                        <button 
                            onClick={() => { 
                                setEditingItem({ year }); 
                                setDistMode('AUTO'); 
                                setSelectedMonths(Array.from({length: 12}, (_, i) => i));
                                setIsAddModalOpen(true); 
                            }}
                            className="bg-brand-600 text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all"
                        >
                            <Plus size={18}/> เพิ่มรายการ
                        </button>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-blue-50 text-blue-600 rounded-xl"><PieChart size={24}/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">งบประมาณตามแผน (Plan)</p>
                        <h3 className="text-2xl font-black text-slate-800">{summary.yearPlanTotal.toLocaleString()} <span className="text-sm font-normal text-slate-400">บาท</span></h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl"><TrendingUp size={24}/></div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">ใช้จริง (Actual)</p>
                        <h3 className="text-2xl font-black text-slate-800">{summary.yearActualTotal.toLocaleString()} <span className="text-sm font-normal text-slate-400">บาท</span></h3>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className={`p-4 rounded-xl ${summary.yearPlanTotal - summary.yearActualTotal >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                        <Calculator size={24}/>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">คงเหลือ (Remaining)</p>
                        <h3 className={`text-2xl font-black ${summary.yearPlanTotal - summary.yearActualTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(summary.yearPlanTotal - summary.yearActualTotal).toLocaleString()} <span className="text-sm font-normal text-slate-400">บาท</span>
                        </h3>
                    </div>
                </div>
            </div>

            {/* Main Table Container */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative h-[600px]">
                <div 
                    className="overflow-auto custom-scrollbar pb-2 select-none h-full"
                    ref={tableScroll.ref}
                    {...tableScroll.events}
                    style={tableScroll.style}
                >
                    <table className="w-full text-sm border-collapse min-w-[3000px]">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-40 shadow-sm">
                            <tr>
                                {/* Sticky Columns with High Z-Index & SOLID Background to prevent overlap */}
                                <th rowSpan={2} className="px-4 py-3 text-left border-r border-slate-200 sticky left-0 top-0 bg-slate-100 z-50 w-[60px] min-w-[60px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">No.</th>
                                <th rowSpan={2} className="px-4 py-3 text-left border-r border-slate-200 sticky left-[60px] top-0 w-[340px] min-w-[340px] bg-slate-100 z-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">รายการ (Items)</th>
                                <th rowSpan={2} className="px-3 py-3 text-right border-r border-slate-200 sticky left-[400px] top-0 w-[140px] min-w-[140px] bg-slate-100 z-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">งบรวมปี</th>
                                
                                {/* Scrollable Month Columns (Span 3 for Plan, Actual, %) */}
                                {MONTHS_TH.map((m, i) => (
                                    <th key={i} colSpan={3} className="px-2 py-2 text-center border-r border-slate-200 border-b w-[240px] min-w-[240px] text-xs uppercase tracking-wider">{m}</th>
                                ))}
                                {canEdit && <th rowSpan={2} className="px-2 py-3 text-center w-[60px] min-w-[60px]">จัดการ</th>}
                            </tr>
                            <tr>
                                {MONTHS_TH.map((_, i) => (
                                    <React.Fragment key={i}>
                                        <th className="px-1 py-1 text-center border-r border-slate-200 text-[10px] text-blue-600 bg-blue-50/50 w-[80px] min-w-[80px]">Plan</th>
                                        <th className="px-1 py-1 text-center border-r border-slate-200 text-[10px] text-emerald-600 bg-emerald-50/50 w-[80px] min-w-[80px]">Actual</th>
                                        <th className="px-1 py-1 text-center border-r border-slate-200 text-[10px] text-slate-600 bg-slate-50 w-[60px] min-w-[60px]">%</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {groupedBudgets.map(([category, items]) => {
                                // Calculate Category Subtotals
                                const catPlanTotal = items.reduce((sum, item) => sum + item.totalBudget, 0);
                                const catMonthlyPlan = Array(12).fill(0).map((_, i) => items.reduce((sum, item) => sum + (item.monthlyPlan[i] || 0), 0));
                                const catMonthlyActual = Array(12).fill(0).map((_, i) => items.reduce((sum, item) => sum + (item.monthlyActual[i] || 0), 0));

                                return (
                                    <React.Fragment key={category}>
                                        {/* Category Header Row */}
                                        <tr className="bg-slate-50 font-bold text-slate-800 border-y border-slate-200">
                                            {/* Sticky Cells for Category Row - USE SOLID COLOR */}
                                            <td className="px-4 py-2 sticky left-0 bg-slate-50 z-30 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]" colSpan={2}>
                                                {category}
                                            </td>
                                            <td className="px-3 py-2 text-right border-r border-slate-200 text-slate-700 bg-slate-100 sticky left-[400px] z-30 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                {catPlanTotal.toLocaleString()}
                                            </td>
                                            {/* Scrollable Summary Cells */}
                                            {Array.from({length: 12}).map((_, i) => {
                                                const pct = catMonthlyPlan[i] > 0 ? (catMonthlyActual[i] / catMonthlyPlan[i]) * 100 : 0;
                                                return (
                                                    <React.Fragment key={i}>
                                                        <td className="px-1 py-2 text-right border-r border-slate-200 bg-blue-50/30 text-blue-800 text-xs">
                                                            {catMonthlyPlan[i].toLocaleString()}
                                                        </td>
                                                        <td className="px-1 py-2 text-right border-r border-slate-200 bg-emerald-50/30 text-emerald-800 text-xs">
                                                            {catMonthlyActual[i].toLocaleString()}
                                                        </td>
                                                        <td className={`px-1 py-2 text-center border-r border-slate-200 text-xs ${pct > 100 ? 'text-red-600 font-bold' : 'text-slate-500'}`}>
                                                            {pct > 0 ? `${pct.toFixed(0)}%` : '-'}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            {canEdit && <td></td>}
                                        </tr>

                                        {/* Items */}
                                        {items.map(item => (
                                            <tr key={item.id} className="hover:bg-slate-50 group">
                                                <td className="px-2 py-2 border-r border-slate-100 sticky left-0 bg-white group-hover:bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-center font-mono text-xs text-brand-600 font-bold">
                                                    {item.itemCode || '-'}
                                                </td>
                                                <td className="px-4 py-2 border-r border-slate-100 sticky left-[60px] bg-white group-hover:bg-slate-50 z-20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                    <div className="font-medium text-slate-700 text-xs leading-relaxed truncate max-w-[320px]" title={item.name}>{item.name}</div>
                                                </td>
                                                <td className="px-3 py-2 text-right border-r border-slate-100 font-bold text-slate-800 bg-white text-xs sticky left-[400px] z-20 group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                                    {item.totalBudget.toLocaleString()}
                                                </td>
                                                {Array.from({length: 12}).map((_, i) => {
                                                    const planVal = item.monthlyPlan[i] || 0;
                                                    const actualVal = item.monthlyActual[i] || 0;
                                                    const pct = planVal > 0 ? (actualVal / planVal) * 100 : 0;
                                                    
                                                    return (
                                                        <React.Fragment key={i}>
                                                            <td className="px-1 py-1 text-right border-r border-slate-100 bg-blue-50/10 text-xs text-slate-500">
                                                                {planVal > 0 ? planVal.toLocaleString() : '-'}
                                                            </td>
                                                            <td className="px-1 py-1 border-r border-slate-100 bg-emerald-50/10 p-0">
                                                                {canEdit ? (
                                                                    <input 
                                                                        type="number" 
                                                                        className="w-full h-full text-right bg-transparent outline-none focus:bg-emerald-50 px-1 text-xs font-bold text-emerald-700 placeholder-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                                        value={item.monthlyActual[i] || ''}
                                                                        placeholder="0"
                                                                        onChange={e => handleActualChange(item, i, e.target.value)}
                                                                    />
                                                                ) : (
                                                                    <div className="text-right px-1 text-xs font-bold text-emerald-700">
                                                                        {actualVal > 0 ? actualVal.toLocaleString() : '-'}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className={`px-1 py-1 text-center border-r border-slate-100 text-[10px] ${pct > 100 ? 'text-red-500 font-bold' : 'text-slate-400'}`}>
                                                                {pct > 0 ? `${pct.toFixed(0)}%` : ''}
                                                            </td>
                                                        </React.Fragment>
                                                    );
                                                })}
                                                {canEdit && (
                                                    <td className="px-2 py-2 text-center">
                                                        <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button 
                                                                onClick={() => { 
                                                                    setEditingItem(item); 
                                                                    setDistMode('MANUAL'); 
                                                                    setIsEditPlanModalOpen(true); 
                                                                }} 
                                                                className="p-1 hover:bg-blue-50 text-blue-600 rounded"
                                                            >
                                                                <Edit2 size={14}/>
                                                            </button>
                                                            <button onClick={() => handleDelete(item.id)} className="p-1 hover:bg-red-50 text-red-600 rounded"><Trash2 size={14}/></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                        {/* Footer - also Needs Sticky Logic */}
                        <tfoot className="bg-slate-800 text-white font-bold sticky bottom-0 z-50 shadow-[0_-2px_5px_-1px_rgba(0,0,0,0.2)]">
                            <tr>
                                <td className="px-4 py-3 text-right sticky left-0 bg-slate-800 z-50 border-r border-slate-700" colSpan={2}>ยอดรวมทั้งหมด (Total)</td>
                                <td className="px-3 py-3 text-right border-r border-slate-700 bg-slate-700 sticky left-[400px] z-50">{summary.yearPlanTotal.toLocaleString()}</td>
                                {Array.from({length: 12}).map((_, i) => {
                                    const pct = summary.monthlyPlanTotal[i] > 0 ? (summary.monthlyActualTotal[i] / summary.monthlyPlanTotal[i]) * 100 : 0;
                                    return (
                                        <React.Fragment key={i}>
                                            <td className="px-1 py-3 text-right border-r border-slate-700 text-[10px] text-blue-200">
                                                {summary.monthlyPlanTotal[i].toLocaleString()}
                                            </td>
                                            <td className="px-1 py-3 text-right border-r border-slate-700 text-[10px] text-emerald-300">
                                                {summary.monthlyActualTotal[i].toLocaleString()}
                                            </td>
                                            <td className={`px-1 py-3 text-center border-r border-slate-700 text-[10px] ${pct > 100 ? 'text-red-400' : 'text-slate-400'}`}>
                                                {pct > 0 ? `${pct.toFixed(0)}%` : '-'}
                                            </td>
                                        </React.Fragment>
                                    );
                                })}
                                {canEdit && <td></td>}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* ... (Modal code remains same) ... */}
            {(isAddModalOpen || isEditPlanModalOpen) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
                        {/* ... Modal Header & Content ... */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <h3 className="font-bold text-slate-800 text-lg">{isAddModalOpen ? 'เพิ่มรายการงบประมาณใหม่' : 'แก้ไขแผนงบประมาณ'}</h3>
                            <button onClick={() => { setIsAddModalOpen(false); setIsEditPlanModalOpen(false); }} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        
                        <div className="p-6 space-y-5 overflow-y-auto">
                            {/* ... Fields ... */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">หมวดหมู่ (Category)</label>
                                    <input 
                                        list="categories"
                                        className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={editingItem.category || ''}
                                        onChange={e => handleCategoryChange(e.target.value)}
                                        placeholder="เลือกหรือพิมพ์หมวดใหม่..."
                                    />
                                    <datalist id="categories">
                                        {availableCategories.map(c => (
                                            <option key={c} value={c} />
                                        ))}
                                    </datalist>
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">ลำดับหัวข้อ (Code)</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-3 text-slate-400" size={16}/>
                                        <input 
                                            className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none font-mono"
                                            value={editingItem.itemCode || ''}
                                            onChange={e => setEditingItem({...editingItem, itemCode: e.target.value})}
                                            placeholder="เช่น 1.1, 1.2"
                                        />
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">ชื่อรายการ (Description)</label>
                                    <input 
                                        className="w-full px-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                        value={editingItem.name || ''}
                                        onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                                        placeholder="ระบุชื่อรายการ..."
                                    />
                                </div>
                                
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">รูปแบบการกระจายงบ</label>
                                    <div className="flex bg-slate-100 p-1 rounded-xl">
                                        <button 
                                            onClick={() => setDistMode('AUTO')}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${distMode === 'AUTO' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}
                                        >
                                            เฉลี่ย (Auto Distribute)
                                        </button>
                                        <button 
                                            onClick={() => setDistMode('MANUAL')}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${distMode === 'MANUAL' ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}
                                        >
                                            กำหนดเอง (Manual)
                                        </button>
                                    </div>
                                </div>
                                
                                {distMode === 'AUTO' && (
                                    <div className="col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <label className="block text-xs font-bold text-brand-600 mb-2">
                                            งบประมาณรวมทั้งปี (Total Budget)
                                        </label>
                                        <input 
                                            type="number"
                                            className="w-full px-4 py-3 border-2 border-brand-200 rounded-xl text-3xl font-black text-brand-600 focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-right placeholder-slate-300"
                                            value={editingItem.totalBudget || ''}
                                            onChange={e => setEditingItem({...editingItem, totalBudget: parseFloat(e.target.value)})}
                                            placeholder="0.00"
                                        />
                                        
                                        <div className="mt-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-bold text-slate-500">เลือกเดือนที่จะเฉลี่ย ({selectedMonths.length} เดือน)</label>
                                                <div className="flex gap-2">
                                                    <button onClick={() => setSelectedMonths(Array.from({length: 12}, (_, i) => i))} className="text-[10px] text-brand-600 font-bold hover:underline">เลือกทั้งหมด</button>
                                                    <button onClick={() => setSelectedMonths([])} className="text-[10px] text-red-500 font-bold hover:underline">ล้าง</button>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-6 gap-2">
                                                {MONTHS_TH.map((m, i) => (
                                                    <button 
                                                        key={i}
                                                        onClick={() => toggleMonthSelection(i)}
                                                        className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${selectedMonths.includes(i) ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                                    >
                                                        {selectedMonths.includes(i) ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                        <span className="text-[10px] font-bold mt-1">{m}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Plan Table View */}
                            <div className="border rounded-xl overflow-hidden mt-4">
                                <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-600">ตารางแผนรายเดือน (Monthly Plan)</span>
                                    {distMode === 'MANUAL' && (
                                        <span className="text-xs font-bold text-slate-500">
                                            รวม: <span className="text-brand-600 text-sm">{(editingItem.monthlyPlan || []).reduce((a,b)=>a+b, 0).toLocaleString()}</span>
                                        </span>
                                    )}
                                </div>
                                <table className="w-full text-xs text-center">
                                    <thead className="bg-slate-50 font-bold text-slate-600">
                                        <tr>
                                            {MONTHS_TH.map(m => <th key={m} className="py-2 border-r border-slate-200 last:border-0 w-[8.33%]">{m}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            {Array.from({length: 12}).map((_, i) => (
                                                <td key={i} className="border-r border-slate-200 last:border-0 p-0">
                                                    <input 
                                                        type="number"
                                                        disabled={distMode === 'AUTO'}
                                                        className={`w-full text-center py-3 outline-none font-bold text-[11px] 
                                                            ${distMode === 'AUTO' 
                                                                ? (editingItem.monthlyPlan?.[i] ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-slate-300') 
                                                                : 'focus:bg-blue-50 text-blue-700'}`}
                                                        value={editingItem.monthlyPlan?.[i] || ''}
                                                        onChange={e => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            const newPlan = [...(editingItem.monthlyPlan || Array(12).fill(0))];
                                                            newPlan[i] = val;
                                                            setEditingItem({...editingItem, monthlyPlan: newPlan});
                                                        }}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                        </div>
                        <div className="bg-slate-50 px-6 py-4 border-t flex justify-end gap-3 shrink-0">
                            <button onClick={() => { setIsAddModalOpen(false); setIsEditPlanModalOpen(false); }} className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">ยกเลิก</button>
                            <button onClick={handleSaveItem} className="px-6 py-2 text-sm font-bold bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-md transition-all">บันทึก</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BudgetManager;
