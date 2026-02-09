import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

export interface Notification {
  id: number;
  message: string;
  type: NotificationType;
  timestamp: Date; // Added timestamp
  read: boolean;
}

interface NotificationContextType {
  notify: (message: string, type?: NotificationType) => void;
  history: Notification[]; // Expose history
  clearHistory: () => void;
  markAllAsRead: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]); // For Toast (Transient)
  const [history, setHistory] = useState<Notification[]>([]); // For History (Persistent in session)

  const notify = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Date.now();
    const newNotif: Notification = { id, message, type, timestamp: new Date(), read: false };
    
    // Add to Toasts
    setNotifications(prev => [...prev, newNotif]);
    
    // Add to History (Limit to last 50)
    setHistory(prev => [newNotif, ...prev].slice(0, 50));
    
    // Auto dismiss Toast only
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  }, []);

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const markAllAsRead = () => {
    setHistory(prev => prev.map(n => ({ ...n, read: true })));
  };

  const unreadCount = history.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notify, history, clearHistory, markAllAsRead, unreadCount }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
        {notifications.map(n => (
          <div 
            key={n.id} 
            className={`pointer-events-auto flex items-center p-4 rounded-lg shadow-lg border-l-4 min-w-[300px] animate-slide-in text-white backdrop-blur-md bg-opacity-95
              ${n.type === 'success' ? 'bg-slate-800 border-green-500' : 
                n.type === 'error' ? 'bg-slate-800 border-red-500' : 
                'bg-slate-800 border-blue-500'}`}
          >
            <div className="mr-3">
              {n.type === 'success' && <CheckCircle size={20} className="text-green-400" />}
              {n.type === 'error' && <AlertCircle size={20} className="text-red-400" />}
              {n.type === 'info' && <Info size={20} className="text-blue-400" />}
            </div>
            <p className="flex-1 text-sm font-medium">{n.message}</p>
            <button onClick={() => removeNotification(n.id)} className="ml-2 text-slate-400 hover:text-white">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within NotificationProvider');
  return context;
};