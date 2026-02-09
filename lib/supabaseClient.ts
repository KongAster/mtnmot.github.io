
import { createClient } from '@supabase/supabase-js';

// =================================================================
// 🌍 Netlify / Production Configuration
// =================================================================

// Default / Local Fallback Keys
// NOTE: Hardcoded keys removed to prevent "Failed to fetch" errors on startup.
// The app will default to "Offline Mode" (LocalStorage) if no .env variables are provided.
const FALLBACK_URL = 'https://llpowjlbaaspvofpjkfc.supabase.co'; 
const FALLBACK_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxscG93amxiYWFzcHZvZnBqa2ZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MDkyNTMsImV4cCI6MjA4MjQ4NTI1M30.uvUfFNV9YoZYHFLzOz3gTk3kyT8EBta897b68JyoS_E';

const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_URL = envUrl || FALLBACK_URL || '';
export const SUPABASE_ANON_KEY = envKey || FALLBACK_ANON_KEY || '';

// ฟังก์ชันตรวจสอบสถานะการเชื่อมต่อ
export const isSupabaseConfigured = () => {
    return !!SUPABASE_URL && 
           !!SUPABASE_ANON_KEY && 
           SUPABASE_URL.length > 20 && 
           !SUPABASE_URL.includes('placeholder') &&
           SUPABASE_URL.startsWith('https://');
};

// สร้างการเชื่อมต่อ Supabase Client
export const supabase = createClient(
    isSupabaseConfigured() ? SUPABASE_URL : 'https://placeholder-project.supabase.co', 
    isSupabaseConfigured() ? SUPABASE_ANON_KEY : 'placeholder-key', 
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);
