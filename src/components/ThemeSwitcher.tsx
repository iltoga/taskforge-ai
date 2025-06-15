'use client';

import { Check, Palette } from 'lucide-react';
import { useEffect, useState } from 'react';

const themeCategories = {
  'Popular': ['light', 'dark', 'cupcake', 'corporate', 'business'],
  'Colorful': ['bumblebee', 'emerald', 'valentine', 'garden', 'forest', 'aqua'],
  'Creative': ['synthwave', 'retro', 'cyberpunk', 'halloween', 'fantasy', 'wireframe'],
  'Elegant': ['luxury', 'dracula', 'black', 'night', 'coffee', 'winter'],
  'Artistic': ['lofi', 'pastel', 'cmyk', 'autumn', 'acid', 'lemonade'],
};

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    setMounted(true);
    // Get theme from localStorage or default to light
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem('theme') || 'light' : 'light';
    setTheme(storedTheme);

    // Apply theme to document
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', storedTheme);
    }
  }, []);

  const handleThemeChange = (newTheme: string) => {
    if (typeof window === 'undefined') return;

    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);

    // Force re-render of components that depend on theme
    window.dispatchEvent(new Event('storage'));
  };

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="btn btn-ghost gap-2 normal-case">
        <Palette className="w-5 h-5" />
        <span className="hidden md:inline font-medium">Theme</span>
        <svg
          width="12px"
          height="12px"
          className="ml-1 h-3 w-3 fill-current opacity-60"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 2048 2048"
        >
          <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost gap-2 normal-case">
        <Palette className="w-5 h-5" />
        <span className="hidden md:inline font-medium">{theme.charAt(0).toUpperCase() + theme.slice(1)}</span>
        <svg
          width="12px"
          height="12px"
          className="ml-1 h-3 w-3 fill-current opacity-60"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 2048 2048"
        >
          <path d="M1799 349l242 241-1017 1017L7 590l242-241 775 775 775-775z"></path>
        </svg>
      </div>
      <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-64 p-2 shadow-xl border border-base-300 max-h-96 overflow-y-auto">
        <li className="menu-title">
          <span className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Choose Theme
          </span>
        </li>
        {Object.entries(themeCategories).map(([category, themes]) => (
          <li key={category}>
            <div className="text-xs font-medium text-base-content/60 uppercase tracking-wide pt-2 pb-1">
              {category}
            </div>
            <ul className="p-0">
              {themes.map((t: string) => (
                <li key={t}>
                  <a
                    className={`justify-between ${
                      theme === t ? 'active' : ''
                    }`}
                    onClick={() => handleThemeChange(t)}
                  >
                    <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
                    {theme === t && <Check className="w-4 h-4" />}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
