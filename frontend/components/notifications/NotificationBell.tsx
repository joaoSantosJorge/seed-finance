'use client';

import { useState, useRef, useEffect } from 'react';
import { useNotifications, useUnreadCount, useNotificationStore } from '@/stores';
import { formatRelativeTime } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

const notificationTypePrefixes = {
  yield: '[+]',
  transaction: '[>]',
  milestone: '[*]',
  alert: '[!]',
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
        'w-full text-left p-3 hover:bg-[var(--bg-secondary)] transition-colors border-b-2 border-[var(--border-color)] last:border-b-0',
        !notification.read && 'bg-[var(--bg-secondary)]'
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn(
          'text-xs font-bold',
          notification.read ? 'text-[var(--text-muted)]' : 'text-[var(--accent)]'
        )}>
          {notificationTypePrefixes[notification.type]}
        </span>
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs font-bold', notification.read ? 'text-[var(--text-muted)]' : 'text-[var(--text-primary)]')}>
            {notification.title}
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 truncate">{notification.message}</p>
          <p className="text-[10px] text-[var(--text-muted)] mt-1 uppercase tracking-wider">
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
        className="px-3 py-2 border-2 border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] transition-colors text-xs font-bold"
        aria-label="Notifications"
      >
        <span className="text-[var(--text-primary)]">ALERTS</span>
        {unreadCount > 0 && (
          <span className="ml-2 text-[var(--accent)]">
            [{unreadCount > 9 ? '9+' : unreadCount}]
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[var(--bg-card)] border-2 border-[var(--border-color)] z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b-2 border-[var(--border-color)]">
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">-- NOTIFICATIONS --</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-bold text-[var(--accent)] hover:underline"
              >
                [CLEAR]
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-xs text-[var(--text-muted)]">NO NOTIFICATIONS</p>
              </div>
            ) : (
              notifications.slice(0, 10).map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 10 && (
            <div className="p-3 border-t-2 border-[var(--border-color)] text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  window.location.href = '/dashboard/financier/notifications';
                }}
                className="text-xs font-bold text-[var(--accent)] hover:underline"
              >
                [VIEW ALL]
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
