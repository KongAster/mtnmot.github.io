
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Job, JobStatus, RepairGroup, Technician, CostItem, formatDate, PMPlan, JOB_STATUS_DISPLAY } from '../types';
import { Plus, Trash2, Save, Calculator, FileText, Wrench, Loader2, Edit2, X, Check, Search, Hash, Clock, CheckCircle, LayoutList, Star, ChevronDown } from 'lucide-react';
import { dataService } from '../services/dataService'; 

interface JobFormProps {
  onSave: (job: Job) => void;
  onCancel: () => void;
  technicians: Technician[];
  initialData?: Job;
  existingJobs: Job[];
  departments: string[]; 
  expenseCategories?: string[]; 
  companies?: string[]; 
  jobTypes: string[];
  readOnly?: boolean;
  repairGroups: string[];
  pmPlans?: PMPlan[];
}

// Helper to generate UUID
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const StarRatingInput = ({ label, value, onChange, disabled }: { label: string, value: number, onChange: (val: number) => void, disabled: boolean }) => (
    <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-200">
        <label className="text-xs font-bold text-slate-500">{label}</label>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                      key={star} 
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(star)}
                      className={`transition-all active:scale-95 focus:outline-none ${star <= value ? 'text-yellow-400 drop-shadow-sm' : 'text-slate-200'} ${disabled ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
                  >
                      <Star size={24} fill={star <= value ? "currentColor" : "none"} />
                  </button>
              ))}
          </div>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
              value >= 4 ? 'bg-green-100 text-green-700' : 
              value === 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
          }`}>
              {value === 5 ? 'ดีมาก' : value === 4 ? 'ดี' : value === 3 ? 'ปานกลาง' : 'ปรับปรุง'}
          </span>
        </div>
    </div>
  );

const JobForm: React.FC<JobFormProps> = ({ 
    onSave, 
    onCancel, 
    technicians, 
    initialData, 
    existingJobs, 
    departments, 
    expenseCategories = [], 
    companies = [], 
    jobTypes, 
    readOnly = false,
    repairGroups = [],
    pmPlans = []
}) => {
  const [formData, setFormData] = useState<Partial<Job>>({
    dateReceived: new Date().toISOString().split('T')[0],
    jobType: jobTypes[0] || 'ไฟฟ้า', 
    status: JobStatus.IN_PROGRESS,
    technicianIds: [],
    costs: [],
    attachments: [],
    repairGroup: repairGroups[0] || RepairGroup.INTERNAL,
    ...initialData
  });

  const [isPmJob, setIsPmJob] = useState(!!initialData?.pmPlanId);

  const [costInput, setCostInput] = useState<Partial<CostItem>>({
    name: '', 
    quantity: 1, 
    pricePerUnit: 0, 
    category: expenseCategories[0] || '',
    company: companies[0] || '', 
    date: initialData?.dateReceived || new Date().toISOString().split('T')[0]
  });

  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [techSearch, setTechSearch] = useState('');
  const [isLoadingId, setIsLoadingId] = useState(false);

  useEffect(() => {
      if (!initialData && formData.dateReceived) {
          setCostInput(prev => ({...prev, date: formData.dateReceived}));
      }
  }, [formData.dateReceived, initialData]);

  const handleJobSourceChange = (type: 'GENERAL' | 'PM') => {
      if (readOnly) return;
      if (type === 'PM') {
          setIsPmJob(true);
      } else {
          setIsPmJob(false);
          setFormData(prev => ({ ...prev, pmPlanId: undefined }));
      }
  };

  const availablePMPlans = useMemo(() => {
      if (!formData.department) return pmPlans;
      return pmPlans.filter(p => p.department === formData.department);
  }, [pmPlans, formData.department]);

  useEffect(() => {
      if (initialData?.id || readOnly) return;
      const fetchNextId = async () => {
          if (!formData.jobType || !formData.dateReceived) return;
          setIsLoadingId(true);
          try {
              await new Promise(r => setTimeout(r, 500)); 
              const nextId = await dataService.generateNextJobId(formData.jobType, formData.dateReceived);
              setFormData(prev => ({ ...prev, jobRunningId: nextId }));
          } catch (error) {
              console.error("Failed to generate preview ID", error);
          } finally {
              setIsLoadingId(false);
          }
      };
      fetchNextId();
  }, [formData.jobType, formData.dateReceived, initialData, readOnly]);

  const calculateDueDate = useCallback((dateReceived: string, group?: string) => {
    if (!dateReceived || !group) return '';
    const date = new Date(dateReceived);
    let daysToAdd = 0;
    switch (group) {
      case 'ซ่อมภายใน': daysToAdd = 3; break;
      case 'ซื้ออุปกรณ์': daysToAdd = 15; break;
      case 'งานโครงการคุณภาพ': daysToAdd = 20; break;
      case 'ส่งซ่อมภายนอก': daysToAdd = 30; break;
      default: return ''; 
    }
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
  }, []);

  // --- AUTOMATION LOGIC START ---
  useEffect(() => {
    if (readOnly) return; 

    // Logic: Status changes based on Repair Group
    if (formData.repairGroup === 'ยกเลิกงานซ่อม' || formData.repairGroup === 'ยกเลิก') {
        setFormData(prev => ({ ...prev, status: JobStatus.CANCELLED }));
    } else if (formData.repairGroup === 'ซ่อมไม่ได้') {
        setFormData(prev => ({ ...prev, status: JobStatus.UNREPAIRABLE }));
    } else {
        // If repair group is normal, check if we have a finished date
        // If we have a finished date, prioritize FINISHED status
        if (formData.finishedDate) {
             setFormData(prev => {
                 if (prev.status !== JobStatus.FINISHED) return { ...prev, status: JobStatus.FINISHED };
                 return prev;
             });
        } else {
             // If no finished date and group is normal, ensure we are not in Cancelled state (unless manually set)
             // Generally revert to IN_PROGRESS if we moved away from a Cancelled Group
             setFormData(prev => {
                 if (prev.status === JobStatus.CANCELLED || prev.status === JobStatus.UNREPAIRABLE) {
                     return { ...prev, status: JobStatus.IN_PROGRESS };
                 }
                 return prev;
             });
        }
    }
  }, [formData.repairGroup, readOnly]);
  // --- AUTOMATION LOGIC END ---

  useEffect(() => {
    if (readOnly) return; 
    if (formData.dateReceived && formData.repairGroup) {
      const due = calculateDueDate(formData.dateReceived, formData.repairGroup);
      if (due !== formData.dueDate) {
        setFormData(prev => ({ ...prev, dueDate: due }));
      }
    }
  }, [formData.dateReceived, formData.repairGroup, calculateDueDate, formData.dueDate, readOnly]);

  useEffect(() => {
      if (readOnly) return;
      if (formData.repairGroup === 'ส่งซ่อมภายนอก') {
          if (!formData.repairOrderNumber && formData.dateReceived) {
              const date = new Date(formData.dateReceived);
              const year = date.getFullYear();
              const month = date.getMonth();
              const count = existingJobs.filter(j => {
                  const jDate = new Date(j.dateReceived);
                  return j.repairGroup === 'ส่งซ่อมภายนอก' &&
                         jDate.getFullYear() === year &&
                         jDate.getMonth() === month &&
                         j.id !== formData.id; 
              }).length + 1;
              const thYearShort = String((year + 543) % 100).padStart(2, '0');
              const monthStr = String(month + 1).padStart(2, '0');
              const seqStr = String(count).padStart(2, '0');
              const generatedId = `${thYearShort}${monthStr}${seqStr}`;
              setFormData(prev => ({...prev, repairOrderNumber: generatedId}));
          }
      } else {
          if (formData.repairOrderNumber) {
              setFormData(prev => ({...prev, repairOrderNumber: undefined}));
          }
      }
  }, [formData.repairGroup, formData.dateReceived, readOnly, existingJobs, formData.repairOrderNumber, formData.id]);

  const handleCostAdd = () => {
    if (readOnly) return;
    if (!costInput.name || !costInput.quantity || costInput.quantity <= 0) return;

    if (editingCostId) {
        setFormData(prev => ({
            ...prev,
            costs: prev.costs?.map(c => c.id === editingCostId ? {
                ...c,
                name: costInput.name!,
                category: costInput.category || 'ไม่ระบุ',
                company: costInput.company || '',
                quantity: costInput.quantity!,
                pricePerUnit: costInput.pricePerUnit || 0,
                totalPrice: (costInput.quantity!) * (costInput.pricePerUnit || 0),
                code: costInput.code,
                prNumber: costInput.prNumber,
                date: costInput.date || formData.dateReceived
            } : c)
        }));
        setEditingCostId(null);
    } else {
        const newItem: CostItem = {
            id: generateId(),
            name: costInput.name!,
            category: costInput.category || 'ไม่ระบุ',
            company: costInput.company || '', 
            quantity: costInput.quantity!,
            pricePerUnit: costInput.pricePerUnit || 0,
            totalPrice: (costInput.quantity!) * (costInput.pricePerUnit || 0),
            code: costInput.code,
            prNumber: costInput.prNumber,
            date: costInput.date || formData.dateReceived 
        };
        setFormData(prev => ({ ...prev, costs: [...(prev.costs || []), newItem] }));
    }
    setCostInput(prev => ({ 
        name: '', quantity: 1, pricePerUnit: 0, code: '', prNumber: '', category: prev.category, company: prev.company, date: prev.date
    }));
  };

  const startEditCost = (item: CostItem) => {
      setCostInput({
          name: item.name, quantity: item.quantity, pricePerUnit: item.pricePerUnit, category: item.category, company: item.company, code: item.code, prNumber: item.prNumber, date: item.date
      });
      setEditingCostId(item.id);
  };

  const cancelEditCost = () => {
      setEditingCostId(null);
      setCostInput(prev => ({ name: '', quantity: 1, pricePerUnit: 0, code: '', prNumber: '', category: prev.category, company: prev.company, date: prev.date }));
  };

  const handleCostRemove = (id: string) => {
    if (readOnly) return;
    if (editingCostId === id) cancelEditCost();
    setFormData(prev => ({ ...prev, costs: prev.costs?.filter(c => c.id !== id) }));
  };

  const handleSubmit = async (e: React.FormEvent, targetStatus?: JobStatus) => {
    e.preventDefault();
    if (readOnly || isSaving) return;

    if (!formData.jobType || !formData.department || !formData.dateReceived) {
        alert("กรุณากรอกข้อมูลสำคัญให้ครบถ้วน");
        return;
    }
    if (isPmJob && !formData.pmPlanId) {
        alert("กรุณาเลือกแผน PM ที่ต้องการลิ้งค์");
        return;
    }

    setIsSaving(true);
    let finalStatus = formData.status;
    if (targetStatus) finalStatus = targetStatus;

    let finalFinishedDate = formData.finishedDate;
    if (finalStatus === JobStatus.FINISHED && !finalFinishedDate) {
        finalFinishedDate = new Date().toISOString().split('T')[0];
    }

    let finalEvaluation = formData.evaluation;
    if (finalStatus === JobStatus.FINISHED && !finalEvaluation) {
        finalEvaluation = { speed: 5, quality: 5 };
    }

    let savedSuccessfully = false;
    let attempt = 0;
    const MAX_RETRIES = 3;

    try {
        while (attempt < MAX_RETRIES && !savedSuccessfully) {
            try {
                let finalJobId = formData.jobRunningId;
                if (!formData.id && (!finalJobId || attempt > 0)) {
                    if (attempt > 0) await new Promise(r => setTimeout(r, 300 + Math.random() * 700));
                    finalJobId = await dataService.generateNextJobId(formData.jobType!, formData.dateReceived!);
                }

                const jobToSave: Job = {
                    ...formData as Job,
                    id: formData.id || generateId(),
                    jobRunningId: finalJobId!,
                    status: finalStatus as JobStatus,
                    finishedDate: finalFinishedDate,
                    evaluation: finalEvaluation,
                    lastUpdated: new Date().toISOString(),
                    pmPlanId: isPmJob ? formData.pmPlanId : undefined
                };

                await onSave(jobToSave); 
                savedSuccessfully = true;
            } catch (innerError: any) {
                const isDuplicate = innerError?.code === '23505' || innerError?.message?.includes('duplicate key');
                if (isDuplicate && !formData.id) {
                    attempt++;
                    if (attempt >= MAX_RETRIES) throw new Error(`ระบบไม่สามารถสร้างเลขที่ใบแจ้งซ่อมได้เนื่องจากมีการใช้งานหนาแน่น`);
                } else {
                    throw innerError;
                }
            }
        }
    } catch (err: any) {
        console.error("Final Save Error:", err);
        alert(`เกิดข้อผิดพลาดในการบันทึกข้อมูล: ${err.message || "ไม่ทราบสาเหตุ"}`);
        setIsSaving(false); 
    }
  };

  const totalCost = formData.costs?.reduce((sum, item) => sum + item.totalPrice, 0) || 0;

  const filteredTechnicians = useMemo(() => {
      return technicians
        .filter(tech => {
            if (tech.position !== 'ช่าง') return false;
            const searchLower = techSearch.toLowerCase();
            return (
                tech.firstName.toLowerCase().includes(searchLower) ||
                tech.nickName.toLowerCase().includes(searchLower) ||
                tech.category?.toLowerCase().includes(searchLower)
            );
        })
        .sort((a, b) => {
            const catA = a.category || 'อื่นๆ';
            const catB = b.category || 'อื่นๆ';
            if (catA !== catB) return catA.localeCompare(catB, 'th');
            return a.firstName.localeCompare(b.firstName, 'th');
        });
  }, [technicians, techSearch]);

  const sortedDepartments = useMemo(() => [...departments].sort((a,b) => a.localeCompare(b, 'th')), [departments]);
  const sortedJobTypes = useMemo(() => [...jobTypes].sort((a,b) => a.localeCompare(b, 'th')), [jobTypes]);
  const sortedRepairGroups = useMemo(() => [...repairGroups].sort((a,b) => a.localeCompare(b, 'th')), [repairGroups]);

  const SectionHeader = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
      <div className="flex items-center space-x-2 mb-6 pb-3 border-b border-slate-100">
          <div className="text-brand-600 bg-brand-50 p-2 rounded-lg">{icon}</div>
          <h3 className="font-bold text-slate-800 text-xl">{title}</h3>
      </div>
  );

  return (
    <form onSubmit={e => handleSubmit(e)} className="bg-slate-50 w-full flex flex-col h-full max-h-full rounded-2xl shadow-2xl overflow-hidden relative">
      <div className="shrink-0 bg-white p-5 border-b border-slate-200 z-20">
          <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0 mr-4">
                  <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                          {initialData ? <Edit2 size={24} className="text-brand-600"/> : <Plus size={24} className="text-brand-600"/>}
                          {initialData ? 'แก้ไขใบแจ้งซ่อม' : 'สร้างใบแจ้งซ่อมใหม่'}
                      </h2>
                  </div>
                  <p className="text-sm text-slate-500">กรอกข้อมูลรายละเอียดงานซ่อมให้ครบถ้วน</p>
              </div>
              <button type="button" onClick={onCancel} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-all border border-transparent hover:border-slate-200" title="ปิดหน้าต่าง"><X size={24} /></button>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-4">
              <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase"><Hash size={12}/> JOB ID</span>
                  {isLoadingId ? <span className="flex items-center gap-2 text-sm font-bold text-slate-400"><Loader2 size={14} className="animate-spin"/> ...</span> : <span className="text-base font-mono font-black text-brand-600 tracking-wider">{formData.jobRunningId || '---'}</span>}
              </div>
              {!readOnly ? (
                  <div className="relative group">
                      <select 
                          value={formData.status}
                          onChange={(e) => setFormData({...formData, status: e.target.value as JobStatus})}
                          className={`appearance-none pl-8 pr-8 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer
                              ${formData.status === JobStatus.FINISHED ? 'bg-green-100 text-green-700 border-green-200' :
                                formData.status === JobStatus.CANCELLED ? 'bg-red-100 text-red-700 border-red-200' :
                                formData.status === JobStatus.WAITING_INSPECTION ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                formData.status === JobStatus.UNREPAIRABLE ? 'bg-slate-200 text-slate-600 border-slate-300' :
                                'bg-amber-100 text-amber-700 border-amber-200'}
                          `}
                      >
                          <option value={JobStatus.IN_PROGRESS}>กำลังดำเนินการ</option>
                          <option value={JobStatus.WAITING_INSPECTION}>รอตรวจรับ</option>
                          <option value={JobStatus.FINISHED}>ปิดงานแล้ว</option>
                          <option value={JobStatus.CANCELLED}>ยกเลิก</option>
                          <option value={JobStatus.UNREPAIRABLE}>ซ่อมไม่ได้</option>
                      </select>
                      <div className="absolute left-2.5 top-1.5 pointer-events-none">
                          {formData.status === JobStatus.FINISHED ? <CheckCircle size={14} className="text-green-700"/> : <Clock size={14} className="text-amber-700"/>}
                      </div>
                      <div className="absolute right-2 top-2 pointer-events-none text-slate-500"><ChevronDown size={12}/></div>
                  </div>
              ) : (
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${formData.status === JobStatus.FINISHED ? 'bg-green-100 text-green-700 border-green-200' : formData.status === JobStatus.CANCELLED ? 'bg-red-100 text-red-700 border-red-200' : formData.status === JobStatus.WAITING_INSPECTION ? 'bg-blue-100 text-blue-700 border-blue-200' : formData.status === JobStatus.UNREPAIRABLE ? 'bg-slate-200 text-slate-600 border-slate-300' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                      {formData.status === JobStatus.FINISHED ? <CheckCircle size={14}/> : <Clock size={14}/>}
                      {JOB_STATUS_DISPLAY[formData.status || ''] || formData.status}
                  </div>
              )}
              {isPmJob && <span className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-orange-100 text-orange-700 border-orange-200 flex items-center gap-1.5"><Clock size={14}/> PM Job</span>}
          </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-50">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <SectionHeader icon={<FileText size={20}/>} title="ข้อมูลทั่วไป" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">วันที่แจ้งซ่อม <span className="text-red-500">*</span></label>
                <input type="date" required disabled={readOnly} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none" value={formData.dateReceived} onChange={e => setFormData({...formData, dateReceived: e.target.value})}/>
                </div>
                <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">หมวดงาน <span className="text-red-500">*</span></label>
                <div className="relative">
                    <select value={formData.jobType} disabled={readOnly} onChange={(e) => setFormData({...formData, jobType: e.target.value})} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none appearance-none">
                        {sortedJobTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-slate-400"><ChevronDown size={16} /></div>
                </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">แผนกที่แจ้ง <span className="text-red-500">*</span></label>
                    <select className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none" value={formData.department} disabled={readOnly} onChange={e => setFormData({...formData, department: e.target.value})} required>
                        <option value="">-- เลือกแผนก --</option>
                        {sortedDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">รหัสทรัพย์สิน (ถ้ามี)</label>
                    <input type="text" disabled={readOnly} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none" value={formData.assetId || ''} onChange={e => setFormData({...formData, assetId: e.target.value})} placeholder="เช่น MC-001"/>
                </div>
            </div>
            {formData.repairGroup === 'ส่งซ่อมภายนอก' && (
                <div className="animate-fade-in mb-4">
                    <label className="block text-sm font-bold text-slate-700 mb-1">เลขที่ใบส่งซ่อมภายนอก</label>
                    <input type="text" disabled={readOnly} className="w-full px-3 py-2.5 bg-amber-50 border border-amber-200 text-amber-900 font-bold rounded-xl focus:ring-2 focus:ring-amber-500 outline-none placeholder-amber-300" value={formData.repairOrderNumber || ''} onChange={e => setFormData({...formData,repairOrderNumber: e.target.value})} placeholder="Auto Generated"/>
                </div>
            )}
            <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">รายการแจ้งซ่อม / ชื่อเครื่องจักร <span className="text-red-500">*</span></label>
                <textarea required disabled={readOnly} rows={2} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none resize-none" value={formData.itemDescription || ''} onChange={e => setFormData({...formData, itemDescription: e.target.value})} placeholder="ระบุชื่อเครื่องจักร หรือสิ่งที่ต้องการซ่อม"/>
            </div>
            <div className="mb-4">
                <label className="block text-sm font-bold text-slate-700 mb-1">อาการเสีย / สาเหตุ</label>
                <textarea rows={3} disabled={readOnly} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none resize-none" value={formData.damageDescription || ''} onChange={e => setFormData({...formData, damageDescription: e.target.value})} placeholder="รายละเอียดอาการเสีย"/>
            </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <SectionHeader icon={<Wrench size={20}/>} title="การดำเนินการ" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 mb-2">
                        <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wide">ที่มาของงาน (Source)</label>
                        <div className="flex gap-2">
                            <button type="button" disabled={readOnly} onClick={() => handleJobSourceChange('GENERAL')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${!isPmJob ? 'bg-white text-brand-600 shadow-sm ring-1 ring-brand-200' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}><LayoutList size={16}/> งานทั่วไป</button>
                            <button type="button" disabled={readOnly} onClick={() => handleJobSourceChange('PM')} className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${isPmJob ? 'bg-orange-50 text-orange-700 shadow-sm ring-1 ring-orange-200' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}><Clock size={16}/> งาน PM</button>
                        </div>
                    </div>
                    {isPmJob && (
                        <div className="animate-fade-in mb-2">
                            <label className="block text-sm font-bold text-orange-700 mb-1 flex items-center gap-2"><Clock size={14}/> เลือกแผน PM ที่เกี่ยวข้อง <span className="text-red-500">*</span></label>
                            <select value={formData.pmPlanId || ''} disabled={readOnly} onChange={(e) => { const planId = e.target.value; setFormData(prev => ({...prev, pmPlanId: planId})); const plan = pmPlans.find(p => p.id === planId); if (plan) { setFormData(prev => ({ ...prev, pmPlanId: planId, itemDescription: plan.name, assetId: plan.assetId || prev.assetId, department: plan.department, jobType: plan.type || prev.jobType })); }}} className="w-full px-3 py-2.5 bg-orange-50 border border-orange-200 text-orange-900 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none">
                                <option value="">-- เลือกแผน PM --</option>
                                {availablePMPlans.map(plan => (<option key={plan.id} value={plan.id}>{plan.name} ({plan.assetId || '-'})</option>))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">กลุ่มงานซ่อม</label>
                        <select className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none" value={formData.repairGroup} disabled={readOnly} onChange={e => setFormData({...formData, repairGroup: e.target.value})}>
                            {sortedRepairGroups.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">วันกำหนดเสร็จ (Est.)</label>
                            <input type="date" disabled={true} className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed text-sm" value={formData.dueDate || ''}/>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">วันที่แล้วเสร็จ (Actual)</label>
                            <div className="relative">
                                <input 
                                    type="date" disabled={readOnly} 
                                    className={`w-full px-3 py-2.5 border rounded-xl text-sm outline-none focus:ring-2 pr-8 ${formData.finishedDate ? 'bg-green-50 border-green-200 text-green-700 font-bold focus:ring-green-500' : 'bg-white border-slate-200 focus:ring-brand-500'}`} 
                                    value={formData.finishedDate || ''} 
                                    onChange={(e) => {
                                        const dateVal = e.target.value;
                                        setFormData(prev => {
                                            // Auto-Finish Logic
                                            let newStatus = prev.status;
                                            if (dateVal) {
                                                newStatus = JobStatus.FINISHED;
                                            } else {
                                                // Revert logic when date cleared
                                                if (prev.repairGroup === 'ยกเลิกงานซ่อม' || prev.repairGroup === 'ยกเลิก') newStatus = JobStatus.CANCELLED;
                                                else if (prev.repairGroup === 'ซ่อมไม่ได้') newStatus = JobStatus.UNREPAIRABLE;
                                                else newStatus = JobStatus.IN_PROGRESS;
                                            }
                                            return { ...prev, finishedDate: dateVal, status: newStatus };
                                        });
                                    }}
                                />
                                {formData.finishedDate && !readOnly && (
                                    <button type="button" onClick={() => setFormData(prev => {
                                        // Revert logic when clear button clicked
                                        let newStatus = JobStatus.IN_PROGRESS;
                                        if (prev.repairGroup === 'ยกเลิกงานซ่อม' || prev.repairGroup === 'ยกเลิก') newStatus = JobStatus.CANCELLED;
                                        else if (prev.repairGroup === 'ซ่อมไม่ได้') newStatus = JobStatus.UNREPAIRABLE;
                                        return { ...prev, finishedDate: '', status: newStatus };
                                    })} className="absolute right-2 top-3 text-slate-400 hover:text-red-500" title="เคลียร์วันที่"><X size={16} /></button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">หมายเหตุช่าง / การซ่อม</label>
                        <textarea rows={3} disabled={readOnly} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all outline-none resize-none" value={formData.assessment || ''} onChange={e => setFormData({...formData, assessment: e.target.value})} placeholder="ระบุรายละเอียดผลการซ่อม หรือหมายเหตุเพิ่มเติม"/>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex flex-col h-full max-h-[300px]">
                        <label className="block text-sm font-bold text-slate-700 mb-2">ช่างผู้รับผิดชอบ ({formData.technicianIds?.length || 0})</label>
                        {!readOnly && (
                            <div className="relative mb-2 shrink-0">
                                <input type="text" placeholder="ค้นหาชื่อช่าง..." className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" value={techSearch} onChange={(e) => setTechSearch(e.target.value)}/>
                                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 p-2 space-y-1 custom-scrollbar">
                            {filteredTechnicians.map(tech => (
                                <label key={tech.id} className="flex items-center p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all cursor-pointer border border-transparent hover:border-slate-100">
                                    <input type="checkbox" disabled={readOnly} className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300" checked={formData.technicianIds?.includes(tech.id)} onChange={(e) => { const newIds = e.target.checked ? [...(formData.technicianIds || []), tech.id] : (formData.technicianIds || []).filter(id => id !== tech.id); setFormData({...formData, technicianIds: newIds}); }}/>
                                    <div className="ml-3 flex flex-col"><span className="text-sm text-slate-700 font-medium">{tech.firstName} ({tech.nickName})</span><span className="text-[10px] text-slate-400">{tech.category}</span></div>
                                </label>
                            ))}
                            {filteredTechnicians.length === 0 && <div className="text-center text-slate-400 text-xs py-2">ไม่พบรายชื่อช่าง</div>}
                        </div>
                    </div>
                </div>
            </div>
            {formData.status === JobStatus.FINISHED && (
                <div className="mt-6 pt-6 border-t border-slate-100 animate-fade-in">
                    <div className="flex items-center space-x-2 mb-4"><Check size={18} className="text-brand-600"/><h4 className="font-bold text-slate-800 text-sm">ประเมินผลงาน (Evaluation)</h4></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-brand-50/50 p-4 rounded-xl border border-brand-100">
                        <StarRatingInput label="ความรวดเร็ว (Speed)" value={formData.evaluation?.speed || 5} onChange={(val) => setFormData(prev => ({ ...prev, evaluation: { speed: val, quality: prev.evaluation?.quality || 5 } }))} disabled={readOnly}/>
                        <StarRatingInput label="คุณภาพงาน (Quality)" value={formData.evaluation?.quality || 5} onChange={(val) => setFormData(prev => ({ ...prev, evaluation: { quality: val, speed: prev.evaluation?.speed || 5 } }))} disabled={readOnly}/>
                    </div>
                </div>
            )}
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <SectionHeader icon={<Calculator size={20}/>} title="บันทึกค่าใช้จ่าย" />
            {!readOnly && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">วันที่ซื้อ/เบิก</label><input type="date" className="w-full p-2 rounded-lg border text-sm" value={costInput.date || ''} onChange={e=>setCostInput({...costInput, date: e.target.value})} /></div>
                    <div className="md:col-span-3"><label className="text-xs font-bold text-slate-500 mb-1 block">รายการ</label><input type="text" placeholder="ชื่อรายการ" className="w-full p-2 rounded-lg border text-sm" value={costInput.name} onChange={e=>setCostInput({...costInput, name: e.target.value})} /></div>
                    <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">หมวดค่าใช้จ่าย</label><select className="w-full p-2 rounded-lg border text-sm" value={costInput.category} onChange={e=>setCostInput({...costInput, category: e.target.value})}>{expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="md:col-span-2"><label className="text-xs font-bold text-slate-500 mb-1 block">บริษัท</label><select className="w-full p-2 rounded-lg border text-sm" value={costInput.company} onChange={e=>setCostInput({...costInput, company: e.target.value})}><option value="">ไม่ระบุ</option>{companies.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                    <div className="md:col-span-1"><label className="text-xs font-bold text-slate-500 mb-1 block">จำนวน</label><input type="number" min="1" className="w-full p-2 rounded-lg border text-sm" value={costInput.quantity} onChange={e=>setCostInput({...costInput, quantity: parseFloat(e.target.value)})} /></div>
                    <div className="md:col-span-1"><label className="text-xs font-bold text-slate-500 mb-1 block">ราคา/หน่วย</label><input type="number" min="0" className="w-full p-2 rounded-lg border text-sm" value={costInput.pricePerUnit} onChange={e=>setCostInput({...costInput, pricePerUnit: parseFloat(e.target.value)})} /></div>
                    <div className="md:col-span-1 flex gap-1">{editingCostId ? (<><button type="button" onClick={handleCostAdd} className="bg-brand-600 text-white p-2 rounded-lg w-full flex justify-center"><Check size={18}/></button><button type="button" onClick={cancelEditCost} className="bg-slate-200 text-slate-600 p-2 rounded-lg w-full flex justify-center"><X size={18}/></button></>) : (<button type="button" onClick={handleCostAdd} className="bg-brand-600 text-white p-2 rounded-lg w-full flex justify-center hover:bg-brand-700 transition-colors"><Plus size={18}/></button>)}</div>
                </div>
            )}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-sm text-left table-fixed">
                    <thead className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200">
                        <tr><th className="px-4 py-3 w-[10%] min-w-[100px]">วันที่</th><th className="px-4 py-3 w-[25%] min-w-[150px]">รายการ</th><th className="px-4 py-3 w-[15%] min-w-[120px]">หมวด</th><th className="px-4 py-3 w-[12%] min-w-[100px]">บริษัท</th><th className="px-4 py-3 text-right w-[10%] min-w-[80px]">จำนวน</th><th className="px-4 py-3 text-right w-[12%] min-w-[100px]">ราคา/หน่วย</th><th className="px-4 py-3 text-right w-[12%] min-w-[100px]">รวม</th>{!readOnly && <th className="px-4 py-3 text-center w-[50px]"></th>}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {formData.costs?.map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-slate-500 text-xs truncate">{formatDate(item.date)}</td>
                                <td className="px-4 py-3 font-medium text-slate-700 truncate" title={item.name}>{item.name}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs truncate" title={item.category}>{item.category}</td>
                                <td className="px-4 py-3 text-slate-500 text-xs truncate" title={item.company}>{item.company || '-'}</td>
                                <td className="px-4 py-3 text-right">{item.quantity}</td>
                                <td className="px-4 py-3 text-right">{item.pricePerUnit.toLocaleString()}</td>
                                <td className="px-4 py-3 text-right font-bold text-brand-600">{item.totalPrice.toLocaleString()}</td>
                                {!readOnly && (<td className="px-4 py-3 text-center"><div className="flex justify-center gap-1"><button type="button" onClick={() => startEditCost(item)} className="text-slate-400 hover:text-brand-600"><Edit2 size={16}/></button><button type="button" onClick={() => handleCostRemove(item.id)} className="text-slate-400 hover:text-red-600"><Trash2 size={16}/></button></div></td>)}
                            </tr>
                        ))}
                        {(!formData.costs || formData.costs.length === 0) && (<tr><td colSpan={8} className="text-center py-6 text-slate-400">ไม่มีรายการค่าใช้จ่าย</td></tr>)}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-800">
                        <tr><td colSpan={6} className="px-4 py-3 text-right">รวมเป็นเงินทั้งสิ้น</td><td className="px-4 py-3 text-right text-lg text-brand-700">{totalCost.toLocaleString()} บาท</td>{!readOnly && <td></td>}</tr>
                    </tfoot>
                </table>
            </div>
        </div>
      </div>

      <div className="shrink-0 p-4 border-t border-slate-200 bg-white flex justify-end gap-3 z-20">
          <button type="button" onClick={onCancel} disabled={isSaving} className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition-colors disabled:opacity-50">ยกเลิก</button>
          {!readOnly && (<button type="submit" disabled={isSaving} className="px-8 py-2.5 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed flex items-center">{isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>}{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}</button>)}
      </div>
    </form>
  );
};

export default JobForm;
