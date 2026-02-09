
import React, { useState, useMemo, useRef } from 'react';
import { Technician, ShiftCode, SHIFT_DEFINITIONS, UserRole, FactoryHoliday } from '../types';
import { User, Calendar, Settings, ChevronLeft, ChevronRight, Plus, X, Check, Trash2, Download, Printer, Loader2, Wand2, Camera } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

interface TechniciansProps {
  technicians: Technician[];
  onUpdateTechnician: (tech: Technician) => void;
  onAddTechnician: (tech: Technician) => void;
  onDeleteTechnician: (id: string) => void; 
  positions: string[]; 
  categories: string[];
  userRole?: UserRole;
  holidays?: FactoryHoliday[]; 
}

const COMPACT_SHIFT_COLORS: Record<string, string> = {
  'ช': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'ท': 'bg-pink-100 text-pink-700 border-pink-200',
  'บ': 'bg-orange-100 text-orange-700 border-orange-200',
  'ด': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'V': 'bg-gray-100 text-gray-700 border-gray-200',
  'X': 'bg-red-100 text-red-700 border-red-200',
};

const MONTHS_FULL_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const Technicians: React.FC<TechniciansProps> = ({ technicians, onUpdateTechnician, onAddTechnician, onDeleteTechnician, positions, categories, userRole, holidays = [] }) => {
  const [view, setView] = useState<'LIST' | 'SCHEDULE'>('SCHEDULE');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isExporting, setIsExporting] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  
  const scroll = useDraggableScroll<HTMLDivElement>();
  const canManage = userRole !== 'TECHNICIAN';

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formState, setFormState] = useState<Partial<Technician>>({
    position: 'ช่าง',
    category: '', // Changed default to empty to force selection or show blank
    schedule: {}
  });

  const [selectingShift, setSelectingShift] = useState<{
    techId: string;
    day: number;
    currentShift?: string;
    techName: string;
    dateLabel: string;
  } | null>(null);

  const sortedTechnicians = useMemo(() => {
    return [...technicians].sort((a, b) => {
        const positionRank: Record<string, number> = { 'หัวหน้าแผนก': 1, 'แอดมิน': 2, 'ช่าง': 3 };
        const rankA = positionRank[a.position] || 99;
        const rankB = positionRank[b.position] || 99;
        if (rankA !== rankB) return rankA - rankB;
        return a.firstName.localeCompare(b.firstName, 'th');
    });
  }, [technicians]);

  const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const getDateStr = (day: number) => `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const mapShiftCode = (code: string | undefined): string | undefined => {
      if (!code) return undefined;
      if (code === 'ห') return 'X';
      if (code === 'ล') return 'V';
      return code;
  };

  const daysInMonth = getDaysInMonth(selectedMonth);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;

  const openShiftSelector = (tech: Technician, day: number) => {
    if (!canManage || scroll.isDragging) return;
    const dayKey = getDateStr(day);
    const dateObj = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
    let currentShift = mapShiftCode(tech.schedule[dayKey]);
    if (!currentShift && dateObj.getDay() === 0) currentShift = 'X';
    setSelectingShift({
        techId: tech.id,
        day: day,
        currentShift: currentShift,
        techName: `${tech.firstName} (${tech.nickName})`,
        dateLabel: dateObj.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    });
  };

  const confirmShift = (shift: string | 'CLEAR') => {
    if (!selectingShift) return;
    const { techId, day } = selectingShift;
    const tech = technicians.find(t => t.id === techId);
    if (tech) {
        const dayKey = getDateStr(day);
        const newSchedule = { ...tech.schedule };
        if (shift === 'CLEAR') delete newSchedule[dayKey];
        else {
            newSchedule[dayKey] = shift;
            if (shift === 'ด') {
                const currentDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day);
                const nextDate = new Date(currentDate);
                nextDate.setDate(currentDate.getDate() + 1);
                const nextDayKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
                newSchedule[nextDayKey] = nextDate.getDay() === 0 ? 'บ' : 'ท';
            }
        }
        onUpdateTechnician({ ...tech, schedule: newSchedule });
    }
    setSelectingShift(null);
  };

  const handleAutoFill = () => {
    if (!canManage || !window.confirm(`ยืนยันการเติมเต็มตารางงาน?`)) return;
    sortedTechnicians.forEach(tech => {
        const newSchedule = { ...tech.schedule };
        let hasChanges = false;
        for (let d = 1; d <= daysInMonth; d++) {
             const currentDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), d);
             const dayKey = getDateStr(d);
             if (!newSchedule[dayKey]) {
                 newSchedule[dayKey] = currentDate.getDay() === 0 ? 'X' : 'ช';
                 hasChanges = true;
             }
        }
        if (hasChanges) onUpdateTechnician({ ...tech, schedule: newSchedule });
    });
  };

  const handleSaveTech = () => {
    if (!formState.firstName || !formState.nickName) return;
    if (isAdding) onAddTechnician({ ...formState as Technician, id: generateId(), schedule: {} });
    else if (isEditing) {
      const tech = technicians.find(t => t.id === isEditing);
      if (tech) onUpdateTechnician({ ...tech, ...formState as Technician });
    }
    setIsAdding(false);
    setIsEditing(null);
  };

  const handleDelete = () => {
      if (isEditing && window.confirm('คุณแน่ใจหรือไม่ที่จะลบพนักงานรายนี้?')) {
          onDeleteTechnician(isEditing);
          setIsEditing(null);
      }
  };

  const handleExportImage = async () => {
      if (!tableRef.current || isExporting) return;
      setIsExporting(true);
      
      try {
          const el = tableRef.current;
          const canvas = await html2canvas(el, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false
          });
          
          const dataUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `schedule_${monthKey}.png`;
          link.href = dataUrl;
          link.click();
      } catch (err) {
          console.error(err);
          alert("เกิดข้อผิดพลาดในการบันทึกรูปภาพ");
      } finally {
          setIsExporting(false);
      }
  };

  const handleExportPDF = async () => {
      if (!tableRef.current || isExporting) return;
      setIsExporting(true);
      
      try {
          const el = tableRef.current;
          const canvas = await html2canvas(el, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              logging: false
          });
          
          const dataUrl = canvas.toDataURL('image/png');
          const pdf = new jsPDF('l', 'mm', 'a3');
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const imgProps = pdf.getImageProperties(dataUrl);
          const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
          pdf.addImage(dataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
          pdf.save(`schedule_${monthKey}.pdf`);
      } catch (err) {
          console.error(err);
          alert("เกิดข้อผิดพลาดในการสร้าง PDF");
      } finally {
          setIsExporting(false);
      }
  };

  return (
    <div className="space-y-4 animate-fade-in relative h-full flex flex-col">
      {/* Header */}
      {!isExporting && (
        <div className="flex flex-col sm:flex-row justify-between items-center bg-white px-4 py-3 rounded-xl shadow-sm border border-slate-200 z-10 shrink-0 gap-3">
            <div className="flex items-center space-x-1">
            <button onClick={() => setView('LIST')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center ${view === 'LIST' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><User size={14} className="mr-1.5" /> รายชื่อ</button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button onClick={() => setView('SCHEDULE')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center ${view === 'SCHEDULE' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}><Calendar size={14} className="mr-1.5" /> ตารางงาน</button>
            </div>
            {view === 'SCHEDULE' && (
            <div className="flex items-center space-x-2 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                <button onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() - 1)))} className="p-1 hover:bg-white rounded text-slate-500 transition-all"><ChevronLeft size={16} /></button>
                <span className="font-bold text-sm w-28 text-center text-slate-700">{selectedMonth.toLocaleDateString('th-TH', { month: 'short', year: 'numeric' })}</span>
                <button onClick={() => setSelectedMonth(new Date(selectedMonth.setMonth(selectedMonth.getMonth() + 1)))} className="p-1 hover:bg-white rounded text-slate-500 transition-all"><ChevronRight size={16} /></button>
            </div>
            )}
            <div className="flex gap-2">
                {view === 'SCHEDULE' && (
                    <>
                        {canManage && <button onClick={handleAutoFill} className="bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 shadow-sm flex items-center text-xs font-bold"><Wand2 size={14} className="mr-1"/> เติมเต็มตาราง</button>}
                        <button onClick={handleExportImage} className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 shadow-sm flex items-center text-xs font-bold"><Camera size={14} className="mr-1"/> Image</button>
                        <button onClick={handleExportPDF} disabled={isExporting} className="bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 shadow-sm flex items-center text-xs font-bold disabled:opacity-70">{isExporting ? <Loader2 size={14} className="mr-1 animate-spin"/> : <Printer size={14} className="mr-1"/>}PDF</button>
                    </>
                )}
                {view === 'LIST' && !isAdding && !isEditing && canManage && <button onClick={() => setIsAdding(true)} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 shadow-sm flex items-center text-xs font-bold"><Plus size={14} className="mr-1" /> เพิ่มพนักงาน</button>}
            </div>
        </div>
      )}

      {/* Form */}
      {(isAdding || isEditing) && (
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative max-w-4xl mx-auto w-full animate-fade-in-up">
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">{isAdding ? 'ลงทะเบียนพนักงาน' : 'แก้ไขข้อมูล'}</h3>
                <button onClick={() => { setIsAdding(false); setIsEditing(null); }} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">ชื่อ-นามสกุล</label><input className="w-full px-3 py-2 text-sm border rounded-lg outline-none" value={formState.firstName || ''} onChange={e => setFormState({...formState, firstName: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">ชื่อเล่น</label><input className="w-full px-3 py-2 text-sm border rounded-lg outline-none" value={formState.nickName || ''} onChange={e => setFormState({...formState, nickName: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">รหัสพนักงาน</label><input className="w-full px-3 py-2 text-sm border rounded-lg outline-none" value={formState.empId || ''} onChange={e => setFormState({...formState, empId: e.target.value})} /></div>
                <div><label className="text-xs font-bold text-slate-500 mb-1 block">ตำแหน่ง</label><select className="w-full px-3 py-2 text-sm border rounded-lg outline-none" value={formState.position} onChange={e => setFormState({...formState, position: e.target.value})}>{positions.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                {/* NEW: Category Field */}
                <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">หมวดงานรับผิดชอบ</label>
                    <select 
                        className="w-full px-3 py-2 text-sm border rounded-lg outline-none" 
                        value={formState.category || ''} 
                        onChange={e => setFormState({...formState, category: e.target.value})}
                    >
                        <option value="">-- ไม่ระบุ --</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 flex justify-between gap-2">
                 {isEditing ? <button onClick={handleDelete} className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">ลบพนักงาน</button> : <div></div>}
                <div className="flex gap-2">
                    <button onClick={() => { setIsAdding(false); setIsEditing(null); }} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-lg">ยกเลิก</button>
                    <button onClick={handleSaveTech} className="px-4 py-2 text-xs font-bold bg-brand-600 text-white rounded-lg hover:bg-brand-700">บันทึก</button>
                </div>
            </div>
        </div>
      )}

      {/* Main Table View */}
      {!isAdding && !isEditing && (
        <div className={`bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col ${isExporting ? 'h-auto overflow-visible min-w-fit' : 'flex-1 overflow-hidden'}`} ref={tableRef}>
            {isExporting && view === 'SCHEDULE' && (
                 <div className="bg-white p-4 text-center border-b border-slate-300 mb-2">
                     <h1 className="text-2xl font-black text-slate-900">ตารางการทำงานพนักงาน</h1>
                     <h2 className="text-lg font-bold text-slate-700">{MONTHS_FULL_TH[selectedMonth.getMonth()]} ปี {selectedMonth.getFullYear() + 543}</h2>
                 </div>
            )}
            
            {view === 'LIST' ? (
                <div className="overflow-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3">พนักงาน</th>
                                <th className="px-4 py-3">รหัส</th>
                                <th className="px-4 py-3">ตำแหน่ง</th>
                                <th className="px-4 py-3">หมวดงาน</th>
                                {canManage && <th className="px-4 py-3 text-right">จัดการ</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedTechnicians.map(tech => (
                                <tr key={tech.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 font-medium text-slate-700">{tech.firstName} ({tech.nickName})</td>
                                    <td className="px-4 py-3 text-slate-500">{tech.empId || '-'}</td>
                                    <td className="px-4 py-3">{tech.position}</td>
                                    <td className="px-4 py-3 text-slate-600">{tech.category || '-'}</td>
                                    {canManage && (
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => { setIsEditing(tech.id); setFormState(tech); }} className="text-brand-600 font-bold hover:underline">แก้ไข</button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="px-4 py-2 border-b border-slate-100 bg-slate-50 flex gap-3 overflow-x-auto shrink-0">
                        {Object.entries(SHIFT_DEFINITIONS).map(([key, def]) => (
                            <div key={key} className="flex items-center whitespace-nowrap"><span className={`w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center mr-1 ${COMPACT_SHIFT_COLORS[key] || 'bg-slate-200'}`}>{key}</span><span className="text-[10px] text-slate-600">{def.label}</span></div>
                        ))}
                    </div>
                    <div className="flex-1 overflow-auto select-none" ref={scroll.ref} {...scroll.events} style={scroll.style}>
                        <table className="border-collapse w-full">
                            <thead className="bg-white shadow-sm sticky top-0 z-20">
                                <tr>
                                    <th className="bg-white border-r border-b border-slate-200 p-2 min-w-[180px] text-left text-xs font-bold text-slate-700 sticky left-0 z-30">พนักงาน</th>
                                    {daysArray.map(day => (
                                        <th key={day} className={`border-r border-b border-slate-200 py-2 px-1 min-w-[35px] text-center ${new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day).getDay() === 0 ? 'bg-rose-50 text-rose-600' : 'bg-white'}`}>
                                            <div className="text-[9px] opacity-70">{new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day).toLocaleDateString('th-TH', { weekday: 'short' })}</div>
                                            <div className="text-xs font-bold">{day}</div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-xs">
                                {sortedTechnicians.map(tech => (
                                    <tr key={tech.id} className="hover:bg-slate-50">
                                        <td className="bg-white border-r border-b border-slate-200 p-2 font-bold sticky left-0 z-10">{tech.firstName} ({tech.nickName})</td>
                                        {daysArray.map(day => {
                                            const dayKey = getDateStr(day);
                                            const shift = mapShiftCode(tech.schedule[dayKey]) || (new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day).getDay() === 0 ? 'X' : '');
                                            return (
                                                <td key={day} onClick={() => openShiftSelector(tech, day)} className={`border-r border-b border-slate-200 p-0 text-center h-10 min-w-[35px] ${canManage ? 'cursor-pointer hover:bg-slate-100' : ''}`}>
                                                    {shift && <div className={`w-full h-full flex items-center justify-center font-bold text-[10px] ${COMPACT_SHIFT_COLORS[shift] || ''}`}>{shift}</div>}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      )}

      {selectingShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl p-5 w-72 border border-slate-100">
                  <div className="text-center mb-4"><h4 className="text-sm font-bold text-slate-800">เลือกกะการทำงาน</h4><p className="text-xs text-slate-500 mt-1">{selectingShift.techName} • {selectingShift.dateLabel}</p></div>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                      {Object.entries(SHIFT_DEFINITIONS).map(([code, def]) => (
                          <button key={code} onClick={() => confirmShift(code)} className={`flex items-center p-2 rounded-lg border transition-all ${selectingShift.currentShift === code ? 'bg-slate-800 text-white border-slate-800 shadow-md ring-2 ring-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
                              <span className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs mr-2 ${selectingShift.currentShift === code ? 'bg-white/20 text-white' : COMPACT_SHIFT_COLORS[code]}`}>{code}</span>
                              <div className="text-left"><div className="text-xs font-bold">{def.label}</div><div className="text-[9px] opacity-70">{def.time}</div></div>
                          </button>
                      ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                      <button onClick={() => confirmShift('CLEAR')} className="flex-1 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">ล้างค่า</button>
                      <button onClick={() => setSelectingShift(null)} className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">ปิด</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Technicians;
