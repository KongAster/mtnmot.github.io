
import React, { useState, useEffect, useMemo } from 'react';
import { UserRole, DailyExpense, BudgetItem, StandardItem } from '../types';
import { dataService } from '../services/dataService';
import { useNotification } from '../contexts/NotificationContext';
import { 
    Plus, Save, Trash2, Edit2, X, ChevronLeft, ChevronRight, FileSpreadsheet,
    Package, RefreshCw, Loader2, Search, AlertTriangle, Calendar, ChevronDown
} from 'lucide-react';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

interface DepartmentCostSheetProps {
    userRole?: UserRole;
    divisions?: { name: string; code: string }[]; 
}

const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

// Helper to normalize keys for matching
const normalizeKey = (str: string | undefined | null) => (str || '').trim().toLowerCase();

const DEFAULT_DIVISION = 'MTN'; 

const DepartmentCostSheet: React.FC<DepartmentCostSheetProps> = ({ userRole }) => {
    const { notify } = useNotification();
    const canEdit = userRole !== 'TECHNICIAN'; 

    // --- Global State ---
    const [year, setYear] = useState<number>(new Date().getFullYear());
    const [month, setMonth] = useState<number>(new Date().getMonth());
    const [searchQuery, setSearchQuery] = useState('');

    // --- Data Stores ---
    // 1. Standard Items: The permanent rows (Master Data) - Loaded ONCE
    const [standardItems, setStandardItems] = useState<StandardItem[]>([]);
    
    // 2. Expenses: The values for the specific month (Transaction Data) - Reloads on Date Change
    const [expensesMap, setExpensesMap] = useState<Record<string, DailyExpense>>({}); 
    
    const [budgets, setBudgets] = useState<BudgetItem[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // --- Local Editing State ---
    const [unsavedChanges, setUnsavedChanges] = useState<Record<string, number[]>>({});

    // --- Modal State ---
    const [isItemModalOpen, setIsItemModalOpen] = useState(false);
    const [newItemForm, setNewItemForm] = useState<Partial<StandardItem>>({});
    const [isEditingItem, setIsEditingItem] = useState<string | null>(null);

    const tableScroll = useDraggableScroll<HTMLDivElement>();

    // --- Navigation Handlers ---
    const confirmDiscardChanges = () => {
        if (Object.keys(unsavedChanges).length > 0) {
            return window.confirm('คุณมีข้อมูลที่ยังไม่ได้บันทึก การเปลี่ยนหน้าจะทำให้ข้อมูลหายไป ยืนยันที่จะเปลี่ยนหน้า?');
        }
        return true;
    };

    const handleYearChange = (newYear: number) => {
        if (confirmDiscardChanges()) setYear(newYear);
    };

    const handleMonthChange = (newMonth: number) => {
        if (confirmDiscardChanges()) setMonth(newMonth);
    };

    // --- 1. Load Master Data (Standard Items) ---
    // Run ONCE on mount. These are the fixed rows.
    const fetchStandardItems = async () => {
        setLoading(true);
        try {
            // Fetch ALL items regardless of division/year to ensure they appear
            const itemsData = await dataService.getStandardItems('');
            setStandardItems(itemsData);
        } catch (e) {
            console.error("Failed to load standard items", e);
            notify('ไม่สามารถโหลดรายการสินค้าได้', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStandardItems();
    }, []); 

    // --- 2. Load Temporal Data (Budgets & Expenses) ---
    // Run whenever Year/Month changes. This fetches the NUMBERS to fill the grid.
    useEffect(() => {
        const fetchMonthlyData = async () => {
            const budgetYear = year < 2500 ? year + 543 : year;
            
            // 2.1 Load Budgets
            try {
                const budgetData = await dataService.getBudgets(budgetYear);
                setBudgets(budgetData);
            } catch (e) {
                setBudgets([]); 
            }

            // 2.2 Load Expenses for this specific month
            try {
                const expenseData = await dataService.getDailyExpenses(budgetYear, month, DEFAULT_DIVISION);
                const tempMap: Record<string, DailyExpense> = {};
                
                expenseData.forEach(e => {
                    // Map by StandardItemId if available (Best), else Fallback to Name+Code
                    if (e.standardItemId) {
                        tempMap[e.standardItemId] = e;
                    } else {
                        const key = `${normalizeKey(e.productCode)}_${normalizeKey(e.itemName)}`;
                        tempMap[key] = e;
                    }
                });
                
                setExpensesMap(tempMap);
                setUnsavedChanges({}); // Clear unsaved changes on month switch
            } catch (error) {
                console.error("Failed to load expenses", error);
            }
        };
        
        fetchMonthlyData();
    }, [year, month]); 

    // --- 3. Compute Grid Rows ---
    const gridRows = useMemo(() => {
        const rows: any[] = [];
        const usedExpenseIds = new Set<string>();

        // A. Iterate through Master Items (Standard Items) - These ALWAYS show up
        standardItems.forEach(item => {
            // Attempt to find matching expense data for this month
            let existingExpense = expensesMap[item.id];
            
            // Fallback match for legacy data
            if (!existingExpense) {
                const key = `${normalizeKey(item.code)}_${normalizeKey(item.name)}`;
                existingExpense = expensesMap[key];
            }

            if (existingExpense) {
                usedExpenseIds.add(existingExpense.id);
            }
            
            // Quantities: Use unsaved changes > Database value > Zeros
            const dbQuantities = existingExpense?.quantityDays || Array(31).fill(0);
            const currentQuantities = unsavedChanges[item.id] || dbQuantities;

            const totalQty = currentQuantities.reduce((a, b) => a + b, 0);
            const totalPrice = totalQty * item.pricePerUnit;

            rows.push({
                id: item.id,
                code: item.code,
                name: item.name,
                unit: item.unit,
                price: item.pricePerUnit,
                budgetInfo: `${item.budgetName} (${item.budgetCategory})`,
                quantities: currentQuantities,
                totalQty,
                totalPrice,
                expenseId: existingExpense?.id, // Might be null if new for this month
                budgetId: item.budgetId,
                budgetCategory: item.budgetCategory,
                budgetName: item.budgetName,
                hasChanges: !!unsavedChanges[item.id],
                isStandard: true
            });
        });

        // B. Handle Orphans (Expenses that exist for this month but don't match a Master Item)
        // This ensures we don't lose data if a Master Item was deleted but expenses remain
        Object.values(expensesMap).forEach((val) => {
            const expense = val as DailyExpense;
            // Check if this expense was already mapped to a standard item above
            if (usedExpenseIds.has(expense.id)) return;

            // Note: If standardItemId exists but wasn't found in standardItems list (deleted master), 
            // we still show it here so data isn't lost.
            
            const rowId = expense.id;
            const currentQuantities = unsavedChanges[rowId] || expense.quantityDays || Array(31).fill(0);
            const totalQty = currentQuantities.reduce((a, b) => a + b, 0);
            const totalPrice = totalQty * expense.pricePerUnit;

            rows.push({
                id: rowId,
                code: expense.productCode,
                name: expense.itemName,
                unit: 'หน่วย',
                price: expense.pricePerUnit,
                budgetInfo: `${expense.budgetName} (${expense.budgetCategory})`,
                quantities: currentQuantities,
                totalQty,
                totalPrice,
                expenseId: expense.id,
                budgetId: expense.budgetId,
                budgetCategory: expense.budgetCategory,
                budgetName: expense.budgetName,
                hasChanges: !!unsavedChanges[rowId],
                isStandard: false 
            });
        });

        // Filter by Search
        let filteredRows = rows;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filteredRows = rows.filter(r => 
                r.name.toLowerCase().includes(q) || 
                (r.code && r.code.toLowerCase().includes(q))
            );
        }

        // Sort: Standard items first by Code, then Orphans
        return filteredRows.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
    }, [standardItems, expensesMap, unsavedChanges, searchQuery]);

    const grandTotal = useMemo(() => gridRows.reduce((sum, r) => sum + r.totalPrice, 0), [gridRows]);
    const daysArray = useMemo(() => Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1), [year, month]);

    // --- Handlers ---

    const handleQuantityChange = (itemId: string, dayIndex: number, valStr: string) => {
        const val = valStr === '' ? 0 : parseInt(valStr);
        if (isNaN(val)) return;

        setUnsavedChanges(prev => {
            const currentRow = gridRows.find(r => r.id === itemId);
            // Default to all zeros if row initialized
            const newQuantities = currentRow ? [...currentRow.quantities] : Array(31).fill(0);
            while (newQuantities.length < 31) newQuantities.push(0);
            newQuantities[dayIndex] = val;
            return { ...prev, [itemId]: newQuantities };
        });
    };

    const handleSaveChanges = async () => {
        setIsSaving(true);
        const yearToUse = year < 2500 ? year + 543 : year;
        let saveCount = 0;

        try {
            const promises = Object.keys(unsavedChanges).map(async (rowId) => {
                const qtyArray = unsavedChanges[rowId];
                
                // Identify source: Standard Item or Orphan Expense
                const stdItem = standardItems.find(s => s.id === rowId);
                const orphanExpense = !stdItem 
                    ? (Object.values(expensesMap) as DailyExpense[]).find(e => e.id === rowId) 
                    : null;

                if (!stdItem && !orphanExpense) return;

                // Prepare Data
                const name = stdItem ? stdItem.name : orphanExpense!.itemName;
                const code = stdItem ? stdItem.code : orphanExpense!.productCode;
                const price = stdItem ? stdItem.pricePerUnit : orphanExpense!.pricePerUnit;
                const budgetId = stdItem ? stdItem.budgetId : orphanExpense!.budgetId;
                const budgetCat = stdItem ? stdItem.budgetCategory : orphanExpense!.budgetCategory;
                const budgetName = stdItem ? stdItem.budgetName : orphanExpense!.budgetName;
                const standardId = stdItem ? stdItem.id : undefined;

                const totalQty = qtyArray.reduce((a, b) => a + b, 0);
                const totalPrice = totalQty * price;

                // Resolve Expense ID (Update existing record or Create new one)
                let expenseId = undefined;

                if (stdItem) {
                    // Case 1: Saving a Standard Item Row
                    if (expensesMap[stdItem.id]) {
                        // 1a. Already linked by ID
                        expenseId = expensesMap[stdItem.id].id;
                    } else {
                        // 1b. Check if there is a Legacy Item (unlinked) with same Name/Code
                        const legacyKey = `${normalizeKey(code)}_${normalizeKey(name)}`;
                        if (expensesMap[legacyKey]) {
                            // Found legacy item! We will update it and LINK it.
                            expenseId = expensesMap[legacyKey].id;
                        }
                    }
                } else if (orphanExpense) {
                    // Case 2: Saving an Orphan/Legacy row directly
                    expenseId = orphanExpense.id;
                }
                
                if (!expenseId) expenseId = crypto.randomUUID();

                const payload: DailyExpense = {
                    id: expenseId,
                    year: yearToUse,
                    month: month,
                    division: DEFAULT_DIVISION,
                    budgetId: budgetId,
                    budgetCategory: budgetCat,
                    budgetName: budgetName,
                    productCode: code,
                    itemName: name,
                    pricePerUnit: price,
                    quantityDays: qtyArray,
                    totalQuantity: totalQty,
                    totalPrice: totalPrice,
                    standardItemId: standardId // This ensures linking happens!
                };

                await dataService.saveDailyExpense(payload);
                saveCount++;
            });

            await Promise.all(promises);
            
            // Reload expenses to sync state
            const expenseData = await dataService.getDailyExpenses(yearToUse, month, DEFAULT_DIVISION);
            const tempMap: Record<string, DailyExpense> = {};
            expenseData.forEach(e => {
                if (e.standardItemId) tempMap[e.standardItemId] = e;
                else tempMap[`${normalizeKey(e.productCode)}_${normalizeKey(e.itemName)}`] = e;
            });
            setExpensesMap(tempMap);
            setUnsavedChanges({});

            notify(`บันทึกข้อมูลเรียบร้อย (${saveCount} รายการ)`, 'success');

        } catch (e) {
            console.error(e);
            notify('บันทึกข้อมูลไม่สำเร็จ', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveItemDefinition = async () => {
        if (!newItemForm.name || !newItemForm.budgetId) {
            notify('กรุณาระบุชื่อสินค้าและหมวดงบประมาณ', 'error');
            return;
        }

        const selectedBudget = budgets.find(b => b.id === newItemForm.budgetId);
        
        const itemPayload: StandardItem = {
            id: newItemForm.id || crypto.randomUUID(),
            division: DEFAULT_DIVISION,
            code: newItemForm.code || '',
            name: newItemForm.name,
            unit: newItemForm.unit || 'ชิ้น',
            pricePerUnit: Number(newItemForm.pricePerUnit) || 0,
            budgetId: newItemForm.budgetId,
            budgetCategory: selectedBudget ? selectedBudget.category : (newItemForm.budgetCategory || ''),
            budgetName: selectedBudget ? selectedBudget.name : (newItemForm.budgetName || '')
        };

        try {
            await dataService.saveStandardItem(itemPayload);
            
            // Explicitly re-fetch standard items to ensure consistency
            await fetchStandardItems();

            setIsItemModalOpen(false);
            setNewItemForm({});
            setIsEditingItem(null);
            notify('บันทึกรายการสินค้าสำเร็จ (เพิ่มในรายการถาวรแล้ว)', 'success');
        } catch (e) {
            notify('บันทึกรายการไม่สำเร็จ', 'error');
        }
    };

    const handleDeleteItem = async (id: string, isStandard: boolean) => {
        if (!confirm(`ยืนยันการลบรายการนี้? (การลบจะทำให้รายการนี้หายไปจากทุกเดือน)`)) return;
        
        try {
            if (isStandard) {
                await dataService.deleteStandardItem(id);
                setStandardItems(prev => prev.filter(i => i.id !== id));
            } else {
                await dataService.deleteDailyExpense(id);
                setExpensesMap(prev => {
                    const next = { ...prev };
                    const keyToRemove = Object.keys(next).find(k => next[k].id === id);
                    if (keyToRemove) delete next[keyToRemove];
                    return next;
                });
            }
            notify('ลบรายการสำเร็จ', 'success');
        } catch (e) {
            notify('ลบไม่สำเร็จ', 'error');
        }
    };

    // --- Render ---
    return (
        <div className="space-y-4 animate-fade-in pb-10 relative h-[calc(100vh-100px)] flex flex-col">
            
            {/* 1. Top Control Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-50 text-brand-600 rounded-lg"><FileSpreadsheet size={24}/></div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">บันทึกจ่ายรายวัน</h2>
                        <p className="text-xs text-slate-500">จัดการข้อมูลการเบิกจ่ายวัสดุและอะไหล่</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto items-center">
                    {/* Unsaved Changes Warning */}
                    {Object.keys(unsavedChanges).length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 animate-pulse">
                            <AlertTriangle size={14} />
                            <span>มีการแก้ไขที่ยังไม่บันทึก</span>
                        </div>
                    )}

                    {/* Month Picker */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button onClick={() => handleMonthChange(month === 0 ? 11 : month - 1)} className="p-1.5 hover:bg-white rounded-md text-slate-500 transition-all"><ChevronLeft size={16}/></button>
                        <span className="text-sm font-bold text-slate-800 w-24 text-center select-none flex items-center justify-center gap-2">
                            <Calendar size={14} className="text-slate-400"/>
                            {MONTHS_TH[month]}
                        </span>
                        <button onClick={() => handleMonthChange(month === 11 ? 0 : month + 1)} className="p-1.5 hover:bg-white rounded-md text-slate-500 transition-all"><ChevronRight size={16}/></button>
                    </div>

                    {/* Year Picker */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <button onClick={() => handleYearChange(year - 1)} className="p-1.5 hover:bg-white rounded-md text-slate-500 transition-all"><ChevronLeft size={16}/></button>
                        <span className="text-sm font-bold text-slate-800 w-16 text-center select-none">{year < 2500 ? year + 543 : year}</span>
                        <button onClick={() => handleYearChange(year + 1)} className="p-1.5 hover:bg-white rounded-md text-slate-500 transition-all"><ChevronRight size={16}/></button>
                    </div>
                    
                    <button 
                        onClick={() => {
                            if (confirmDiscardChanges()) {
                                // Manual refresh just re-fetches expense numbers
                                setLoading(true);
                                const budgetYear = year < 2500 ? year + 543 : year;
                                dataService.getDailyExpenses(budgetYear, month, DEFAULT_DIVISION).then((expenseData) => {
                                    const tempMap: Record<string, DailyExpense> = {};
                                    expenseData.forEach(e => {
                                        if (e.standardItemId) tempMap[e.standardItemId] = e;
                                        else tempMap[`${normalizeKey(e.productCode)}_${normalizeKey(e.itemName)}`] = e;
                                    });
                                    setExpensesMap(tempMap);
                                    setUnsavedChanges({});
                                    setLoading(false);
                                });
                            }
                        }}
                        className="p-2 bg-white border border-slate-200 hover:border-brand-300 text-slate-500 hover:text-brand-600 rounded-lg transition-all shadow-sm" 
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {/* 2. Main Sheet Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden flex-1 relative">
                
                {/* Toolbar */}
                <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center bg-slate-50/30 gap-3">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="absolute left-3 top-2.5 text-slate-400" size={14}/>
                            <input 
                                type="text" 
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                placeholder="ค้นหารายการ..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="text-xs text-slate-500 hidden sm:block">
                            รวม: <span className="font-bold text-emerald-600 text-sm ml-1">{grandTotal.toLocaleString()}</span> ฿
                        </div>
                    </div>

                    {canEdit && (
                        <div className="flex gap-2 w-full sm:w-auto">
                            <button 
                                onClick={() => { setNewItemForm({}); setIsEditingItem(null); setIsItemModalOpen(true); }}
                                className="flex-1 sm:flex-none bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 shadow-sm text-xs transition-all active:scale-95"
                            >
                                <Plus size={16}/> เพิ่มรายการ
                            </button>
                            <button 
                                onClick={handleSaveChanges}
                                disabled={Object.keys(unsavedChanges).length === 0 || isSaving}
                                className={`flex-1 sm:flex-none px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 text-xs
                                    ${Object.keys(unsavedChanges).length > 0 
                                        ? 'bg-brand-600 text-white hover:bg-brand-700 shadow-brand-500/20' 
                                        : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'}
                                `}
                            >
                                {isSaving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16}/>} 
                                {isSaving ? 'กำลังบันทึก...' : `บันทึก (${Object.keys(unsavedChanges).length})`}
                            </button>
                        </div>
                    )}
                </div>
                
                {/* Scrollable Grid */}
                <div 
                    className="flex-1 overflow-auto select-none relative bg-white"
                    ref={tableScroll.ref}
                    {...tableScroll.events}
                    style={tableScroll.style}
                >
                    <table className="w-full text-xs border-collapse">
                        <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 z-30 shadow-sm">
                            <tr>
                                {/* Sticky Left Columns */}
                                <th className="px-2 py-3 border-r border-slate-200 sticky left-0 z-40 bg-slate-100 w-[50px] text-center shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">Code</th>
                                <th className="px-3 py-3 border-r border-slate-200 sticky left-[50px] z-40 bg-slate-100 w-[200px] text-left shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">รายการสินค้า</th>
                                <th className="px-2 py-3 border-r border-slate-200 w-[80px] text-right bg-slate-100">ราคา/หน่วย</th>
                                
                                {/* Days 1-31 */}
                                {daysArray.map(d => (
                                    <th key={d} className={`px-1 py-3 border-r border-slate-200 min-w-[35px] text-center ${d % 2 === 0 ? 'bg-slate-50' : 'bg-slate-100'}`}>
                                        {d}
                                    </th>
                                ))}
                                
                                {/* Summary Columns */}
                                <th className="px-2 py-3 border-r border-slate-200 w-[60px] text-center bg-slate-100 text-brand-700">รวม</th>
                                <th className="px-2 py-3 w-[80px] text-right bg-slate-100 text-brand-700">เป็นเงิน</th>
                                {canEdit && <th className="px-2 py-3 w-[50px] bg-slate-100 text-center">แก้ไข</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {gridRows.map((row) => (
                                <tr key={row.id} className={`hover:bg-slate-50 transition-colors group ${row.hasChanges ? 'bg-amber-50/40' : ''}`}>
                                    {/* Sticky Code */}
                                    <td className="px-2 py-1 border-r border-slate-200 sticky left-0 z-20 bg-white group-hover:bg-slate-50 text-center font-mono text-slate-500 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] text-[10px]">
                                        {row.code || '-'}
                                    </td>
                                    
                                    {/* Sticky Name */}
                                    <td className="px-3 py-1 border-r border-slate-200 sticky left-[50px] z-20 bg-white group-hover:bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        <div className="font-bold text-slate-700 truncate max-w-[180px]" title={row.name}>{row.name}</div>
                                        <div className="text-[9px] text-slate-400 truncate max-w-[180px]" title={row.budgetInfo}>{row.budgetInfo}</div>
                                    </td>
                                    
                                    <td className="px-2 py-1 border-r border-slate-200 text-right text-slate-600 bg-white group-hover:bg-slate-50">
                                        {row.price.toLocaleString()}
                                    </td>
                                    
                                    {/* Days Inputs */}
                                    {daysArray.map((day, idx) => {
                                        const qty = row.quantities[idx];
                                        return (
                                            <td key={day} className={`border-r border-slate-200 p-0 text-center relative ${qty > 0 ? 'bg-blue-50' : ''}`}>
                                                {canEdit ? (
                                                    <input 
                                                        type="text" 
                                                        className={`w-full h-8 text-center outline-none bg-transparent text-[11px] focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand-500 transition-all ${qty > 0 ? 'text-brand-600 font-bold' : 'text-slate-300'}`}
                                                        value={qty === 0 ? '' : qty}
                                                        placeholder={qty === 0 ? "." : ""}
                                                        onChange={(e) => handleQuantityChange(row.id, idx, e.target.value)}
                                                        onFocus={(e) => e.target.select()}
                                                    />
                                                ) : (
                                                    <span className={`block w-full text-[11px] py-1 ${qty > 0 ? 'text-brand-600 font-bold' : 'text-slate-200'}`}>
                                                        {qty || '-'}
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    
                                    <td className="px-2 py-1 border-r border-slate-200 text-center font-bold text-slate-700 bg-slate-50">
                                        {row.totalQty > 0 ? row.totalQty : '-'}
                                    </td>
                                    <td className="px-2 py-1 text-right font-bold text-brand-700 bg-slate-50">
                                        {row.totalPrice > 0 ? row.totalPrice.toLocaleString() : '-'}
                                    </td>
                                    
                                    {/* Edit Row Button */}
                                    {canEdit && (
                                        <td className="px-1 text-center bg-white group-hover:bg-slate-50">
                                            <div className="flex gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                {row.isStandard && (
                                                    <button 
                                                        onClick={() => { 
                                                            setIsEditingItem(row.id); 
                                                            setNewItemForm({ 
                                                                id: row.id, code: row.code, name: row.name, 
                                                                unit: row.unit, pricePerUnit: row.price, 
                                                                budgetId: row.budgetId 
                                                            }); 
                                                            setIsItemModalOpen(true); 
                                                        }} 
                                                        className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50"
                                                    >
                                                        <Edit2 size={12}/>
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleDeleteItem(row.id, row.isStandard)} 
                                                    className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                                >
                                                    <Trash2 size={12}/>
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                            
                            {/* Empty State */}
                            {gridRows.length === 0 && (
                                <tr>
                                    <td colSpan={daysArray.length + 6} className="text-center py-16 text-slate-400">
                                        <div className="flex flex-col items-center justify-center">
                                            {loading ? <Loader2 size={48} className="mb-4 animate-spin text-brand-200"/> : <Package size={48} className="mb-4 opacity-20"/>}
                                            <p className="text-base font-bold">{loading ? 'กำลังโหลดข้อมูล...' : 'ยังไม่มีรายการสินค้า'}</p>
                                            {!loading && <p className="text-xs mb-4">เริ่มต้นโดยการเพิ่มรายการสินค้าใหม่</p>}
                                            {canEdit && !loading && (
                                                <button onClick={() => setIsItemModalOpen(true)} className="px-4 py-2 bg-brand-50 text-brand-600 rounded-lg text-xs font-bold hover:bg-brand-100 transition-all">
                                                    + เพิ่มรายการแรก
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-slate-800 text-white font-bold sticky bottom-0 z-40 shadow-lg">
                            <tr>
                                <td colSpan={2} className="px-4 py-2 text-right border-r border-slate-700 sticky left-0 bg-slate-800 z-50">รวมทั้งสิ้น (Grand Total)</td>
                                <td className="px-2 py-2 text-right border-r border-slate-700 bg-slate-800"></td>
                                <td colSpan={daysArray.length} className="bg-slate-800"></td>
                                <td className="px-2 py-2 text-center border-r border-slate-700 bg-slate-800">
                                    {gridRows.reduce((sum, r) => sum + r.totalQty, 0).toLocaleString()}
                                </td>
                                <td className="px-2 py-2 text-right bg-brand-900 text-brand-100 border-r border-slate-700">
                                    {grandTotal.toLocaleString()}
                                </td>
                                {canEdit && <td></td>}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Modal for Adding/Editing Item */}
            {isItemModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up border border-slate-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                {isEditingItem ? <Edit2 size={18} className="text-brand-600"/> : <Plus size={18} className="text-brand-600"/>}
                                {isEditingItem ? 'แก้ไขรายละเอียดสินค้า' : 'เพิ่มรายการใหม่ (Master Item)'}
                            </h3>
                            <button onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-red-500"><X size={20}/></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-2 items-start text-xs text-blue-700 mb-2">
                                <Search size={16} className="shrink-0 mt-0.5"/>
                                <span>รายการนี้จะถูกบันทึกเป็น "รายการมาตรฐาน" (Standard Item) ซึ่งจะปรากฏอยู่ในตารางของทุกเดือน/ทุกปีโดยอัตโนมัติ</span>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">รหัสสินค้า (Code)</label>
                                    <input 
                                        className="w-full border rounded-xl p-2.5 text-sm text-center outline-none focus:ring-2 focus:ring-brand-500" 
                                        value={newItemForm.code || ''} 
                                        onChange={e => setNewItemForm({...newItemForm, code: e.target.value})} 
                                        placeholder="เช่น ELE-001" 
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">ชื่อสินค้า <span className="text-red-500">*</span></label>
                                    <input 
                                        className="w-full border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500" 
                                        value={newItemForm.name || ''} 
                                        onChange={e => setNewItemForm({...newItemForm, name: e.target.value})} 
                                        placeholder="ระบุชื่อรายการ..." 
                                        autoFocus 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">หน่วยนับ</label>
                                    <input 
                                        className="w-full border rounded-xl p-2.5 text-sm text-center outline-none focus:ring-2 focus:ring-brand-500" 
                                        value={newItemForm.unit || ''} 
                                        onChange={e => setNewItemForm({...newItemForm, unit: e.target.value})} 
                                        placeholder="ชิ้น/อัน/ชุด" 
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 mb-1 block">ราคาต่อหน่วย (บาท)</label>
                                    <input 
                                        type="number" 
                                        className="w-full border rounded-xl p-2.5 text-sm text-right outline-none focus:ring-2 focus:ring-brand-500 font-bold text-slate-700" 
                                        value={newItemForm.pricePerUnit || ''} 
                                        onChange={e => setNewItemForm({...newItemForm, pricePerUnit: parseFloat(e.target.value)})} 
                                        placeholder="0.00" 
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 mb-1 block">ตัดจากงบประมาณ <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <select 
                                        className="w-full border rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-white appearance-none cursor-pointer" 
                                        value={newItemForm.budgetId || ''} 
                                        onChange={e => setNewItemForm({...newItemForm, budgetId: e.target.value})}
                                    >
                                        <option value="">-- เลือกรายการงบ --</option>
                                        {budgets.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.itemCode} {b.name} ({b.category})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-3 text-slate-400 pointer-events-none"/>
                                </div>
                                {budgets.length === 0 && (
                                    <div className="flex items-center gap-2 mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                                        <AlertTriangle size={14}/>
                                        <span>ไม่พบข้อมูลงบประมาณปีนี้ (หรือยังไม่ได้สร้าง)</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="pt-4 flex gap-3 border-t border-slate-100 mt-4">
                                <button onClick={() => setIsItemModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">ยกเลิก</button>
                                <button onClick={handleSaveItemDefinition} className="flex-[2] py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 shadow-lg shadow-brand-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                                    <Save size={18}/> {isEditingItem ? 'บันทึกการแก้ไข' : 'ยืนยันเพิ่มรายการ'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepartmentCostSheet;
