import React, { useState, useMemo } from 'react';
import { Job, Technician, JobStatus, formatDate } from '../types';
import { Star, TrendingUp, AlertCircle, Filter, Calendar } from 'lucide-react';

interface EvaluationSummaryProps {
  jobs: Job[];
  technicians: Technician[];
}

const MONTHS_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const EvaluationSummary: React.FC<EvaluationSummaryProps> = ({ jobs, technicians }) => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // Default to current month

  // Only evaluate technicians
  const techList = technicians.filter(t => t.position === 'ช่าง');

  // Filter Jobs based on selection
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Must be FINISHED to be evaluated
      if (job.status !== JobStatus.FINISHED) return false;
      
      // CRITICAL FIX: Match the Registry logic by filtering on 'dateReceived'
      // This ensures if Registry says "3 jobs in Jan", Evaluation also sees "3 jobs in Jan" (even if finished in Feb)
      const d = new Date(job.dateReceived); 
      const jobYear = d.getFullYear();
      const jobMonth = d.getMonth();

      if (jobYear !== selectedYear) return false;
      if (selectedMonth !== -1 && jobMonth !== selectedMonth) return false;

      return true;
    });
  }, [jobs, selectedYear, selectedMonth]);

  // Available Years
  const availableYears = useMemo(() => {
    const jobYears = jobs.map(j => new Date(j.dateReceived).getFullYear());
    jobYears.push(currentYear);
    jobYears.push(2025); 
    
    const minYear = Math.min(...jobYears);
    const maxYear = Math.max(...jobYears);
    
    const years = [];
    for (let y = maxYear; y >= minYear; y--) {
        years.push(y);
    }
    return years;
  }, [jobs, currentYear]);

  const calculateScore = (techId: string) => {
    // 1. Find all finished jobs for this technician in the filtered range
    // Check if technicianIds exists and includes the techId
    const allFinishedJobs = filteredJobs.filter(j => j.technicianIds && j.technicianIds.includes(techId));
    
    if (allFinishedJobs.length === 0) {
        return null;
    }

    let totalScore = 0;
    const maxScorePerJob = 10; // 5 for speed + 5 for quality

    // 2. Calculate Score
    // Logic: Count ALL finished jobs assigned to tech. 
    // If a job has no evaluation (legacy data or forgotten), default to 3 (Normal).
    allFinishedJobs.forEach(j => {
        const speed = j.evaluation?.speed ? Number(j.evaluation.speed) : 3;
        const quality = j.evaluation?.quality ? Number(j.evaluation.quality) : 3;
        totalScore += (speed + quality);
    });

    const maxTotalScore = allFinishedJobs.length * maxScorePerJob;
    const percent = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
    
    // Grading Criteria
    let grade = '';
    let color = '';
    
    if (percent >= 90) { grade = 'ดีมาก'; color = 'text-green-600'; }
    else if (percent >= 70) { grade = 'ดี'; color = 'text-blue-600'; }
    else if (percent >= 60) { grade = 'ปานกลาง'; color = 'text-yellow-600'; }
    else if (percent >= 50) { grade = 'พอใช้'; color = 'text-orange-600'; }
    else { grade = 'ปรับปรุง'; color = 'text-red-600'; }

    return {
        jobCount: allFinishedJobs.length,
        totalScore,
        percent: Math.round(percent),
        grade,
        color
    };
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-slate-800">สรุปผลการประเมินช่าง</h2>
        </div>

        {/* Filters */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-4">
            <div className="flex items-center gap-2 font-bold text-slate-700 border-b border-slate-100 pb-2">
                <Filter size={20} /> ตัวกรองข้อมูล
            </div>
            
            <div className="flex flex-wrap gap-4 items-center">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">ปี (Year)</label>
                    <select 
                        className="px-3 py-2 border rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none min-w-[120px]"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    >
                        {availableYears.map(y => (
                            <option key={y} value={y}>ปี {y}</option>
                        ))}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">เดือน (Month)</label>
                    <select 
                        className="px-3 py-2 border rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 outline-none min-w-[150px]"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    >
                        <option value={-1}>ทุกเดือน (ทั้งปี)</option>
                        {MONTHS_TH.map((m, i) => (
                            <option key={i} value={i}>{m}</option>
                        ))}
                    </select>
                </div>
                
                <div className="ml-auto text-sm text-slate-500 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100 flex items-center gap-2">
                    <Calendar size={14}/>
                    ข้อมูลประจำ: <span className="font-bold text-slate-700">
                        {selectedMonth === -1 ? `ปี ${selectedYear}` : `${MONTHS_TH[selectedMonth]} ${selectedYear}`}
                    </span>
                    <span className="text-[10px] text-slate-400 ml-2">(นับตามวันที่แจ้งซ่อม)</span>
                </div>
            </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {techList.map(tech => {
                const stats = calculateScore(tech.id);
                
                return (
                    <div key={tech.id} className="bg-white rounded-xl shadow-md p-6 border border-slate-100 relative overflow-hidden transition-all hover:shadow-lg">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">{tech.firstName}</h3>
                                <p className="text-slate-500 text-sm">({tech.nickName}) - {tech.category}</p>
                            </div>
                            <div className="bg-slate-100 p-2 rounded-full">
                                <Star className={stats && stats.percent > 0 ? "text-yellow-400 fill-current" : "text-slate-300"} size={24} />
                            </div>
                        </div>

                        {stats ? (
                            <div className="space-y-4">
                                <div className="flex justify-between items-end">
                                    <span className="text-4xl font-bold text-slate-900">{stats.percent}<span className="text-xl">%</span></span>
                                    <span className={`text-lg font-bold ${stats.color} bg-slate-50 px-3 py-1 rounded-full border`}>
                                        {stats.grade}
                                    </span>
                                </div>
                                
                                <div className="w-full bg-slate-100 rounded-full h-2.5">
                                    <div className={`h-2.5 rounded-full ${
                                        stats.percent >= 90 ? 'bg-green-500' :
                                        stats.percent >= 70 ? 'bg-blue-500' :
                                        stats.percent >= 60 ? 'bg-yellow-500' :
                                        'bg-red-500'
                                    }`} style={{ width: `${stats.percent}%` }}></div>
                                </div>

                                <div className="flex items-center text-sm text-slate-500 mt-2">
                                    <TrendingUp size={16} className="mr-1"/>
                                    ผลงานรวม <span className="font-bold text-slate-800 mx-1">{stats.jobCount}</span> งาน
                                </div>
                                <div className="text-[10px] text-slate-400">
                                    *คิดคะแนนจากงานที่เสร็จแล้ว (อิงตามเดือนที่แจ้ง)
                                </div>
                            </div>
                        ) : (
                            <div className="h-32 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                <AlertCircle size={32} className="mb-2 opacity-50"/>
                                <span>ไม่มีงานเสร็จในช่วงเวลานี้</span>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    </div>
  );
};

export default EvaluationSummary;