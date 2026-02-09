
import React, { useState, useEffect, useMemo } from 'react';
import { Job, JobStatus, formatDate, Technician } from '../types';
import { dataService } from '../services/dataService';
import { CheckCircle, XCircle, Star, AlertCircle, User, Wrench, Check, Building2, Search, ChevronRight, Filter, ChevronLeft, Clock, FileText, Activity, LayoutList, DollarSign, RotateCcw, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PublicWorkAcceptanceProps {
  jobId: string | null;
}

const PublicWorkAcceptance: React.FC<PublicWorkAcceptanceProps> = ({ jobId }) => {
  const [allJobs, setAllJobs] = useState<Job[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentJobId, setCurrentJobId] = useState<string | null>(jobId);
  const [view, setView] = useState<'LIST' | 'DETAIL'>(jobId ? 'DETAIL' : 'LIST');
  const [activeTab, setActiveTab] = useState<'ACTION' | 'TRACK'>('ACTION');

  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [rating, setRating] = useState({ speed: 5, quality: 5 });
  const [suggestion, setSuggestion] = useState('');
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const initData = async () => {
        try {
            const [jobsData, settingsData, techsData] = await Promise.all([
                dataService.getJobs(),
                dataService.getSettings(),
                dataService.getTechnicians()
            ]);
            setAllJobs(jobsData);
            setDepartments(settingsData.departments || []);
            setTechnicians(techsData);
            
            if (jobId) {
                const found = jobsData.find(j => j.id === jobId);
                if (!found) setError('ไม่พบข้อมูลงานซ่อม หรือลิงก์ไม่ถูกต้อง');
            }
        } catch (err) {
            setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        } finally {
            setLoading(false);
        }
    };
    initData();
  }, [jobId]);

  useEffect(() => {
      setCurrentPage(1);
  }, [activeTab, deptFilter, search, startDate, endDate, statusFilter]);

  const handleResetFilters = () => {
      setDeptFilter('');
      setSearch('');
      setStartDate('');
      setEndDate('');
      setStatusFilter('ALL');
  };

  const activeJob = useMemo(() => 
      allJobs.find(j => j.id === currentJobId), 
  [allJobs, currentJobId]);

  const getStatusWeight = (status: JobStatus) => {
      if (status === JobStatus.IN_PROGRESS || status === JobStatus.WAITING_INSPECTION) return 1;
      if (status === JobStatus.FINISHED) return 2;
      return 3;
  };

  const filteredList = useMemo(() => {
      if (!deptFilter) return [];

      let result = allJobs.filter(j => {
          if (activeTab === 'ACTION') {
              if (j.status !== JobStatus.WAITING_INSPECTION) return false;
          } else {
              if (statusFilter !== 'ALL') {
                  if (statusFilter === 'FINISHED' && j.status !== JobStatus.FINISHED) return false;
                  if (statusFilter === 'IN_PROGRESS' && j.status !== JobStatus.IN_PROGRESS) return false;
                  if (statusFilter === 'CANCELLED' && j.status !== JobStatus.CANCELLED && j.status !== JobStatus.UNREPAIRABLE) return false;
              }
          }
          
          if (j.department !== deptFilter) return false;
          if (startDate && j.dateReceived < startDate) return false;
          if (endDate && j.dateReceived > endDate) return false;

          if (search) {
              const q = search.toLowerCase();
              return (
                  j.jobRunningId.toLowerCase().includes(q) ||
                  j.itemDescription.toLowerCase().includes(q) ||
                  j.department.toLowerCase().includes(q)
              );
          }
          return true;
      });

      return result.sort((a, b) => {
          const weightA = getStatusWeight(a.status);
          const weightB = getStatusWeight(b.status);
          
          if (weightA !== weightB) return weightA - weightB;
          return new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime();
      });

  }, [allJobs, activeTab, deptFilter, search, startDate, endDate, statusFilter]);

  const paginatedList = useMemo(() => {
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      return filteredList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredList, currentPage]);

  const totalPages = Math.ceil(filteredList.length / ITEMS_PER_PAGE);

  const statusCounts = useMemo(() => {
      const counts = { active: 0, finished: 0, cancelled: 0 };
      if (!deptFilter) return counts;

      filteredList.forEach(j => {
          const w = getStatusWeight(j.status);
          if (w === 1) counts.active++;
          else if (w === 2) counts.finished++;
          else counts.cancelled++;
      });
      return counts;
  }, [filteredList, deptFilter]);

  const handleSelectJob = (id: string) => {
      setCurrentJobId(id);
      setView('DETAIL');
      const job = allJobs.find(j => j.id === id);
      if (job) {
          setRating(job.evaluation ? { speed: job.evaluation.speed || 5, quality: job.evaluation.quality || 5 } : { speed: 5, quality: 5 });
          setSuggestion(job.assessment || '');
      }
      setIsRejectMode(false);
      setSubmitted(false);
      window.scrollTo(0,0);
  };

  const handleBackToList = () => {
      setCurrentJobId(null);
      setView('LIST');
      setSubmitted(false);
  };

  const handleApprove = async () => {
      if (!activeJob) return;
      try {
          const updatedJob: Job = {
              ...activeJob,
              status: JobStatus.FINISHED,
              evaluation: rating,
              assessment: suggestion,
              finishedDate: activeJob.finishedDate || new Date().toISOString().split('T')[0]
          };
          await dataService.saveJob(updatedJob);
          
          setAllJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
          setSubmitted(true);
      } catch (err) {
          alert('บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
  };

  const handleReject = async () => {
      if (!activeJob) return;
      if (!rejectReason.trim()) {
          alert('กรุณาระบุสาเหตุที่ต้องแก้ไข');
          return;
      }
      try {
          const updatedJob: Job = {
              ...activeJob,
              status: JobStatus.IN_PROGRESS,
              finishedDate: undefined,
              assessment: `[ส่งแก้ไข] ${rejectReason} (เมื่อ: ${new Date().toLocaleDateString('th-TH')})`
          };
          await dataService.saveJob(updatedJob);

          setAllJobs(prev => prev.map(j => j.id === updatedJob.id ? updatedJob : j));
          setSubmitted(true);
      } catch (err) {
          alert('บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
  };

  const getStatusBadge = (status: JobStatus) => {
      switch (status) {
          case JobStatus.WAITING_INSPECTION:
              return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">รอตรวจรับ</span>;
          case JobStatus.FINISHED:
              return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200">ปิดงานแล้ว</span>;
          case JobStatus.IN_PROGRESS:
              return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200">กำลังดำเนินการ</span>;
          case JobStatus.CANCELLED:
          case JobStatus.UNREPAIRABLE:
              return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-200">ยกเลิก/ซ่อมไม่ได้</span>;
          default:
              return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">{status}</span>;
      }
  };

  const getTechNames = (ids?: string[]) => {
      if (!ids || ids.length === 0) return '-';
      
      const validNames = ids.map(id => {
          const t = technicians.find(tech => tech.id === id);
          return t ? `${t.firstName} (${t.nickName})` : null;
      }).filter(name => name !== null);

      if (validNames.length === 0) return '-';
      return validNames.join(', ');
  };

  const StarRating = ({ label, value, onChange, readOnly }: { label: string, value: number, onChange?: (val: number) => void, readOnly?: boolean }) => (
    <div className="flex flex-col gap-2 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <label className="text-sm font-bold text-slate-600">{label}</label>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                      key={star} 
                      disabled={readOnly}
                      onClick={() => onChange && onChange(star)}
                      className={`transition-all ${!readOnly && 'active:scale-90 focus:outline-none transform hover:scale-110'} ${star <= value ? 'text-yellow-400 drop-shadow-sm' : 'text-slate-200'}`}
                  >
                      <Star size={24} fill={star <= value ? "currentColor" : "none"} />
                  </button>
              ))}
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
              value >= 4 ? 'bg-green-100 text-green-700' : 
              value === 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
          }`}>
              {value === 5 ? 'ดีมาก' : value === 4 ? 'ดี' : value === 3 ? 'ปานกลาง' : 'ปรับปรุง'}
          </span>
        </div>
    </div>
  );

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-600"></div></div>;
  
  if (error) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="bg-red-100 p-4 rounded-full text-red-500 mb-4"><XCircle size={48}/></div>
          <h1 className="text-xl font-bold text-slate-800 mb-2">{error}</h1>
          <p className="text-slate-500">กรุณาติดต่อเจ้าหน้าที่ดูแลระบบ</p>
      </div>
  );

  if (submitted) return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white p-6 text-center animate-fade-in">
          <div className="bg-white p-6 rounded-full text-green-500 mb-6 shadow-xl shadow-green-100 ring-8 ring-green-50"><Check size={64} strokeWidth={3}/></div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">บันทึกข้อมูลเรียบร้อย</h1>
          <p className="text-slate-600 mb-8">ขอบคุณสำหรับการประเมินและตรวจรับงาน</p>
          <div className="flex gap-4">
              {!jobId && ( 
                  <button onClick={handleBackToList} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                      กลับหน้ารายการ
                  </button>
              )}
              {jobId && (
                  <button onClick={() => window.location.reload()} className="text-brand-600 font-bold hover:underline">
                      รีโหลดหน้าเว็บ
                  </button>
              )}
          </div>
      </div>
  );

  if (view === 'LIST') {
      return (
        <div className="min-h-screen bg-slate-50 pb-20">
            <div className="bg-white sticky top-0 z-20 border-b border-slate-200 shadow-sm px-4 pt-4 pb-2">
                <div className="flex items-center gap-2 mb-4">
                    <div className="bg-brand-600 text-white p-2 rounded-lg"><Activity size={20}/></div>
                    <div>
                        <h1 className="font-bold text-slate-800 text-lg leading-none">ศูนย์บริการงานซ่อม</h1>
                        <p className="text-[10px] text-slate-400 mt-1">Maintenance Service Center</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl mb-3">
                    <button 
                        onClick={() => { setActiveTab('ACTION'); handleResetFilters(); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'ACTION' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                        <CheckCircle size={14}/> รอตรวจรับ
                    </button>
                    <button 
                        onClick={() => { setActiveTab('TRACK'); handleResetFilters(); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'TRACK' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                    >
                        <Search size={14}/> ติดตามงาน
                    </button>
                </div>
                
                <div className="space-y-3 pb-2 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="relative col-span-2">
                            <select 
                                className={`w-full pl-9 pr-4 py-2 bg-slate-50 border rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-brand-500 outline-none appearance-none shadow-sm transition-all ${!deptFilter ? 'border-brand-300 ring-2 ring-brand-100 animate-pulse' : 'border-slate-200'}`}
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                            >
                                <option value="">-- กรุณาเลือกแผนกของคุณ (Department) --</option>
                                {departments.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <Building2 className={`absolute left-3 top-2 ${!deptFilter ? 'text-brand-600' : 'text-slate-400'}`} size={16} />
                            <div className="absolute right-3 top-2.5 pointer-events-none text-slate-400">▼</div>
                        </div>

                        <div className="relative col-span-2">
                            <Search className="absolute left-3 top-2 text-slate-400" size={16} />
                            <input 
                                type="text" 
                                placeholder="ค้นหาเลขที่, ชื่อเครื่องจักร..." 
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                disabled={!deptFilter}
                            />
                        </div>

                        <div className={`col-span-2 bg-slate-50 p-2 rounded-xl border border-slate-100 space-y-2 ${!deptFilter ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <input 
                                        type="date" 
                                        className="w-full pl-2 pr-1 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] focus:ring-1 focus:ring-brand-500 outline-none"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        placeholder="จากวันที่"
                                    />
                                </div>
                                <span className="text-[10px] text-slate-400">ถึง</span>
                                <div className="relative flex-1">
                                    <input 
                                        type="date" 
                                        className="w-full pl-2 pr-1 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] focus:ring-1 focus:ring-brand-500 outline-none"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        placeholder="ถึงวันที่"
                                    />
                                </div>
                            </div>
                            
                            {activeTab === 'TRACK' && (
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap">สถานะ:</span>
                                    <div className="flex gap-1 overflow-x-auto flex-1 pb-1">
                                        {[
                                            { id: 'ALL', label: 'ทั้งหมด' },
                                            { id: 'IN_PROGRESS', label: 'กำลังทำ' },
                                            { id: 'FINISHED', label: 'เสร็จสิ้น' },
                                            { id: 'CANCELLED', label: 'ยกเลิก' }
                                        ].map(s => (
                                            <button 
                                                key={s.id}
                                                onClick={() => setStatusFilter(s.id)}
                                                className={`px-2 py-1 rounded-md text-[10px] font-bold whitespace-nowrap border transition-all ${statusFilter === s.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-500 border-slate-200'}`}
                                            >
                                                {s.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {(startDate || endDate || search || deptFilter || statusFilter !== 'ALL') && (
                                <button 
                                    onClick={handleResetFilters}
                                    className="w-full py-1 text-[10px] text-slate-400 hover:text-red-500 flex items-center justify-center gap-1 border-t border-slate-200 mt-1 pt-1"
                                >
                                    <RotateCcw size={10}/> ล้างตัวกรอง
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {activeTab === 'TRACK' && filteredList.length > 0 && (
                <div className="px-4 pt-2">
                    <div className="flex gap-2 text-[10px] font-bold text-slate-500 bg-white p-2 rounded-xl border border-slate-100 shadow-sm justify-between">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> กำลังทำ: {statusCounts.active}</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> เสร็จ: {statusCounts.finished}</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> ยกเลิก: {statusCounts.cancelled}</div>
                    </div>
                </div>
            )}

            <div className="p-4 space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">
                    <span>
                        {activeTab === 'ACTION' ? 'รายการรอตรวจรับ' : 'ผลการค้นหา'}
                    </span>
                    {filteredList.length > 0 && <span>ทั้งหมด {filteredList.length} รายการ</span>}
                </div>

                {paginatedList.length > 0 ? paginatedList.map(job => (
                    <div 
                        key={job.id}
                        onClick={() => handleSelectJob(job.id)}
                        className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:scale-95 transition-all cursor-pointer relative overflow-hidden"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-black tracking-wide border border-slate-200">
                                {job.jobRunningId}
                            </span>
                            {activeTab === 'TRACK' ? getStatusBadge(job.status) : <span className="text-[10px] text-slate-400">{formatDate(job.finishedDate || job.dateReceived)}</span>}
                        </div>
                        
                        <h3 className="text-sm font-bold text-slate-800 line-clamp-2 mb-2 leading-snug">
                            {job.pmPlanId && <span className="text-orange-600 mr-1">[PM]</span>}
                            {job.itemDescription}
                        </h3>
                        
                        <div className="space-y-1.5 mb-2">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Building2 size={12} className="shrink-0"/> <span className="truncate max-w-[200px]">{job.department}</span>
                            </div>
                            
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <User size={12} className="shrink-0"/> 
                                <span className="truncate max-w-[200px]">{getTechNames(job.technicianIds)}</span>
                            </div>

                            {job.damageDescription && (
                                <div className="flex items-start gap-2 text-xs text-slate-500">
                                    <AlertCircle size={12} className="shrink-0 mt-0.5"/> 
                                    <span className="line-clamp-1">{job.damageDescription}</span>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-50">
                            {activeTab === 'TRACK' && job.finishedDate ? (
                                <span className="text-[10px] text-emerald-600 font-bold">เสร็จ: {formatDate(job.finishedDate)}</span>
                            ) : (
                                <span className="text-[10px] text-slate-400">รับแจ้ง: {formatDate(job.dateReceived)}</span>
                            )}
                            
                            {job.costs && job.costs.length > 0 && (
                                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                                    {job.costs.reduce((s,c) => s+c.totalPrice, 0).toLocaleString()} ฿
                                </span>
                            )}
                        </div>

                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-200">
                            <ChevronRight size={24}/>
                        </div>
                    </div>
                )) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                        {!deptFilter ? (
                            <>
                                <Building2 size={48} className="mb-4 text-brand-600 animate-bounce"/>
                                <p className="font-bold text-brand-700">กรุณาเลือกแผนกของคุณ</p>
                                <p className="text-xs mt-1 text-center max-w-xs text-slate-500">
                                    เลือกแผนกจากตัวเลือกด้านบน<br/>เพื่อตรวจสอบรายการงานซ่อม
                                </p>
                            </>
                        ) : (
                            activeTab === 'ACTION' ? (
                                <>
                                    <CheckCircle size={48} className="mb-4 opacity-20"/>
                                    <p className="font-bold">ไม่พบงานรอตรวจรับ</p>
                                    <p className="text-xs mt-1">ของแผนก: {deptFilter}</p>
                                </>
                            ) : (
                                <>
                                    <Search size={48} className="mb-4 opacity-20"/>
                                    <p className="font-bold text-center">ไม่พบข้อมูลงานซ่อม</p>
                                    <p className="text-xs mt-1 text-center max-w-xs">
                                        แผนก: {deptFilter}<br/>ลองเปลี่ยนคำค้นหา หรือช่วงเวลา
                                    </p>
                                </>
                            )
                        )}
                    </div>
                )}
            </div>

            {totalPages > 1 && (
                <div className="sticky bottom-0 bg-white border-t border-slate-100 p-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex justify-between items-center z-30">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
                    >
                        <ChevronsLeft size={20}/>
                    </button>
                    
                    <span className="text-xs font-bold text-slate-500">
                        หน้า {currentPage} / {totalPages}
                    </span>

                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
                    >
                        <ChevronsRight size={20}/>
                    </button>
                </div>
            )}
        </div>
      );
  }

  if (!activeJob) return null; 

  const isWaitingInspection = activeJob.status === JobStatus.WAITING_INSPECTION;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="bg-white sticky top-0 z-10 border-b border-slate-200 shadow-sm px-4 py-4 flex items-center gap-3">
          {!jobId && (
              <button onClick={handleBackToList} className="p-1 -ml-2 text-slate-500 hover:text-slate-800">
                  <ChevronLeft size={24}/>
              </button>
          )}
          <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold font-mono border border-slate-200">
                      {activeJob.jobRunningId}
                  </span>
                  {getStatusBadge(activeJob.status)}
              </div>
              <h1 className="font-bold text-slate-800 text-sm truncate">{activeJob.itemDescription}</h1>
          </div>
      </div>

      <div className="p-4 max-w-lg mx-auto space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
              <div className="mb-3 flex justify-between items-start">
                  {activeJob.pmPlanId ? (
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200 flex items-center gap-1">
                          <Clock size={12}/> งาน PM
                      </span>
                  ) : (
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 flex items-center gap-1">
                          <LayoutList size={12}/> งานทั่วไป
                      </span>
                  )}
                  <span className="text-[10px] text-slate-400">แจ้งเมื่อ: {formatDate(activeJob.dateReceived)}</span>
              </div>

              <div className="space-y-4 text-sm">
                  <div>
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">อาการเสีย / สาเหตุ</p>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-slate-700 leading-relaxed min-h-[40px]">
                          {activeJob.damageDescription || '-'}
                      </div>
                  </div>

                  <div className="flex items-start gap-3">
                      <User className="text-slate-400 mt-0.5" size={16}/>
                      <div>
                          <p className="text-xs text-slate-400 font-bold uppercase">ช่างผู้รับผิดชอบ</p>
                          <p className="text-slate-700 font-medium">{getTechNames(activeJob.technicianIds)}</p>
                      </div>
                  </div>

                  <div className="flex items-start gap-3">
                      <Wrench className="text-slate-400 mt-0.5" size={16}/>
                      <div>
                          <p className="text-xs text-slate-400 font-bold uppercase">การดำเนินการ / หมายเหตุช่าง</p>
                          <p className="text-slate-700 font-medium">{activeJob.repairGroup}</p>
                          {activeJob.assessment && (
                              <div className="text-xs text-slate-600 mt-2 bg-slate-50 p-2 rounded border border-slate-100 leading-relaxed">
                                  {activeJob.assessment}
                              </div>
                          )}
                      </div>
                  </div>

                  {activeJob.costs && activeJob.costs.length > 0 && (
                      <div className="mt-2">
                          <p className="text-xs text-slate-400 font-bold uppercase mb-2 flex items-center gap-1">
                              <DollarSign size={12}/> รายการค่าใช้จ่าย
                          </p>
                          <div className="border border-slate-100 rounded-lg overflow-hidden">
                              <table className="w-full text-xs">
                                  <thead className="bg-slate-50 text-slate-500 font-bold">
                                      <tr>
                                          <th className="px-3 py-2 text-left">รายการ</th>
                                          <th className="px-3 py-2 text-right">รวม</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                      {activeJob.costs.map((c, i) => (
                                          <tr key={i}>
                                              <td className="px-3 py-2 text-slate-600">
                                                  {c.name} <span className="text-slate-400">({c.quantity})</span>
                                              </td>
                                              <td className="px-3 py-2 text-right font-medium text-slate-700">
                                                  {c.totalPrice.toLocaleString()}
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                                  <tfoot className="bg-slate-50 font-bold text-slate-800">
                                      <tr>
                                          <td className="px-3 py-2 text-right">รวมทั้งสิ้น</td>
                                          <td className="px-3 py-2 text-right text-brand-600">
                                              {activeJob.costs.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString()} ฿
                                          </td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      </div>
                  )}
              </div>
          </div>
          
          {isWaitingInspection ? (
              !isRejectMode ? (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-fade-in-up">
                      <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                          <Star className="text-yellow-400 fill-yellow-400" size={20}/> ประเมินความพึงพอใจ
                      </h3>
                      
                      <div className="space-y-4 mb-6">
                          <StarRating 
                              label="ความรวดเร็ว (Speed)" 
                              value={rating.speed} 
                              onChange={(v) => setRating({...rating, speed: v})} 
                          />
                          <StarRating 
                              label="คุณภาพงาน (Quality)" 
                              value={rating.quality} 
                              onChange={(v) => setRating({...rating, quality: v})} 
                          />
                          <div>
                              <label className="text-sm font-bold text-slate-600 mb-2 block">ข้อเสนอแนะเพิ่มเติม (ถ้ามี)</label>
                              <textarea 
                                  className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none resize-none bg-slate-50 focus:bg-white transition-all"
                                  rows={3}
                                  placeholder="ระบุข้อเสนอแนะ..."
                                  value={suggestion}
                                  onChange={e => setSuggestion(e.target.value)}
                              />
                          </div>
                      </div>

                      <div className="flex flex-col gap-3">
                          <button 
                              onClick={handleApprove}
                              className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold shadow-lg shadow-green-200 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                          >
                              <CheckCircle size={20}/> ยืนยัน: งานเรียบร้อยดี
                          </button>
                          <button 
                              onClick={() => setIsRejectMode(true)}
                              className="w-full py-3 bg-white text-red-500 border border-red-100 rounded-xl font-bold text-sm hover:bg-red-50 transition-colors"
                          >
                              งานไม่เรียบร้อย (ส่งแก้ไข)
                          </button>
                      </div>
                  </div>
              ) : (
                  <div className="bg-white rounded-2xl p-5 shadow-sm border border-red-100 animate-fade-in-up">
                      <h3 className="font-bold text-red-600 mb-2 flex items-center gap-2">
                          <AlertCircle size={20}/> ส่งกลับแก้ไขงาน
                      </h3>
                      <p className="text-xs text-slate-500 mb-4">กรุณาระบุสาเหตุเพื่อให้ช่างดำเนินการแก้ไข</p>
                      
                      <textarea 
                          className="w-full p-3 border border-red-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none mb-4 min-h-[120px]"
                          placeholder="เช่น อาการเดิมยังไม่หาย, อุปกรณ์ยังใช้งานไม่ได้..."
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          autoFocus
                      />

                      <div className="flex gap-3">
                          <button 
                              onClick={() => setIsRejectMode(false)}
                              className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm"
                          >
                              ยกเลิก
                          </button>
                          <button 
                              onClick={handleReject}
                              className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-200"
                          >
                              ยืนยันส่งคืน
                          </button>
                      </div>
                  </div>
              )
          ) : (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 text-center">
                  {activeJob.status === JobStatus.FINISHED ? (
                      <>
                          <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                              <CheckCircle size={32} />
                          </div>
                          <h3 className="text-lg font-bold text-slate-800">งานนี้ปิดงานเรียบร้อยแล้ว</h3>
                          <p className="text-sm text-slate-500 mb-6">วันที่เสร็จ: {formatDate(activeJob.finishedDate)}</p>
                          
                          {activeJob.evaluation && (
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 text-left">
                                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">ผลการประเมินของคุณ</p>
                                  <div className="flex justify-between text-sm mb-1">
                                      <span className="text-slate-600">ความรวดเร็ว</span>
                                      <div className="flex text-yellow-400">
                                          {[...Array(activeJob.evaluation.speed)].map((_, i) => <Star key={i} size={14} fill="currentColor"/>)}
                                      </div>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                      <span className="text-slate-600">คุณภาพงาน</span>
                                      <div className="flex text-yellow-400">
                                          {[...Array(activeJob.evaluation.quality)].map((_, i) => <Star key={i} size={14} fill="currentColor"/>)}
                                      </div>
                                  </div>
                              </div>
                          )}
                      </>
                  ) : activeJob.status === JobStatus.IN_PROGRESS ? (
                      <>
                          <div className="bg-amber-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                              <Wrench size={32} />
                          </div>
                          <h3 className="text-lg font-bold text-slate-800">กำลังดำเนินการซ่อม</h3>
                          <p className="text-sm text-slate-500">ช่างกำลังปฏิบัติงาน หรือรออะไหล่</p>
                      </>
                  ) : (
                      <>
                          <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                              <FileText size={32} />
                          </div>
                          <h3 className="text-lg font-bold text-slate-800">สถานะ: {activeJob.status}</h3>
                      </>
                  )}
                  
                  <div className="mt-6 pt-4 border-t border-slate-100">
                      <button onClick={handleBackToList} className="text-brand-600 font-bold text-sm hover:underline">
                          กลับหน้ารายการ
                      </button>
                  </div>
              </div>
          )}

      </div>
    </div>
  );
};

export default PublicWorkAcceptance;
