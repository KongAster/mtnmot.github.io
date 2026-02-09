import React, { useState, useCallback, useRef } from 'react';
import * as tus from 'tus-js-client';
import { JobAttachment } from '../types';
import { UploadCloud, X, Play, Pause, Trash2, FileText, Image as ImageIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '../lib/supabaseClient';

interface ResumableUploaderProps {
  onUploadComplete: (attachment: JobAttachment) => void;
  existingAttachments?: JobAttachment[];
  onRemoveAttachment?: (id: string) => void;
  readOnly?: boolean;
}

interface UploadState {
  file: File;
  upload: any;
  progress: number; // 0-100
  status: 'QUEUED' | 'UPLOADING' | 'PAUSED' | 'COMPLETED' | 'ERROR';
  error?: string;
  speed?: string; // e.g. "1.5 MB/s"
}

// Format bytes to human readable
const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const ResumableUploader: React.FC<ResumableUploaderProps> = ({ onUploadComplete, existingAttachments = [], onRemoveAttachment, readOnly = false }) => {
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const startUpload = async (file: File) => {
    // 1. Get Session for Auth (if needed by RLS, though we usually use anon for public buckets if configured)
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token || SUPABASE_ANON_KEY;

    // 2. Generate Unique Filename
    const ext = file.name.split('.').pop();
    const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
    const bucketName = 'job_attachments';
    
    // NOTE: TUS Endpoint for Supabase
    const endpoint = `${SUPABASE_URL}/storage/v1/upload/resumable`;

    // 3. Create TUS Upload
    // Fix: cast file to any to avoid type mismatch with tus-js-client expecting specific File/Blob type
    const upload = new tus.Upload(file as any, {
        endpoint: endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
            authorization: `Bearer ${token}`,
            'x-client-info': 'supabase-js-web',
        },
        uploadDataDuringCreation: true,
        chunkSize: 6 * 1024 * 1024, // 6MB chunks
        removeFingerprintOnSuccess: true,
        metadata: {
            bucketName: bucketName,
            objectName: uniqueName,
            contentType: file.type || 'application/octet-stream',
            cacheControl: '3600',
        },
        onError: (error: any) => {
            console.error("Upload Failed:", error);
            setUploads(prev => prev.map(u => u.file === file ? { ...u, status: 'ERROR', error: 'Upload Failed' } : u));
        },
        onProgress: (bytesUploaded: number, bytesTotal: number) => {
            const percentage = (bytesUploaded / bytesTotal) * 100;
            setUploads(prev => prev.map(u => u.file === file ? { ...u, progress: percentage, status: 'UPLOADING' } : u));
        },
        onSuccess: () => {
            setUploads(prev => prev.map(u => u.file === file ? { ...u, status: 'COMPLETED', progress: 100 } : u));
            
            // Construct Public URL
            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${uniqueName}`;
            
            const attachment: JobAttachment = {
                id: crypto.randomUUID(),
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                storagePath: `${bucketName}/${uniqueName}`,
                publicUrl: publicUrl,
                uploadedAt: new Date().toISOString()
            };
            onUploadComplete(attachment);
            
            // Auto remove from list after 3s
            setTimeout(() => {
                setUploads(prev => prev.filter(u => u.file !== file));
            }, 3000);
        },
    });

    // Add to state and start
    setUploads(prev => [...prev, { file, upload, progress: 0, status: 'QUEUED' }]);
    upload.start();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          // Explicitly treat e.target.files as FileList and map to array of Files
          Array.from(e.target.files).forEach((file: File) => startUpload(file));
      }
      if (inputRef.current) inputRef.current.value = '';
  };

  const togglePauseResume = (uploadState: UploadState) => {
      if (uploadState.status === 'UPLOADING') {
          uploadState.upload.abort();
          setUploads(prev => prev.map(u => u === uploadState ? { ...u, status: 'PAUSED' } : u));
      } else if (uploadState.status === 'PAUSED' || uploadState.status === 'ERROR') {
          uploadState.upload.start();
          setUploads(prev => prev.map(u => u === uploadState ? { ...u, status: 'UPLOADING', error: undefined } : u));
      }
  };

  const cancelUpload = (uploadState: UploadState) => {
      uploadState.upload.abort();
      setUploads(prev => prev.filter(u => u !== uploadState));
  };

  const getIcon = (type: string) => {
      if (type.startsWith('image/')) return <ImageIcon size={20} className="text-purple-500"/>;
      return <FileText size={20} className="text-blue-500"/>;
  };

  return (
    <div className="space-y-4">
        {/* Drop Zone */}
        {!readOnly && (
            <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:bg-slate-50 transition-colors cursor-pointer group bg-slate-50/50"
                onClick={() => inputRef.current?.click()}
            >
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                    <UploadCloud size={24} />
                </div>
                <p className="text-sm font-bold text-slate-700">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</p>
                <p className="text-xs text-slate-400 mt-1">แนบรูปภาพความเสียหาย, ใบเสนอราคา, หรือเอกสารที่เกี่ยวข้อง (สูงสุด 50MB)</p>
                <div className="flex justify-center gap-2 mt-2">
                    <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">Resumable</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">Chunk Upload</span>
                </div>
                <input 
                    type="file" 
                    multiple 
                    className="hidden" 
                    ref={inputRef} 
                    onChange={handleFileSelect}
                />
            </div>
        )}

        {/* Uploading List */}
        {uploads.length > 0 && (
            <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">กำลังอัปโหลด ({uploads.length})</p>
                {uploads.map((u, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                            {getIcon(u.file.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1">
                                <p className="text-sm font-bold text-slate-700 truncate">{u.file.name}</p>
                                <span className="text-xs text-slate-500 font-mono">{Math.round(u.progress)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-300 ${u.status === 'ERROR' ? 'bg-red-500' : u.status === 'COMPLETED' ? 'bg-green-500' : 'bg-blue-500'}`} 
                                    style={{ width: `${u.progress}%` }}
                                ></div>
                            </div>
                            <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                                <span>{formatBytes(u.file.size)}</span>
                                {u.status === 'ERROR' && <span className="text-red-500 font-bold">{u.error}</span>}
                                {u.status === 'PAUSED' && <span className="text-amber-500 font-bold">Paused</span>}
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {u.status !== 'COMPLETED' && (
                                <button onClick={() => togglePauseResume(u)} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
                                    {u.status === 'UPLOADING' ? <Pause size={16} /> : <Play size={16} />}
                                </button>
                            )}
                            <button onClick={() => cancelUpload(u)} className="p-1.5 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        )}

        {/* Existing Attachments List */}
        {existingAttachments.length > 0 && (
            <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">ไฟล์แนบ ({existingAttachments.length})</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {existingAttachments.map(att => (
                        <div key={att.id} className="group relative bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-start gap-3 hover:border-blue-300 transition-colors">
                            {att.fileType.startsWith('image/') ? (
                                <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200 cursor-pointer" onClick={() => window.open(att.publicUrl, '_blank')}>
                                    <img src={att.publicUrl} alt="preview" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 text-blue-500 cursor-pointer" onClick={() => window.open(att.publicUrl, '_blank')}>
                                    <FileText size={24} />
                                </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                                <a href={att.publicUrl} target="_blank" rel="noreferrer" className="text-sm font-bold text-slate-700 truncate hover:text-blue-600 block mb-0.5">
                                    {att.fileName}
                                </a>
                                <p className="text-[10px] text-slate-400">{formatBytes(att.fileSize)} • {new Date(att.uploadedAt).toLocaleDateString('th-TH')}</p>
                            </div>

                            {!readOnly && onRemoveAttachment && (
                                <button 
                                    onClick={() => onRemoveAttachment(att.id)}
                                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors absolute top-2 right-2 opacity-0 group-hover:opacity-100"
                                    title="ลบไฟล์"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};

export default ResumableUploader;