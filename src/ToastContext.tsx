import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useTheme } from './ThemeContext';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  toast: {
    success: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
  };
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { config, theme } = useTheme();

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success', title?: string, duration = 3500) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, message, title, type, duration };
      
      setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 toasts

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toastHelpers = {
    success: (message: string, title?: string) => showToast(message, 'success', title),
    info: (message: string, title?: string) => showToast(message, 'info', title),
    warning: (message: string, title?: string) => showToast(message, 'warning', title),
    error: (message: string, title?: string) => showToast(message, 'error', title),
  };

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-cyan-400 shrink-0" />;
    }
  };

  const getTypeStyle = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/30 bg-emerald-950/80 text-emerald-100 shadow-[0_0_20px_rgba(16,185,129,0.15)]';
      case 'error':
        return 'border-rose-500/30 bg-rose-950/80 text-rose-100 shadow-[0_0_20px_rgba(244,63,94,0.15)]';
      case 'warning':
        return 'border-amber-500/30 bg-amber-950/80 text-amber-100 shadow-[0_0_20px_rgba(245,158,11,0.15)]';
      case 'info':
      default:
        return 'border-cyan-500/30 bg-cyan-950/80 text-cyan-100 shadow-[0_0_20px_rgba(6,182,212,0.15)]';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, toast: toastHelpers, removeToast }}>
      {children}
      
      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9, transition: { duration: 0.2 } }}
              className={`pointer-events-auto relative p-4 rounded-2xl border backdrop-blur-xl shadow-2xl flex items-start gap-3.5 ${
                theme === 'light'
                  ? 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300/50'
                  : getTypeStyle(t.type)
              }`}
            >
              {getIcon(t.type)}
              
              <div className="flex-1 min-w-0 pr-2">
                {t.title && (
                  <h4 className="text-xs font-bold tracking-tight mb-0.5 capitalize">
                    {t.title}
                  </h4>
                )}
                <p className="text-xs font-medium leading-relaxed break-words">
                  {t.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
