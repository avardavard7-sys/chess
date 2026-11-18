'use client';
import { useTranslation } from '@/lib/i18n';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export interface BoardTheme {
  id: string;
  name: string;
  light: string;
  dark: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'classic', name: 'Классика', light: '#f0d9b5', dark: '#b58863' },
  { id: 'green', name: 'Зелёная', light: '#ffffdd', dark: '#86a666' },
  { id: 'blue', name: 'Синяя', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'purple', name: 'Фиолетовая', light: '#e8daf0', dark: '#9b72cf' },
  { id: 'brown', name: 'Коричневая', light: '#f0d9b5', dark: '#946f51' },
  { id: 'red', name: 'Красная', light: '#f0d9b5', dark: '#c06060' },
  { id: 'coral', name: 'Коралловая', light: '#ffe4e1', dark: '#cd5c5c' },
  { id: 'orange', name: 'Оранжевая', light: '#ffecd2', dark: '#d2691e' },
  { id: 'pink', name: 'Розовая', light: '#ffe4f0', dark: '#d87093' },
  { id: 'ice', name: 'Ледяная', light: '#e8f4f8', dark: '#4f94b0' },
  { id: 'ocean', name: 'Океан', light: '#d4e8f0', dark: '#3a7ca5' },
  { id: 'forest', name: 'Лесная', light: '#d4e6c3', dark: '#4a7c3f' },
  { id: 'mint', name: 'Мятная', light: '#d5f5e3', dark: '#45b39d' },
  { id: 'wood', name: 'Дерево', light: '#e8c99b', dark: '#a07850' },
  { id: 'marble', name: 'Мрамор', light: '#f5f5f0', dark: '#a8a8a0' },
  { id: 'dark', name: 'Тёмная', light: '#4a4a4a', dark: '#2a2a2a' },
  { id: 'midnight', name: 'Полночь', light: '#3d4f6f', dark: '#262f3f' },
  { id: 'chess_com', name: 'Chess.com', light: '#eeeed2', dark: '#769656' },
  { id: 'lichess', name: 'Lichess', light: '#f0d9b5', dark: '#b58863' },
  { id: 'tournament', name: 'Турнирная', light: '#e0c8a8', dark: '#7b5b3a' },
  { id: 'gold', name: 'Золотая', light: '#fff8e1', dark: '#c8a960' },
  { id: 'neon', name: 'Неон', light: '#1a1a2e', dark: '#16213e' },
  { id: 'kids', name: 'Детская', light: '#fce7f3', dark: '#a78bfa' },
];

export function getStoredTheme(): BoardTheme {
  if (typeof window === 'undefined') return BOARD_THEMES[0];
  const id = localStorage.getItem('chess-board-theme') || 'classic';
  return BOARD_THEMES.find(t => t.id === id) || BOARD_THEMES[0];
}

export function storeTheme(id: string) {
  localStorage.setItem('chess-board-theme', id);
}

export function getStored3D(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('chess-3d-pieces') === 'true';
}

export function store3D(val: boolean) {
  localStorage.setItem('chess-3d-pieces', val ? 'true' : 'false');
}

interface BoardSettingsProps {
  onThemeChange: (theme: BoardTheme) => void;
  on3DChange?: (enabled: boolean) => void;
}

export default function BoardSettings({ onThemeChange, on3DChange }: BoardSettingsProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<string>('classic');
  const [is3D, setIs3D] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setCurrent(getStoredTheme().id);
    setIs3D(getStored3D());
  }, []);

  return (
    <>
      <motion.button onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg border border-white/10 text-white/40 hover:text-white/70 text-xs"
        whileTap={{ scale: 0.95 }}>
        🎨
      </motion.button>

      {isOpen && (
        <motion.div className="absolute bottom-full right-0 mb-2 glass p-4 rounded-xl z-50 w-72"
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs text-white/40 uppercase tracking-wider mb-3">{t('board_theme_label')}</div>
          <div className="grid grid-cols-5 gap-2 mb-4">
            {BOARD_THEMES.map(t => (
              <button key={t.id} onClick={() => {
                setCurrent(t.id); storeTheme(t.id);
                onThemeChange(t);
              }}
                className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all ${current === t.id ? 'border-yellow-400 scale-110' : 'border-transparent hover:border-white/20'}`}
                title={t.name}>
                <div className="w-full h-1/2" style={{ backgroundColor: t.light }} />
                <div className="w-full h-1/2" style={{ backgroundColor: t.dark }} />
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>3D фигуры</span>
            <button onClick={() => {
              const val = !is3D; setIs3D(val); store3D(val);
              on3DChange?.(val);
            }}
              className={`px-3 py-1 rounded-full ${is3D ? 'bg-yellow-400/20 text-yellow-400' : 'bg-white/5 text-white/30'}`}>
              {is3D ? 'ВКЛ' : 'ВЫКЛ'}
            </button>
          </div>
          <div className="text-[10px] text-white/20 mt-2 text-center">{t('current_theme')}: {BOARD_THEMES.find(t => t.id === current)?.name}</div>
        </motion.div>
      )}
    </>
  );
}
