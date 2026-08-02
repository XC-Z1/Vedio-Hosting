import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeMode = 'obsidian' | 'oled' | 'light' | 'sunset';

export interface ThemeConfig {
  id: ThemeMode;
  name: string;
  tagline: string;
  bgClass: string;
  cardBgClass: string;
  dropzoneBgClass: string;
  headerBgClass: string;
  borderClass: string;
  textPrimary: string;
  textSecondary: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  badgeClass: string;
  buttonPrimary: string;
  buttonSecondary: string;
  glowClass: string;
  thumbnailBorder: string;
}

export const themes: Record<ThemeMode, ThemeConfig> = {
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Emerald',
    tagline: 'Cyber glass luxury with neon emerald accents',
    bgClass: 'bg-[#05080e]',
    cardBgClass: 'bg-[#090d16]',
    dropzoneBgClass: 'bg-gradient-to-b from-[#0c1019] to-[#06080d]',
    headerBgClass: 'bg-[#05080e]/90',
    borderClass: 'border-white/10',
    textPrimary: 'text-white',
    textSecondary: 'text-white/50',
    accentColor: 'text-[#00FF88]',
    accentBg: 'bg-[#00FF88]',
    accentBorder: 'border-[#00FF88]/40',
    badgeClass: 'bg-[#00FF88]/10 text-[#00FF88] border-[#00FF88]/30',
    buttonPrimary: 'bg-[#00FF88] text-black font-semibold hover:shadow-[0_0_25px_rgba(0,255,136,0.4)]',
    buttonSecondary: 'bg-white/10 text-white hover:bg-white/15 border-white/15',
    glowClass: 'bg-[#00FF88]/10',
    thumbnailBorder: 'border-white/10 hover:border-[#00FF88]/50',
  },
  oled: {
    id: 'oled',
    name: 'OLED Midnight Studio',
    tagline: 'Deep black canvas with silver & violet luxury',
    bgClass: 'bg-[#000000]',
    cardBgClass: 'bg-[#09090b]',
    dropzoneBgClass: 'bg-gradient-to-b from-[#0e0e11] to-[#050507]',
    headerBgClass: 'bg-[#000000]/95',
    borderClass: 'border-white/10',
    textPrimary: 'text-white',
    textSecondary: 'text-white/40',
    accentColor: 'text-violet-400',
    accentBg: 'bg-violet-500',
    accentBorder: 'border-violet-500/40',
    badgeClass: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
    buttonPrimary: 'bg-violet-500 text-white font-semibold hover:bg-violet-600 hover:shadow-[0_0_25px_rgba(139,92,246,0.4)]',
    buttonSecondary: 'bg-white/10 text-white hover:bg-white/15 border-white/15',
    glowClass: 'bg-violet-500/10',
    thumbnailBorder: 'border-white/10 hover:border-violet-500/50',
  },
  light: {
    id: 'light',
    name: 'Nordic Light Studio',
    tagline: 'Clean minimalist white canvas with emerald contrast',
    bgClass: 'bg-[#f4f6f9]',
    cardBgClass: 'bg-white',
    dropzoneBgClass: 'bg-gradient-to-b from-white to-slate-50',
    headerBgClass: 'bg-white/90',
    borderClass: 'border-slate-200',
    textPrimary: 'text-slate-900',
    textSecondary: 'text-slate-500',
    accentColor: 'text-emerald-600',
    accentBg: 'bg-emerald-600',
    accentBorder: 'border-emerald-500/40',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    buttonPrimary: 'bg-emerald-600 text-white font-semibold hover:bg-emerald-700 hover:shadow-lg',
    buttonSecondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 border-slate-200',
    glowClass: 'bg-emerald-500/5',
    thumbnailBorder: 'border-slate-200 hover:border-emerald-500/50',
  },
  sunset: {
    id: 'sunset',
    name: 'Cyberpunk Sunset',
    tagline: 'Vibrant dark canvas with warm amber & neon pink',
    bgClass: 'bg-[#0d0914]',
    cardBgClass: 'bg-[#150f24]',
    dropzoneBgClass: 'bg-gradient-to-b from-[#1b122d] to-[#0f0a1a]',
    headerBgClass: 'bg-[#0d0914]/90',
    borderClass: 'border-pink-500/20',
    textPrimary: 'text-amber-50',
    textSecondary: 'text-amber-200/50',
    accentColor: 'text-amber-400',
    accentBg: 'bg-amber-400',
    accentBorder: 'border-amber-400/40',
    badgeClass: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
    buttonPrimary: 'bg-gradient-to-r from-amber-400 to-pink-500 text-black font-semibold hover:shadow-[0_0_25px_rgba(251,191,36,0.4)]',
    buttonSecondary: 'bg-white/10 text-amber-100 hover:bg-white/15 border-white/15',
    glowClass: 'bg-amber-400/10',
    thumbnailBorder: 'border-pink-500/20 hover:border-amber-400/60',
  }
};

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  config: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'sunset',
  setTheme: () => {},
  config: themes.sunset,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('streamshare_ui_theme') as ThemeMode;
    return saved && themes[saved] ? saved : 'sunset';
  });

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem('streamshare_ui_theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.classList.remove('theme-obsidian', 'theme-oled', 'theme-light', 'theme-sunset');
    document.documentElement.classList.add(`theme-${theme}`);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, config: themes[theme] }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
