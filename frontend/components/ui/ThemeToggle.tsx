'use client';

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for saved preference - dark is default
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'light') {
      setIsLight(true);
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    const newIsLight = !isLight;
    setIsLight(newIsLight);

    if (newIsLight) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className="w-[100px] h-[40px] border-2 border-[var(--border-color)] bg-[var(--bg-card)]"
        aria-label="Toggle theme"
      />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-2 px-3 py-2 border-2 border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--bg-secondary)] transition-all font-bold uppercase text-xs tracking-wider"
      aria-label={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
    >
      <span className="text-[var(--text-primary)]">
        {isLight ? '[ DARK ]' : '[ LIGHT ]'}
      </span>
    </button>
  );
}
