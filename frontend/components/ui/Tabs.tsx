'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tab components must be used within a Tabs component');
  }
  return context;
}

interface TabsProps {
  defaultValue?: string;
  value?: string;
  children: ReactNode;
  className?: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
}

export function Tabs({ defaultValue, value, children, className, onChange, onValueChange }: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultValue ?? value ?? '');

  // Support both controlled and uncontrolled modes
  const activeTab = value ?? internalTab;

  const handleTabChange = (tab: string) => {
    if (value === undefined) {
      setInternalTab(tab);
    }
    onChange?.(tab);
    onValueChange?.(tab);
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab: handleTabChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center border-2 border-[var(--border-color)]',
        className
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, children, className }: TabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={() => setActiveTab(value)}
      className={cn(
        'px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all border-r-2 border-[var(--border-color)] last:border-r-0',
        isActive
          ? 'bg-[var(--border-color)] text-[var(--bg-primary)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]',
        className
      )}
    >
      {isActive ? <>[ {children} ]</> : children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  const { activeTab } = useTabsContext();

  if (activeTab !== value) return null;

  return (
    <div role="tabpanel" className={className}>
      {children}
    </div>
  );
}
