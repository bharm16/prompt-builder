import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

// Toast Context for managing toasts globally
const ToastContext = createContext();

// Custom hook to use toast functionality
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast Provider Component
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random();
    const toast = { id, message, type, duration };

    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = {
    success: (message, duration) => addToast(message, 'success', duration),
    error: (message, duration) => addToast(message, 'error', duration),
    warning: (message, duration) => addToast(message, 'warning', duration),
    info: (message, duration) => addToast(message, 'info', duration),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

// Toast Container Component
function ToastContainer({ toasts, onRemove }) {
  return (
    <div
      className="fixed top-4 right-4 z-toast flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

// Individual Toast Component
function Toast({ id, message, type, onClose }) {
  const [isExiting, setIsExiting] = useState(false);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(onClose, 200); // Match animation duration
  };

  const config = {
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
