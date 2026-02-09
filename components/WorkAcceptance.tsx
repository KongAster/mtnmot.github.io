
import React, { useState, useMemo, useEffect } from 'react';
import { Job, JobStatus, Technician, formatDate } from '../types';
import { CheckCircle, Search, User, Wrench, Calendar, Star, AlertCircle, ChevronRight, DollarSign, Filter, X, ChevronLeft, FileText } from 'lucide-react';

interface WorkAcceptanceProps {
  jobs: Job[];
  technicians: Technician[];
  onUpdateJob: (job: Job) => void;
  departments: string[];
}

const WorkAcceptance: React.FC<WorkAcceptanceProps> = ({ jobs, technicians, onUpdateJob, departments = [] }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  
  // Evaluation State
  const [rating, setRating] = useState({ speed: 5, quality: 5 });
  const [suggestion, setSuggestion] = useState('');

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Approve Modal State
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);

  // Filter only jobs waiting for inspection
  const pendingJobs = useMemo(() => {
    return jobs.filter(j => 
        j.status === JobStatus.WAITING_INSPECTION &&
        (selectedDept === '' || j.department === selectedDept) &&
        (j.itemDescription.toLowerCase().includes(searchTerm.toLowerCase()) || 
         j.jobRunningId.toLowerCase().includes(searchTerm.toLowerCase()) ||
         j.department.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => {
        const dateA = a.finishedDate || a.dateReceived;
        const dateB = b.finishedDate || b.dateReceived;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [jobs, searchTerm, selectedDept]);

  // Reset form when job changes
  useEffect(() => {
      if (selectedJob) {
          setRating({ 
              speed: selectedJob.evaluation?.speed || 5, 
              quality: selectedJob.evaluation?.quality || 5 
          });
          setSuggestion(selectedJob.assessment || '');
      }
  }, [selectedJob]);

  const handleJobSelect = (job: Job) => {
      setSelectedJob(job);
      setIsMobileDetailOpen(true);
  };

  const handleBackToList = () => {
      setIsMobileDetailOpen(false);
      setTimeout(() => setSelectedJob(null), 300);
  };

  const handleApproveClick = () => {
      if (!selectedJob) return;
      setIsApproveModalOpen(true);
  };

  const submitApprove = () => {
      if (!selectedJob) return;

      const updatedJob: Job = { 
          ...selectedJob,
          status: JobStatus.FINISHED,
          evaluation: rating,
          assessment: suggestion,
          finishedDate: selectedJob.finishedDate || new Date().toISOString().split('T')[0]
      };

      onUpdateJob(updatedJob);
      setIsApproveModalOpen(false);
      setIsMobileDetailOpen(false);
      setSelectedJob(null);
  };

  const handleRejectClick = () => {
      if (!selectedJob) return;
      setRejectReason('');
      setIsRejectModalOpen(true);
  };

  const submitReject = () => {
      if (!selectedJob) return;
      if (!rejectReason.trim()) {
          alert("กรุณาระบุสาเหตุที่ต้องแก้ไขงาน");
          return;
      }

      const updatedJob: Job = {
          ...selectedJob,
          status: JobStatus.IN_PROGRESS,
          finishedDate: undefined,
          assessment: `[ส่งแก้ไข] ${rejectReason} (เมื่อ: ${new Date().toLocaleDateString('th-TH')})`
      };

      onUpdateJob(updatedJob);
      setIsRejectModalOpen(false);
      setIsMobileDetailOpen(false);
      setSelectedJob(null);
  };

  const getTechNames = (ids?: string[]) => {
      if (!ids || ids.length === 0) return 'ไม่ระบุช่าง';
      return ids.map(id => technicians.find(t => t.id === id)?.nickName || id).join(', ');
  };

  const StarRating = ({ label, value, onChange }: { label: string, value: number, onChange: (val: number) => void }) => (
      <div className="flex flex-col gap-1.5 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
          <label className="text-xs font-bold text-slate-500">{label}</label>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button 
                        key={star} 
                        onClick={() => onChange(star)}
                        className={`transition-all active:scale-95 focus:outline-none ${star <= value ? 'text-yellow-400 drop-shadow-sm' : 'text-slate-200'}`}
                    >
                        <Star size={28} fill={star <= value ? "currentColor" : "none"} />
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

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-80px)] md:h-[calc(100vh-100px)] gap-4 md:gap-6 animate-fade-in pb-2 md:pb-4 relative overflow-hidden">
      
      {/* LEFT COLUMN: LIST */}
      <div className={`w-full md:w-1/3 lg:w-96 flex-col bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden shrink-0 absolute inset-0 z-10 md:static md:flex transition-transform duration-300 ${isMobileDetailOpen ? '-translate-x-full md:translate-x-0 opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto' : 'translate-x-0 opacity-100'}`}>
          <div className="p-4 border-b border-slate-100 bg-white z-20">
              <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 bg-brand-50 text-brand-600 rounded-lg"><CheckCircle size={20} /></div>
                  <div>
                      <h2 className="text-base font-bold text-slate-800 leading-none">รอตรวจรับงาน</h2>
                      <p className="text-[10px] text-slate-400 mt-0.5">{pendingJobs.length} รายการ</p>
                  </div>
              </div>
              
              <div className="space-y-2">
                  <div className="relative">
                      <select 
                          value={selectedDept}
                          onChange={(e) => setSelectedDept(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:ring-2 focus:ring-brand-500 outline-none appearance-none cursor-pointer"
                      >
                          <option value="">ทุกแผนก (All Departments)</option>
                          {departments.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <Filter className="absolute left-3 top-2.5 text-slate-400" size={14} />
                  </div>

                  <div className="relative">
                      <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                      <input 
                          type="text" 
                          placeholder="ค้นหาเลขที่, เครื่องจักร..." 
                          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500 outline-none"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                  </div>
              </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50/50 custom-scrollbar">
              {pendingJobs.length > 0 ? (
                  pendingJobs.map(job => (
                      <div 
                          key={job.id}
                          onClick={() => handleJobSelect(job)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-95 relative group
                              ${selectedJob?.id === job.id 
                                  ? 'bg-white border-brand-500 ring-1 ring-brand-500 shadow-md z-10' 
                                  : 'bg-white border-slate-200 hover:border-brand-300 shadow-sm'
                              }`}
                      >
                          <div className="flex justify-between items-start mb-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${selectedJob?.id === job.id ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {job.jobRunningId}
                              </span>
                              <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 rounded">{formatDate(job.finishedDate || job.dateReceived)}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-800 line-clamp-2 mb-2 leading-snug">{job.itemDescription}</h4>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-50">
                              <div className="flex items-center gap-1.5">
                                  <User size={12}/> <span className="truncate max-w-[100px]">{getTechNames(job.technicianIds)}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                  <Wrench size={12}/> {job.repairGroup}
                              </div>
                          </div>
                          <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" size={20}/>
                      </div>
                  ))
              ) : (
                  <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                      <CheckCircle size={40} className="mb-2 opacity-20"/>
                      <p className="text-sm font-medium">ไม่พบงานรอตรวจรับ</p>
                      <p className="text-xs opacity-70 mt-1">ลองเปลี่ยนตัวกรอง หรือค้นหาใหม่</p>
                  </div>
              )}
          </div>
      </div>

      {/* RIGHT COLUMN: DETAIL */}
      <div className={`flex-1 bg-white rounded-xl md:rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-w-0 absolute inset-0 z-20 md:static transition-transform duration-300 transform ${isMobileDetailOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
          {selectedJob ? (
              <>
                  <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/30 sticky top-0 z-30 backdrop-blur-sm bg-white/80">
                      <div className="flex-1 min-w-0">
                          <button onClick={handleBackToList} className="md:hidden mb-2 flex items-center text-slate-500 text-xs font-bold hover:text-brand-600">
                              <ChevronLeft size={16}/> กลับไปหน้ารายการ
                          </button>

                          <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="bg-brand-600 text-white px-2.5 py-0.5 rounded-lg text-xs font-bold shadow-sm shadow-brand-200">
                                  {selectedJob.jobRunningId}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {selectedJob.jobType || 'ซ่อมทั่วไป'}
                              </span>
                          </div>
                          <h2 className="text-lg md:text-xl font-bold text-slate-800 leading-tight line-clamp-2">{selectedJob.itemDescription}</h2>
                      </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar bg-white">
                      <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                          <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">วันที่แจ้ง</p>
                              <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
                                  <Calendar size={14} className="text-slate-400"/> {formatDate(selectedJob.dateReceived)}
                              </div>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">วันที่เสร็จ</p>
                              <div className="flex items-center justify-end gap-2 text-emerald-700 font-bold text-sm">
                                  <CheckCircle size={14}/> {selectedJob.finishedDate ? formatDate(selectedJob.finishedDate) : 'รอระบุ (จะถูกบันทึกเมื่อยืนยัน)'}
                              </div>
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-500 mb-1.5 block">อาการเสีย / สาเหตุ</label>
                              <div className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm leading-relaxed min-h-[60px] shadow-sm">
                                  {selectedJob.damageDescription || '-'}
                              </div>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500 mb-1.5 block">การดำเนินงานซ่อม / หมายเหตุช่าง</label>
                              <div className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-700 text-sm leading-relaxed min-h-[60px] shadow-sm">
                                  {selectedJob.assessment && !selectedJob.assessment.startsWith('[') ? selectedJob.assessment : 'ไม่ได้ระบุรายละเอียด'}
                              </div>
                          </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-2 text-xs font-bold text-slate-700">
                              <DollarSign size={14}/> รายการอะไหล่/ค่าใช้จ่าย
                          </div>
                          <div>
                              <table className="w-full text-xs">
                                  <tbody className="divide-y divide-slate-100">
                                      {selectedJob.costs && selectedJob.costs.length > 0 ? (
                                          selectedJob.costs.map((cost, idx) => (
                                              <tr key={idx}>
                                                  <td className="px-4 py-3 text-slate-600">
                                                      {cost.name} <span className="text-slate-400 text-[10px]">(x{cost.quantity})</span>
                                                  </td>
                                                  <td className="px-4 py-3 text-right font-bold text-slate-700">
                                                      {cost.totalPrice.toLocaleString()}
                                                  </td>
                                              </tr>
                                          ))
                                      ) : (
                                          <tr><td className="px-4 py-4 text-center text-slate-400 text-xs italic" colSpan={2}>ไม่มีรายการค่าใช้จ่าย</td></tr>
                                      )}
                                  </tbody>
                                  <tfoot className="bg-slate-50 font-bold text-slate-800">
                                      <tr>
                                          <td className="px-4 py-2 text-right text-[10px] uppercase tracking-wider text-slate-500">รวมทั้งสิ้น</td>
                                          <td className="px-4 py-2 text-right text-brand-600 text-sm">
                                              {selectedJob.costs?.reduce((s, c) => s + c.totalPrice, 0).toLocaleString() || 0} ฿
                                          </td>
                                      </tr>
                                  </tfoot>
                              </table>
                          </div>
                      </div>

                      <div className="bg-brand-50/50 p-5 rounded-2xl border border-brand-100">
                          <h3 className="font-bold text-brand-800 flex items-center gap-2 mb-4 text-sm">
                              <span className="bg-brand-100 p-1.5 rounded-lg"><Star size={16} className="text-brand-600"/></span> 
                              ประเมินความพึงพอใจ (Evaluation)
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500 mb-1.5 block">ข้อเสนอแนะเพิ่มเติม (ถ้ามี)</label>
                              <input 
                                  type="text"
                                  className="w-full px-4 py-2.5 bg-white border border-brand-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500 outline-none placeholder-slate-300"
                                  placeholder="ระบุข้อเสนอแนะ..."
                                  value={suggestion}
                                  onChange={e => setSuggestion(e.target.value)}
                              />
                          </div>
                      </div>

                  </div>

                  <div className="p-4 border-t border-slate-100 bg-white flex flex-col sm:flex-row justify-end gap-3 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                      <button 
                          onClick={handleRejectClick}
                          className="px-6 py-3 rounded-xl border border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors text-sm w-full sm:w-auto"
                      >
                          ส่งแก้ไข (Reject)
                      </button>
                      <button 
                          onClick={handleApproveClick}
                          className="px-8 py-3 rounded-xl bg-brand-600 text-white font-bold hover:bg-brand-700 shadow-lg shadow-brand-500/30 transition-all transform active:scale-95 flex items-center justify-center gap-2 text-sm w-full sm:w-auto"
                      >
                          <CheckCircle size={18}/> ยืนยันตรวจรับงาน
                      </button>
                  </div>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/30 hidden md:flex">
                  <FileText size={64} className="mb-4 opacity-20"/>
                  <p className="text-lg font-medium text-slate-400">เลือกรายการทางซ้ายเพื่อตรวจสอบรายละเอียด</p>
              </div>
          )}
      </div>

      {/* Reject Modal */}
      {isRejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scale-in">
                  <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          <AlertCircle size={20} className="text-red-500"/> ส่งกลับแก้ไขงาน
                      </h3>
                      <button onClick={() => setIsRejectModalOpen(false)} className="text-slate-400 hover:text-red-500 transition-colors">
                          <X size={20}/>
                      </button>
                  </div>
                  <div className="p-6">
                      <p className="text-sm text-slate-600 mb-3">กรุณาระบุสาเหตุที่ต้องการให้ช่างแก้ไขงาน เพื่อความชัดเจนในการปฏิบัติงาน</p>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">สาเหตุการส่งแก้ไข (Reject Reason) <span className="text-red-500">*</span></label>
                      <textarea 
                          className="w-full px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none min-h-[100px] resize-none"
                          placeholder="เช่น งานยังไม่เรียบร้อย, อาการเดิมยังไม่หาย..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          autoFocus
                      />
                  </div>
                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                      <button 
                          onClick={() => setIsRejectModalOpen(false)} 
                          className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-white transition-colors"
                      >
                          ยกเลิก
                      </button>
                      <button 
                          onClick={submitReject} 
                          className="px-6 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 shadow-md transition-all active:scale-95"
                      >
                          ยืนยันส่งคืน
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Approve Confirmation Modal */}
      {isApproveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-in">
                  <div className="p-6 text-center">
                      <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                          <CheckCircle size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-slate-800 mb-2">ยืนยันการตรวจรับงาน</h3>
                      <p className="text-sm text-slate-500">
                          คุณต้องการยืนยันผลการซ่อมและปิดงาน <br/> 
                          <span className="font-bold text-slate-700">{selectedJob?.jobRunningId}</span> ใช่หรือไม่?
                      </p>
                      
                      <div className="mt-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                          <div className="flex justify-center items-center gap-4 text-sm font-medium text-slate-600">
                              <span className="flex items-center gap-1"><Star size={14} className="text-yellow-400 fill-yellow-400"/> Speed: {rating.speed}</span>
                              <span className="flex items-center gap-1"><Star size={14} className="text-yellow-400 fill-yellow-400"/> Quality: {rating.quality}</span>
                          </div>
                      </div>
                  </div>
                  <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                      <button 
                          onClick={() => setIsApproveModalOpen(false)} 
                          className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-sm hover:bg-white transition-colors"
                      >
                          ยกเลิก
                      </button>
                      <button 
                          onClick={submitApprove} 
                          className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 shadow-md transition-all active:scale-95"
                      >
                          ยืนยัน
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default WorkAcceptance;
