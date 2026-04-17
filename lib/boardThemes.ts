'use client';

import { useState, useEffect } from 'react';

export interface BoardTheme {
  id: string;
  name: string;
  icon: string;
  light: string;
  dark: string;
  lightStyle?: Record<string, string>;
  darkStyle?: Record<string, string>;
}

function svgUri(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

const shanyrakSvg = (c: string, o: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60"><circle cx="30" cy="30" r="14" fill="none" stroke="${c}" stroke-width="1" opacity="${o}"/><circle cx="30" cy="30" r="6" fill="none" stroke="${c}" stroke-width="0.8" opacity="${o}"/><line x1="30" y1="16" x2="30" y2="2" stroke="${c}" stroke-width="0.7" opacity="${o*0.6}"/><line x1="30" y1="44" x2="30" y2="58" stroke="${c}" stroke-width="0.7" opacity="${o*0.6}"/><line x1="16" y1="30" x2="2" y2="30" stroke="${c}" stroke-width="0.7" opacity="${o*0.6}"/><line x1="44" y1="30" x2="58" y2="30" stroke="${c}" stroke-width="0.7" opacity="${o*0.6}"/><line x1="20" y1="20" x2="8" y2="8" stroke="${c}" stroke-width="0.5" opacity="${o*0.4}"/><line x1="40" y1="20" x2="52" y2="8" stroke="${c}" stroke-width="0.5" opacity="${o*0.4}"/><line x1="20" y1="40" x2="8" y2="52" stroke="${c}" stroke-width="0.5" opacity="${o*0.4}"/><line x1="40" y1="40" x2="52" y2="52" stroke="${c}" stroke-width="0.5" opacity="${o*0.4}"/><path d="M23,23 Q30,18 37,23 Q42,30 37,37 Q30,42 23,37 Q18,30 23,23Z" fill="none" stroke="${c}" stroke-width="0.6" opacity="${o*0.5}"/></svg>`;

const syrmakSvg = (c: string, o: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50"><path d="M25,5 C32,14 38,14 45,5" fill="none" stroke="${c}" stroke-width="1.2" opacity="${o}" stroke-linecap="round"/><path d="M5,25 C14,18 14,12 5,5" fill="none" stroke="${c}" stroke-width="1.2" opacity="${o}" stroke-linecap="round"/><path d="M25,45 C18,36 12,36 5,45" fill="none" stroke="${c}" stroke-width="1.2" opacity="${o}" stroke-linecap="round"/><path d="M45,25 C36,32 36,38 45,45" fill="none" stroke="${c}" stroke-width="1.2" opacity="${o}" stroke-linecap="round"/><circle cx="25" cy="25" r="3.5" fill="${c}" opacity="${o*0.25}"/><path d="M17,17 Q25,12 33,17 Q38,25 33,33 Q25,38 17,33 Q12,25 17,17Z" fill="none" stroke="${c}" stroke-width="0.8" opacity="${o*0.5}"/></svg>`;

const koktuSvg = (c: string, o: number) => `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><path d="M28,6 C33,16 38,16 44,10 C38,20 42,26 50,28 C42,30 38,36 44,46 C38,40 33,40 28,50 C23,40 18,40 12,46 C18,36 14,30 6,28 C14,26 18,20 12,10 C18,16 23,16 28,6Z" fill="none" stroke="${c}" stroke-width="1.2" opacity="${o}"/><circle cx="28" cy="28" r="5" fill="none" stroke="${c}" stroke-width="0.8" opacity="${o*0.6}"/><circle cx="28" cy="28" r="2" fill="${c}" opacity="${o*0.3}"/></svg>`;

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'classic', name: 'Классика', icon: '🟤', light: '#f0d9b5', dark: '#b58863' },
  { id: 'chesscom', name: 'Chess.com', icon: '🟢', light: '#eeeed2', dark: '#769656' },
  { id: 'ocean', name: 'Океан', icon: '🔵', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'hodkonem', name: 'Ход Конём', icon: '🟣', light: '#e8d5f5', dark: '#7c3aed' },
  { id: 'dark', name: 'Тёмная', icon: '⬛', light: '#b0b0b0', dark: '#505050' },
  { id: 'wood', name: 'Дерево', icon: '🪵', light: '#e6cfa7', dark: '#9e7a47' },
  { id: 'ice', name: 'Лёд', icon: '🧊', light: '#e0f0ff', dark: '#6fa8dc' },
  { id: 'rose', name: 'Розовая', icon: '🌸', light: '#fce4ec', dark: '#d48fa3' },
  { id: 'shanyrak', name: 'Шаңырақ', icon: '🏠', light: '#e8d5b8', dark: '#4a2028',
    lightStyle: { backgroundImage: svgUri(shanyrakSvg('#8b6914', 0.25)), backgroundSize: '60px 60px' },
    darkStyle: { backgroundImage: svgUri(shanyrakSvg('#d4a84b', 0.18)), backgroundSize: '60px 60px' },
  },
  { id: 'syrmak', name: 'Сырмақ', icon: '🧶', light: '#d4886a', dark: '#2d1810',
    lightStyle: { backgroundImage: svgUri(syrmakSvg('#5a1e08', 0.22)), backgroundSize: '50px 50px' },
    darkStyle: { backgroundImage: svgUri(syrmakSvg('#d4a843', 0.18)), backgroundSize: '50px 50px' },
  },
  { id: 'koktu', name: 'Көк Ту', icon: '🇰🇿', light: '#f0d060', dark: '#1a65a8',
    lightStyle: { backgroundImage: svgUri(koktuSvg('#a07810', 0.18)), backgroundSize: '56px 56px' },
    darkStyle: { backgroundImage: svgUri(koktuSvg('#f0d060', 0.15)), backgroundSize: '56px 56px' },
  },
];

const STORAGE_KEY = 'hodkonem-board-theme';

export function useBoardTheme() {
  const [themeId, setThemeId] = useState('classic');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setThemeId(saved);
  }, []);

  const setTheme = (id: string) => {
    setThemeId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  const theme = BOARD_THEMES.find(t => t.id === themeId) || BOARD_THEMES[0];

  return { theme, themeId, setTheme };
}
