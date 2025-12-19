import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, type LucideIcon } from 'lucide-react';
import { logger } from '../services/LoggingService';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

interface ToastConfig {
  icon: LucideIcon;
  className: string;
  iconClassName: string;
  ariaLabel: string;
}

// Toast Context for managing toasts globally
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Custom hook to use toast functionality
export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

// Toast Provider Component
export function ToastProvider({ children }: ToastProviderProps): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const log = logger.child('ToastProvider');

  const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 4000): number => {
    const id = Date.now() + Math.random();
    const toast: Toast = { id, message, type, duration };

    log.debug('Toast created', { 
      type, 
      messageLength: message.length,
      duration,
      toastCount: toasts.length + 1,
    });

    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, [log, toasts.length]);

  const removeToast = useCallback((id: number): void => {
    log.debug('Toast removed', { id });
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, [log]);

  const toast: ToastContextValue = {
    success: (message: string, duration?: number) => addToast(message, 'success', duration),
    error: (message: string, duration?: number) => addToast(message, 'error', duration),
    warning: (message: string, duration?: number) => addToast(message, 'warning', duration),
    info: (message: string, duration?: number) => addToast(message, 'info', duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: number) => void;
}

// Toast Container Component
function ToastContainer({ toasts, onRemove }: ToastContainerProps): React.ReactElement {
  return (
    <div
      className="fixed top-4 right-4 z-toast flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onClose={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  id: number;
  message: string;
  type: ToastType;
  onClose: () => void;
}

// Individual Toast Component
function ToastItem({ id, message, type, onClose }: ToastItemProps): React.ReactElement {
  const [isExiting, setIsExiting] = useState(false);
  const log = logger.child('ToastItem');

  const handleClose = (): void => {
    log.debug('Toast dismissed by user', { id, type });
    setIsExiting(true);
    setTimeout(onClose, 200); // Match animation duration
  };

  const config: Record<ToastType, ToastConfig> = {
    success: {
      icon: CheckCircle,
      className: 'bg-success-50 border-success-200 text-success-900',
      iconClassName: 'text-success-600',
      ariaLabel: 'Success notification',
    },
    error: {
      icon: AlertCircle,
      className: 'bg-error-50 border-error-200 text-error-900',
      iconClassName: 'text-error-600',
      ariaLabel: 'Error notification',
    },
    warning: {
      icon: AlertTriangle,
      className: 'bg-warning-50 border-warning-200 text-warning-900',
      iconClassName: 'text-warning-600',
      ariaLabel: 'Warning notification',
    },
    info: {
      icon: Info,
      className: 'bg-info-50 border-info-200 text-info-900',
      iconClassName: 'text-info-600',
      ariaLabel: 'Information notification',
    },
  };

  const { icon: Icon, className, iconClassName, ariaLabel } = config[type] || config.info;

  return (
    <div
      className={`
        toast-slide-in pointer-events-auto
        ${isExiting ? 'toast-slide-out' : ''}
      `}
      role="alert"
      aria-label={ariaLabel}
    >
      <div
        className={`
          flex items-start gap-3 px-4 py-3 rounded-lg border-2 shadow-lg
          min-w-[320px] max-w-md
          ${className}
        `}
      >
        <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iconClassName}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-relaxed">{message}</p>
        </div>
        <button
          onClick={handleClose}
          className="flex-shrink-0 p-1 rounded-md hover:bg-black hover:bg-opacity-5 transition-colors duration-150 focus-ring"
          aria-label="Close notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default Toast;

