// ============ Notification Types ============
export type NotificationType = 'yield' | 'transaction' | 'milestone' | 'alert';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  actionUrl?: string;
  data?: Record<string, unknown>;
}

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  actionLabel?: string;
  actionUrl?: string;
}
