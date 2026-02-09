import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, formatUsername, toSystemEmail, ROLE_LABELS } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useNotification } from './NotificationContext';
import { dataService } from '../services/dataService'; 

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  updatePassword: (password: string) => Promise<void>;
  updateUsername: (newUsername: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { notify } = useNotification();

  // Helper to determine role from DB if available with Caching Strategy
  // Returns: UserRole or null (if not found in DB or error)
  const fetchUserRole = async (email: string): Promise<UserRole | null> => {
      try {
          // 1. Try fetching from Database with Timeout
          // IMPORTANT: Use lowercased email to ensure matching
          const rolePromise = supabase
            .from('user_roles')
            .select('role')
            .eq('email', email.toLowerCase())
            .single();
          
          const { data } = await Promise.race([
              rolePromise,
              // Relaxed timeout to 5s to allow wake-up time, relying on cache if this fails
              new Promise<any>((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 5000))
          ]);
          
          if (data && data.role) {
              // SUCCESS: Cache the fresh role
              localStorage.setItem('cached_role', data.role);
              localStorage.setItem('cached_email', email.toLowerCase());
              return data.role as UserRole;
          }
      } catch (err) {
          console.warn("DB Role fetch failed/timed out, checking cache...", err);
      }

      // 2. Fallback: Check Local Cache if DB failed
      // This prevents downgrading to TECHNICIAN if the network blips or DB sleeps
      const cachedRole = localStorage.getItem('cached_role');
      const cachedEmail = localStorage.getItem('cached_email');
      
      if (cachedRole && cachedEmail === email.toLowerCase()) {
          return cachedRole as UserRole;
      }

      // 3. Return null if absolutely not found in DB/Cache
      return null; 
  };

  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      // Logic to run authentication check
      const runAuthCheck = async () => {
          if (isSupabaseConfigured()) {
            // Supabase Session Check
            const { data, error } = await supabase.auth.getSession();
            
            if (!error && data.session?.user && data.session.user.email) {
               const email = data.session.user.email;
               
               // Fetch real-time role from public table
               const dbRole = await fetchUserRole(email);
               // Get fallback role from Auth Metadata (usually 'TECHNICIAN' from registration)
               const metaRole = data.session.user.user_metadata.role as UserRole;
               
               // LOGIC FIX: Trust DB Role > Meta Role > Default
               // If dbRole exists (not null), use it. Even if it is 'TECHNICIAN'.
               // If dbRole is null (fetch failed/not found), fallback to metaRole.
               const finalRole = dbRole || metaRole || 'TECHNICIAN';

               if (isMounted) {
                   setUser({ 
                       username: formatUsername(email), 
                       role: finalRole
                   });
               }

               // AUTO-SYNC: If DB says X but Metadata says Y, update Metadata silently
               // This ensures future sessions have the correct metadata even if DB is offline
               if (dbRole && dbRole !== metaRole) {
                   console.log(`Syncing role metadata: ${metaRole} -> ${dbRole}`);
                   supabase.auth.updateUser({ data: { role: dbRole } });
               }
            }
          } else {
            // LocalStorage Fallback Check
            const stored = localStorage.getItem('auth_user');
            if (stored && isMounted) {
                try {
                    setUser(JSON.parse(stored));
                } catch (e) {
                    console.error("Local auth parsing error", e);
                    localStorage.removeItem('auth_user');
                }
            }
          }
      };

      try {
          // RACE CONDITION FIX:
          // Race auth check against timeout.
          await Promise.race([
              runAuthCheck(),
              new Promise((resolve) => setTimeout(resolve, 3000))
          ]);
      } catch (err) {
          console.error("Auth init warning:", err);
      } finally {
          if (isMounted) setLoading(false);
      }
    };

    initializeAuth();
    
    // Listen for auth changes if using Supabase
    let subscription: any = null;
    let roleSubscription: any = null;

    if (isSupabaseConfigured()) {
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user && session.user.email) {
                const email = session.user.email;
                const dbRole = await fetchUserRole(email);
                const metaRole = session.user.user_metadata.role as UserRole;
                const finalRole = dbRole || metaRole || 'TECHNICIAN';
                
                if (isMounted) {
                    setUser(prev => {
                        if (prev && prev.username === formatUsername(email) && prev.role === finalRole) {
                            return prev;
                        }
                        return { 
                            username: formatUsername(email), 
                            role: finalRole
                        };
                    });
                }
            } else if (event === 'SIGNED_OUT') {
                localStorage.removeItem('cached_role');
                localStorage.removeItem('cached_email');
                if (isMounted) setUser(null);
            } else {
                if (isMounted) setUser(null);
            }
            if (isMounted) setLoading(false); 
        });
        subscription = data.subscription;

        // --- NEW: Real-time User Role Updates (Immediate Effect) ---
        // Listens to changes in the 'user_roles' table.
        try {
            roleSubscription = supabase
                .channel('public:user_roles')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, (payload) => {
                    const newRecord = payload.new as any;
                    
                    // Or retrieve current user from Supabase session directly to be safe
                    supabase.auth.getSession().then(({data}) => {
                         const currentUserEmail = data.session?.user.email;
                         // Compare emails using lowercase to be safe
                         if (currentUserEmail && newRecord && newRecord.email.toLowerCase() === currentUserEmail.toLowerCase()) {
                             console.log("Role updated remotely:", newRecord.role);
                             // Update Cache
                             localStorage.setItem('cached_role', newRecord.role);
                             // Update State
                             setUser(prev => prev ? { ...prev, role: newRecord.role } : null);
                             // Sync Metadata immediately
                             supabase.auth.updateUser({ data: { role: newRecord.role } });
                         }
                    });
                })
                .subscribe();
        } catch (e) {
            console.warn("Realtime role subscription failed", e);
        }
    }

    return () => { 
        isMounted = false;
        if (subscription) subscription.unsubscribe();
        if (roleSubscription) supabase.removeChannel(roleSubscription);
    };
  }, []);

  const login = async (usernameInput: string, password: string) => {
    if (isSupabaseConfigured()) {
        const email = toSystemEmail(usernameInput);
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        if (error) {
            notify('เข้าสู่ระบบไม่สำเร็จ: ตรวจสอบชื่อผู้ใช้/รหัสผ่าน', 'error');
            throw error;
        }
        notify('เข้าสู่ระบบสำเร็จ', 'success');
        
        // Post-login check: Immediately try to sync metadata if role differs
        // This runs in background
        fetchUserRole(email).then(dbRole => {
            if (dbRole) {
                supabase.auth.updateUser({ data: { role: dbRole } });
            }
        });

    } else {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const username = formatUsername(usernameInput);
        let validUser = false;
        let role: UserRole = 'TECHNICIAN';

        if (username.toLowerCase().includes('dev')) {
            validUser = true; role = 'SYSTEM_ADMIN';
        } else if (username.toLowerCase().includes('admin')) {
            validUser = true; role = 'DEPT_ADMIN';
        } else if (username.toLowerCase().includes('head')) {
            validUser = true; role = 'HEAD';
        } else if (username.toLowerCase().includes('tech')) {
            validUser = true; role = 'TECHNICIAN';
        }
        
        if (!validUser) {
            const users = JSON.parse(localStorage.getItem('users') || '[]');
            const foundUser = users.find((u: any) => u.username === username && u.password === password);
            if (foundUser) {
                validUser = true;
                role = foundUser.role || 'DEPT_ADMIN';
            }
        } else {
            if (password !== '123456' && password !== 'admin' && password !== 'Admin') {
                validUser = false;
            }
        }

        if (validUser) {
            const userObj: User = { username, role };
            localStorage.setItem('auth_user', JSON.stringify(userObj));
            setUser(userObj);
            notify(`ยินดีต้อนรับ (${ROLE_LABELS[role]})`, 'success');
        } else {
            notify('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง (ลองใช้รหัส: 123456)', 'error');
            throw new Error('Invalid credentials');
        }
    }
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
        await supabase.auth.signOut();
    }
    localStorage.removeItem('auth_user');
    // Clear role cache on logout
    localStorage.removeItem('cached_role');
    localStorage.removeItem('cached_email');
    
    setUser(null);
    notify('ออกจากระบบแล้ว', 'info');
  };

  const updatePassword = async (newPassword: string) => {
      if (isSupabaseConfigured()) {
          const { error } = await supabase.auth.updateUser({ password: newPassword });
          if (error) throw error;
      } else {
          if (!user) throw new Error('Not logged in');
          
          const users = JSON.parse(localStorage.getItem('users') || '[]');
          const updatedUsers = users.map((u: any) => {
             if (u.username === user.username) {
                 return { ...u, password: newPassword };
             }
             return u;
          });
          
          localStorage.setItem('users', JSON.stringify(updatedUsers));
      }
      notify('เปลี่ยนรหัสผ่านสำเร็จ', 'success');
  };

  const updateUsername = async (newUsername: string) => {
      if (!user) throw new Error("Not logged in");

      if (isSupabaseConfigured()) {
          const newEmail = toSystemEmail(newUsername);
          
          const { error } = await supabase.auth.updateUser({ email: newEmail });
          if (error) throw error;

          try {
              await dataService.saveUserRole({ email: newEmail, role: user.role });
              // Update Cache
              localStorage.setItem('cached_email', newEmail.toLowerCase());
          } catch (e) {
              console.warn("Could not sync role to new email", e);
          }
          
          setUser({ ...user, username: newUsername });
          notify('อัปเดตชื่อผู้ใช้งานสำเร็จ (กรุณาใช้ชื่อใหม่ในการเข้าสู่ระบบครั้งถัดไป)', 'success');
          
      } else {
          const users = JSON.parse(localStorage.getItem('users') || '[]');
          
          if (users.some((u: any) => u.username === newUsername && u.username !== user.username)) {
              throw new Error("ชื่อผู้ใช้งานนี้มีอยู่แล้ว");
          }

          const updatedUsers = users.map((u: any) => {
             if (u.username === user.username) {
                 return { ...u, username: newUsername };
             }
             return u;
          });
          
          localStorage.setItem('users', JSON.stringify(updatedUsers));
          
          const newUser = { ...user, username: newUsername };
          localStorage.setItem('auth_user', JSON.stringify(newUser));
          setUser(newUser);
          notify('อัปเดตชื่อผู้ใช้งานสำเร็จ', 'success');
      }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updatePassword, updateUsername }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};