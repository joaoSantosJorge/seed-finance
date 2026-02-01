'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for saved preference or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);

    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className="w-[120px] h-[40px] border-2 border-[var(--border-color)] bg-[var(--bg-card)]"
        aria-label="Toggle theme"
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="group flex items-center gap-2 px-4 py-2 border-2 border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] transition-all font-bold uppercase text-xs tracking-wider"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="text-[var(--text-primary)]">
        {isDark ? '[ LIGHT ]' : '[ DARK ]'}
      </span>
      <span className="text-[var(--accent)] group-hover:animate-pulse">
        {isDark ? '○' : '●'}
      </span>
    </button>
  );
}
