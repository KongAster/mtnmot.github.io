
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, User as UserIcon, Loader2, ArrowRight, KeyRound } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import { useNotification } from '../contexts/NotificationContext';
import { toSystemEmail } from '../types';
import { dataService } from '../services/dataService';

const Login: React.FC = () => {
  const { login } = useAuth();
  const { notify } = useNotification();
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'CHANGE_PW'>('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
      const lastEmail = localStorage.getItem('last_email');
      if (lastEmail) setUsername(lastEmail);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (authMode === 'LOGIN') localStorage.setItem('last_email', username);
      const authEmail = toSystemEmail(username).toLowerCase();

      if (isSupabaseConfigured()) {
        if (authMode === 'REGISTER') {
            const { error } = await supabase.auth.signUp({ email: authEmail, password: password, options: { data: { role: 'TECHNICIAN' } } });
            if (error) throw error;
            try { await dataService.saveUserRole({ email: authEmail, role: 'TECHNICIAN' }); } catch (saveError) { console.warn("Auto-save role failed", saveError); }
            notify(authEmail.includes('maintenance.local') ? 'สร้างบัญชีสำเร็จ! (Username Mode) กรุณาเข้าสู่ระบบ' : 'สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมล', 'success');
            setAuthMode('LOGIN'); setPassword(''); 
        } else if (authMode === 'CHANGE_PW') {
            const { error: loginError } = await supabase.auth.signInWithPassword({ email: authEmail, password: password });
            if (loginError) throw new Error('รหัสผ่านเดิมไม่ถูกต้อง');
            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;
            await supabase.auth.signOut();
            notify('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว กรุณาเข้าสู่ระบบใหม่', 'success');
            setAuthMode('LOGIN'); setPassword(''); setNewPassword('');
        } else {
            await login(username, password);
        }
      } else {
        if (authMode === 'REGISTER') {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            if (users.find((u: any) => u.username === username)) throw new Error('ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว');
            users.push({ username, password, role: 'TECHNICIAN' });
            localStorage.setItem('users', JSON.stringify(users));
            notify('สมัครสมาชิกสำเร็จ (โหมดจำลอง)', 'success');
            setAuthMode('LOGIN'); setPassword('');
        } else if (authMode === 'CHANGE_PW') {
             const users = JSON.parse(localStorage.getItem('users') || '[]');
             const userIndex = users.findIndex((u: any) => u.username === username && u.password === password);
             if (userIndex === -1) {
                 if (username === 'Admin' && password === 'Admin') throw new Error('ไม่สามารถเปลี่ยนรหัส Admin ในโหมดจำลองได้');
                 throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านเดิมไม่ถูกต้อง');
             }
             users[userIndex].password = newPassword;
             localStorage.setItem('users', JSON.stringify(users));
             notify('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
             setAuthMode('LOGIN'); setPassword(''); setNewPassword('');
        } else {
            await login(username, password);
        }
      }
    } catch (err: any) {
      notify(err.message || 'เกิดข้อผิดพลาด', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-600 p-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white opacity-10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-[30rem] h-[30rem] bg-pink-500 opacity-20 rounded-full blur-3xl translate-x-1/3 translate-y-1/3"></div>
        <div className="bg-white/95 backdrop-blur-xl p-8 md:p-10 rounded-3xl shadow-2xl w-full max-w-md animate-fade-in-up border border-white/50 relative z-10">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-blue-500 text-white mb-6 shadow-lg shadow-brand-500/40"><UserIcon size={32} /></div>
                <h1 className="text-3xl font-bold text-slate-800 mb-2">ยินดีต้อนรับ</h1>
                <p className="text-slate-500">ระบบทะเบียนแจ้งซ่อมและบริหารจัดการงานบำรุงรักษา</p>
                <div className="flex justify-center items-center gap-2 mt-4">
                    {isSupabaseConfigured() ? <span className="flex items-center gap-1.5 text-xs font-semibold bg-green-50 text-green-700 px-3 py-1 rounded-full border border-green-200"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>ระบบออนไลน์</span> : <span className="flex items-center gap-1.5 text-xs font-semibold bg-slate-100 text-slate-600 px-3 py-1 rounded-full"><span className="w-2 h-2 rounded-full bg-slate-400"></span>โหมดออฟไลน์</span>}
                </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div><label className="block text-sm font-semibold text-slate-700 mb-2">ชื่อผู้ใช้งาน (Username)</label><div className="relative group"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-600"><UserIcon size={20} className="text-slate-400" /></div><input type="text" className="block w-full pl-10 pr-3 py-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none" placeholder="ระบุชื่อผู้ใช้งาน" value={username} onChange={(e) => setUsername(e.target.value)} required/></div></div>
                <div><label className="block text-sm font-semibold text-slate-700 mb-2">{authMode === 'CHANGE_PW' ? 'รหัสผ่านเดิม' : 'รหัสผ่าน'}</label><div className="relative group"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-600"><Lock size={20} className="text-slate-400" /></div><input type="password" className="block w-full pl-10 pr-3 py-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none" placeholder="ระบุรหัสผ่าน" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}/></div></div>
                {authMode === 'CHANGE_PW' && (<div><label className="block text-sm font-semibold text-slate-700 mb-2">รหัสผ่านใหม่</label><div className="relative group"><div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-600"><KeyRound size={20} className="text-slate-400" /></div><input type="password" className="block w-full pl-10 pr-3 py-3.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all outline-none" placeholder="ระบุรหัสผ่านใหม่" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6}/></div></div>)}
                <button type="submit" disabled={isLoading} className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-brand-500/30 text-sm font-bold text-white bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 transition-all transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none">{isLoading ? <Loader2 className="animate-spin" /> : <>{authMode === 'REGISTER' ? 'สร้างบัญชีผู้ใช้' : authMode === 'CHANGE_PW' ? 'ยืนยันเปลี่ยนรหัสผ่าน' : 'เข้าสู่ระบบ'} <ArrowRight size={18} className="ml-2" /></>}</button>
                <div className="mt-6 flex flex-col gap-2 text-center">
                    {authMode !== 'CHANGE_PW' && (<button type="button" onClick={() => { setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setPassword(''); }} className="text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors">{authMode === 'LOGIN' ? "ยังไม่มีบัญชี? สมัครสมาชิก (สร้าง Username)" : 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ'}</button>)}
                    {authMode === 'LOGIN' && (<button type="button" onClick={() => { setAuthMode('CHANGE_PW'); setPassword(''); }} className="text-xs text-slate-400 hover:text-slate-600 underline">ต้องการเปลี่ยนรหัสผ่าน?</button>)}
                    {authMode === 'CHANGE_PW' && (<button type="button" onClick={() => { setAuthMode('LOGIN'); setPassword(''); setNewPassword(''); }} className="text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors">กลับไปหน้าเข้าสู่ระบบ</button>)}
                </div>
            </form>
        </div>
        <div className="absolute bottom-4 text-white/50 text-xs text-center"><p>© 2026 Maintenance Registry System. All rights reserved.</p><p className="mt-1">This web app create by PEERAPAT PANSUMA</p></div>
    </div>
  );
};

export default Login;
