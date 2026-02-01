'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications, useUnreadCount, useNotificationStore } from '@/stores';
import { formatRelativeTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

const notificationTypeStyles = {
  yield: 'bg-success',
  transaction: 'bg-primary',
  milestone: 'bg-warning',
  alert: 'bg-error',
};

function NotificationItem({ notification }: { notification: Notification }) {
  const { markAsRead } = useNotificationStore();

  const handleClick = () => {
    markAsRead(notification.id);
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full text-left p-3 hover:bg-slate-700/50 transition-colors',
        !notification.read && 'bg-slate-700/30'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'w-2 h-2 rounded-full mt-2 flex-shrink-0',
            notification.read ? 'bg-slate-600' : notificationTypeStyles[notification.type]
          )}
        />
        <div className="flex-1 min-w-0">
          <p className={cn('text-body', notification.read ? 'text-cool-gray' : 'text-white')}>
            {notification.title}
          </p>
          <p className="text-body-sm text-silver mt-0.5 truncate">{notification.message}</p>
          <p className="text-caption text-silver mt-1">
            {formatRelativeTime(notification.timestamp / 1000)}
          </p>
        </div>
      </div>
    </button>
  );
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifications = useNotifications();
  const unreadCount = useUnreadCount();
  const { markAllAsRead } = useNotificationStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-cool-gray hover:text-white transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full text-caption text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-slate-700">
            <h3 className="text-body font-medium text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-body-sm text-primary hover:underline"
              >
                Mark All Read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-700">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-body-sm text-cool-gray">No notifications yet</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 10 && (
            <div className="p-3 border-t border-slate-700 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = '/dashboard/financier/notifications';
                }}
                className="text-body-sm text-primary hover:underline"
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
