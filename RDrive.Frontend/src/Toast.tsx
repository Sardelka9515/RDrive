import { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

interface Toast {
    id: number;
    message: string;
    type: 'error' | 'success' | 'info';
}

interface ToastContextType {
    showError: (message: string) => void;
    showSuccess: (message: string) => void;
    showInfo: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const idRef = useRef(0);

    const addToast = useCallback((message: string, type: Toast['type']) => {
        const id = ++idRef.current;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showError = useCallback((msg: string) => addToast(msg, 'error'), [addToast]);
    const showSuccess = useCallback((msg: string) => addToast(msg, 'success'), [addToast]);
    const showInfo = useCallback((msg: string) => addToast(msg, 'info'), [addToast]);

    const colors = {
        error: 'bg-red-600',
        success: 'bg-green-600',
        info: 'bg-blue-600',
    };

    const icons = {
        error: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        success: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        info: (
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
    };

    return (
        <ToastContext.Provider value={{ showError, showSuccess, showInfo }}>
            {children}
            {/* Toast container */}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`${colors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in cursor-pointer`}
                        onClick={() => dismiss(toast.id)}
                    >
                        {icons[toast.type]}
                        <span className="text-sm">{toast.message}</span>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
