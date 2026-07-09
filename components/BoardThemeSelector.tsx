'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/lib/i18n';
import { BOARD_THEMES, type BoardTheme } from '@/lib/boardThemes';

interface BoardThemeSelectorProps {
  currentThemeId: string;
  onSelect: (id: string) => void;
}

export default function BoardThemeSelector({ currentThemeId, onSelect }: BoardThemeSelectorProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-1.5 rounded-xl text-xs font-medium border border-white/10 text-white/40 hover:text-white/70 transition-all">
        🎨 Доска
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <motion.div className="absolute bottom-full mb-2 right-0 z-50 p-3 rounded-xl min-w-[200px]"
              style={{ background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}
              initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}>
              <div className="text-xs text-white/30 mb-2">{t("board_theme_label")}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {BOARD_THEMES.filter(t => !['shanyrak','syrmak','koktu'].includes(t.id)).map(t => (
                  <button key={t.id} onClick={() => { onSelect(t.id); setIsOpen(false); }}
                    className={`flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all ${currentThemeId === t.id ? 'bg-yellow-400/15 border border-yellow-400/30 text-yellow-400' : 'hover:bg-white/5 text-white/60 border border-transparent'}`}>
                    <div className="flex gap-0.5 flex-shrink-0">
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.light }} />
                      <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: t.dark }} />
                    </div>
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
              <div className="text-xs text-yellow-400/40 mt-2.5 mb-1.5 flex items-center gap-1">
                <span>🇰🇿</span> Қазақ оюлары
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {BOARD_THEMES.filter(t => ['shanyrak','syrmak','koktu'].includes(t.id)).map(t => (
                  <button key={t.id} onClick={() => { onSelect(t.id); setIsOpen(false); }}
                    className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs transition-all ${currentThemeId === t.id ? 'bg-yellow-400/15 border border-yellow-400/30 text-yellow-400' : 'hover:bg-white/5 text-white/60 border border-transparent'}`}>
                    <div className="flex gap-0.5">
                      <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: t.light }} />
                      <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: t.dark }} />
                    </div>
                    <span className="truncate text-[10px]">{t.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
