'use client';

import { useToasts, useNotificationStore } from '@/stores';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToastNotification } from '@/types';

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const toastStyles = {
  success: 'bg-success/10 border-success/20 text-success',
  error: 'bg-error/10 border-error/20 text-error',
  warning: 'bg-warning/10 border-warning/20 text-warning',
  info: 'bg-primary/10 border-primary/20 text-primary',
};

function Toast({ toast }: { toast: ToastNotification }) {
  const { removeToast } = useNotificationStore();
  const Icon = toastIcons[toast.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg backdrop-blur-sm',
        'animate-in slide-in-from-right-full duration-300',
        toastStyles[toast.type]
      )}
      role="alert"
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-body font-medium text-white">{toast.title}</p>
        {toast.message && (
          <p className="text-body-sm text-cool-gray mt-0.5">{toast.message}</p>
        )}
        {toast.actionLabel && toast.actionUrl && (
          <a
            href={toast.actionUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-sm text-primary hover:underline mt-2 inline-block"
          >
            {toast.actionLabel}
          </a>
        )}
      </div>
      <button
        onClick={() => removeToast(toast.id)}
        className="p-1 text-cool-gray hover:text-white transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider() {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}
