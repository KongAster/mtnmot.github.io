
import React, { useState } from 'react';
import { Job, JobStatus, formatDate } from '../types';
import { Search, History as HistoryIcon, ArrowDownCircle, Clock, ExternalLink } from 'lucide-react';
import { useDraggableScroll } from '../hooks/useDraggableScroll';

interface HistoryProps {
  jobs: Job[];
  onOpenJob?: (job: Job) => void; // Callback to open details
}

const History: React.FC<HistoryProps> = ({ jobs, onOpenJob }) => {
  const [assetSearch, setAssetSearch] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);

  // Drag Scroll Hooks
  const assetListScroll = useDraggableScroll<HTMLDivElement>();
  const timelineScroll = useDraggableScroll<HTMLDivElement>();

  // Extract unique asset IDs and their latest name
  const assets = React.useMemo(() => {
      const assetMap = new Map<string, string>();
      // Sort jobs by date desc to find latest name
      const sortedJobs = [...jobs].sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime());
      
      sortedJobs.forEach(j => {
          if (j.assetId && !assetMap.has(j.assetId)) {
              assetMap.set(j.assetId, j.itemDescription);
          }
      });
      return Array.from(assetMap.entries()).map(([id, name]) => ({ id, name }));
  }, [jobs]);

  const filteredAssets = assets.filter(a => 
      a.id.toLowerCase().includes(assetSearch.toLowerCase()) || 
      a.name.toLowerCase().includes(assetSearch.toLowerCase())
  );

  const assetHistory = selectedAsset 
    ? jobs
        .filter(j => j.assetId === selectedAsset)
        .sort((a, b) => new Date(b.dateReceived).getTime() - new Date(a.dateReceived).getTime())
    : [];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] gap-6 animate-fade-in">
        {/* Left Sidebar: Asset Search (Fixed Width) */}
        <div className="w-full md:w-80 xl:w-96 bg-white rounded-xl shadow-md p-4 flex flex-col shrink-0">
            <h3 className="text-lg font-bold mb-4 flex items-center text-slate-700">
                <Search className="mr-2" size={20} /> ค้นหารหัสทรัพย์สิน
            </h3>
            <input 
                type="text"
                placeholder="พิมพ์รหัสหรือชื่อทรัพย์สิน..."
                className="w-full p-2 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 text-sm"
                value={assetSearch}
                onChange={(e) => setAssetSearch(e.target.value)}
            />
            <div 
                className="flex-1 overflow-y-auto space-y-2 select-none"
                ref={assetListScroll.ref}
                {...assetListScroll.events}
                style={assetListScroll.style}
            >
                {filteredAssets.map(asset => (
                    <button
                        key={asset.id}
                        onClick={() => { if(!assetListScroll.isDragging) setSelectedAsset(asset.id); }}
                        className={`w-full text-left p-3 rounded-lg transition-colors flex justify-between items-start
                            ${selectedAsset === asset.id ? 'bg-blue-100 text-blue-800 border-l-4 border-blue-500' : 'bg-slate-50 hover:bg-slate-100 text-slate-700'}`}
                    >
                        <div className="flex-1 min-w-0 pr-2">
                            <span className="font-bold text-sm block">{asset.id}</span>
                            <span className="text-xs text-slate-500 truncate block">{asset.name}</span>
                        </div>
                        <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded-full text-slate-600 whitespace-nowrap mt-1">
                            {jobs.filter(j => j.assetId === asset.id).length}
                        </span>
                    </button>
                ))}
                {filteredAssets.length === 0 && <p className="text-center text-slate-400 mt-4 text-sm">ไม่พบรหัสทรัพย์สิน</p>}
            </div>
        </div>

        {/* Right Content: Timeline */}
        <div 
            className="flex-1 bg-white rounded-xl shadow-md p-6 overflow-y-auto select-none min-w-0"
            ref={timelineScroll.ref}
            {...timelineScroll.events}
            style={timelineScroll.style}
        >
            {selectedAsset ? (
                <div>
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-800">ประวัติ: {selectedAsset}</h2>
                            <p className="text-sm text-slate-500">{assets.find(a => a.id === selectedAsset)?.name}</p>
                        </div>
                        <span className="text-slate-500 text-sm">ทั้งหมด {assetHistory.length} รายการ</span>
                    </div>

                    <div className="relative border-l-2 border-slate-200 ml-4 space-y-8">
                        {assetHistory.map((job, index) => (
                            <div key={job.id} className="mb-8 ml-6 relative group">
                                {/* Dot */}
                                <span className={`absolute -left-[33px] flex items-center justify-center w-8 h-8 rounded-full ring-4 ring-white
                                    ${job.status === JobStatus.FINISHED ? 'bg-green-500' : 'bg-amber-500'}
                                `}>
                                   {job.status === JobStatus.FINISHED ? <HistoryIcon size={16} className="text-white"/> : <Clock size={16} className="text-white"/>}
                                </span>

                                {/* Content Card */}
                                <div 
                                    className={`bg-slate-50 rounded-lg p-4 shadow-sm border border-slate-100 transition-all ${onOpenJob ? 'hover:shadow-md cursor-pointer hover:border-blue-200' : ''}`}
                                    onClick={() => !timelineScroll.isDragging && onOpenJob && onOpenJob(job)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{job.jobRunningId}</span>
                                                {onOpenJob && <ExternalLink size={12} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                            <h4 className="text-base font-bold text-slate-800 line-clamp-1">{job.itemDescription}</h4>
                                        </div>
                                        <span className="text-xs text-slate-500 whitespace-nowrap">{formatDate(job.dateReceived)}</span>
                                    </div>
                                    
                                    <p className="text-sm text-slate-600 mb-1"><span className="font-semibold text-xs">อาการ:</span> {job.damageDescription || '-'}</p>
                                    <p className="text-sm text-slate-600 mb-2"><span className="font-semibold text-xs">การดำเนินการ:</span> {job.repairGroup}</p>
                                    
                                    {/* Cost Summary in Timeline */}
                                    {job.costs && job.costs.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-slate-200 flex justify-between items-center">
                                            <span className="text-xs text-slate-500">ค่าใช้จ่ายรวม</span>
                                            <span className="text-sm font-bold text-slate-700">
                                                {job.costs.reduce((sum, c) => sum + c.totalPrice, 0).toLocaleString()} บาท
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                    <HistoryIcon size={64} className="mb-4 opacity-20" />
                    <p className="text-lg">เลือกรหัสทรัพย์สินเพื่อดูไทม์ไลน์ประวัติการซ่อม</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default History;
