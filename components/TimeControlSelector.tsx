'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface TimeControlOption {
  label: string;
  time: string;
  category: 'bullet' | 'blitz' | 'rapid' | 'classical';
  minutes: number;
  increment: number;
}

const TIME_CONTROLS: TimeControlOption[] = [
  // Bullet
  { label: '1 мин', time: '1|0', category: 'bullet', minutes: 1, increment: 0 },
  { label: '1|1', time: '1|1', category: 'bullet', minutes: 1, increment: 1 },
  { label: '2|1', time: '2|1', category: 'bullet', minutes: 2, increment: 1 },
  // Blitz
  { label: '3 мин', time: '3|0', category: 'blitz', minutes: 3, increment: 0 },
  { label: '3|2', time: '3|2', category: 'blitz', minutes: 3, increment: 2 },
  { label: '5 мин', time: '5|0', category: 'blitz', minutes: 5, increment: 0 },
  { label: '5|5', time: '5|5', category: 'blitz', minutes: 5, increment: 5 },
  // Rapid
  { label: '10 мин', time: '10|0', category: 'rapid', minutes: 10, increment: 0 },
  { label: '15|10', time: '15|10', category: 'rapid', minutes: 15, increment: 10 },
  { label: '30 мин', time: '30|0', category: 'rapid', minutes: 30, increment: 0 },
  // Classical
  { label: '60 мин', time: '60|0', category: 'classical', minutes: 60, increment: 0 },
];

const CATEGORY_INFO = {
  bullet: { label: 'Пуля', icon: '⚡', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  blitz: { label: 'Блиц', icon: '🔥', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  rapid: { label: 'Рапид', icon: '⏱️', color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  classical: { label: 'Классика', icon: '♔', color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)' },
};

interface TimeControlSelectorProps {
  onSelect: (time: string, minutes: number, increment: number) => void;
  title?: string;
}

export default function TimeControlSelector({ onSelect, title }: TimeControlSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('blitz');

  const filtered = TIME_CONTROLS.filter(tc => tc.category === selectedCategory);

  return (
    <div className="glass p-6 rounded-2xl max-w-md mx-auto">
      {title && <h3 className="text-lg font-bold text-center mb-4" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{title}</h3>}

      {/* Category tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {Object.entries(CATEGORY_INFO).map(([key, info]) => (
          <button key={key} onClick={() => setSelectedCategory(key)}
            className={`flex-1 py-2.5 px-2 rounded-lg text-xs font-medium transition-all flex flex-col items-center gap-1 ${
              selectedCategory === key ? 'shadow-lg' : 'text-white/40 hover:text-white/60'
            }`}
            style={selectedCategory === key ? { background: info.bg, color: info.color } : {}}>
            <span className="text-lg">{info.icon}</span>
            <span>{info.label}</span>
          </button>
        ))}
      </div>

      {/* Time options */}
      <div className="grid grid-cols-2 gap-3">
        {filtered.map(tc => {
          const cat = CATEGORY_INFO[tc.category];
          return (
            <motion.button key={tc.time} onClick={() => onSelect(tc.time, tc.minutes, tc.increment)}
              className="p-4 rounded-xl text-center transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${cat.color}30` }}
              whileHover={{ scale: 1.05, borderColor: cat.color }}
              whileTap={{ scale: 0.95 }}>
              <div className="text-2xl font-bold" style={{ color: cat.color, fontFamily: "'Playfair Display', serif" }}>
                {tc.label}
              </div>
              {tc.increment > 0 && (
                <div className="text-xs text-white/30 mt-1">+{tc.increment} сек/ход</div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* No timer option */}
      <motion.button onClick={() => onSelect('none', 0, 0)}
        className="w-full mt-3 py-3 rounded-xl text-sm text-white/30 hover:text-white/60 border border-white/10 hover:border-white/20 transition-all"
        whileHover={{ scale: 1.02 }}>
        Без таймера
      </motion.button>
    </div>
  );
}

export { TIME_CONTROLS, CATEGORY_INFO };
export type { TimeControlOption };
