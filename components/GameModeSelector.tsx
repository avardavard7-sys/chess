'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import type { Difficulty, GameMode } from '@/store/gameStore';
import { DIFFICULTY_CONFIG } from '@/lib/stockfish';

interface GameModeSelectorProps {
  difficulty: Difficulty;
  onBack: () => void;
}

const modes = [
  {
    id: 'ai' as GameMode,
    icon: '🤖',
    title: 'Игра с Hod Konem AI',
    desc: 'Сразитесь с умным компьютерным соперником на выбранном уровне сложности',
    gradient: 'linear-gradient(135deg, #7c3aed, #2563eb)',
    shadow: 'rgba(124, 58, 237, 0.5)',
    href: (d: Difficulty) => `/game/${d}`,
  },
  {
    id: 'local' as GameMode,
    icon: '👥',
    title: 'Игра вдвоём',
    desc: 'Играйте вдвоём на одном экране, по очереди делая ходы',
    gradient: 'linear-gradient(135deg, #059669, #0891b2)',
    shadow: 'rgba(5, 150, 105, 0.5)',
    href: (d: Difficulty) => `/game/${d}?mode=local`,
  },
  {
    id: 'online' as GameMode,
    icon: '🌐',
    title: 'Играть онлайн',
    desc: 'Найдите реального соперника через систему матчмейкинга и сыграйте в рейтинговую партию',
    gradient: 'linear-gradient(135deg, #f59e0b, #dc2626)',
    shadow: 'rgba(245, 158, 11, 0.5)',
    href: () => '/online',
  },
];

const difficultyLabels: Record<Difficulty, { label: string; icon: string; color: string }> = {
  kids: { label: 'Детский', icon: '👶', color: '#ec4899' },
  beginner: { label: 'Начинающий', icon: '🌱', color: '#10b981' },
  medium: { label: 'Средний', icon: '⚔️', color: '#3b82f6' },
  hard: { label: 'Сложный', icon: '🔥', color: '#f97316' },
  expert: { label: 'Эксперт', icon: '👑', color: '#f59e0b' },
};

export default function GameModeSelector({ difficulty, onBack }: GameModeSelectorProps) {
  const router = useRouter();
  const setMode = useGameStore((s) => s.setMode);
  const diffInfo = DIFFICULTY_CONFIG[difficulty];
  const diffLabel = difficultyLabels[difficulty];

  const handleSelect = (mode: typeof modes[0]) => {
    setMode(mode.id);
    router.push(mode.href(difficulty));
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Back button */}
        <motion.button
          onClick={onBack}
          className="flex items-center gap-2 text-white/50 hover:text-white/90 transition-colors mb-8 text-sm"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          whileHover={{ x: -3 }}
        >
          ← Назад к уровням
        </motion.button>

        {/* Header */}
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <span className="text-3xl">{diffLabel.icon}</span>
            <h1
              className="text-3xl md:text-4xl font-bold"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Уровень:{' '}
              <span style={{ color: diffLabel.color }}>{diffLabel.label}</span>
            </h1>
          </div>
          <p className="text-white/50">
            Целевой ELO противника: <span className="text-yellow-400 font-semibold">{diffInfo.eloTarget}</span>
          </p>
          <p className="text-white/40 mt-1">Выберите режим игры</p>
        </motion.div>

        {/* Mode cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {modes.map((mode, i) => (
            <motion.button
              key={mode.id}
              onClick={() => handleSelect(mode)}
              className="relative flex flex-col items-center text-center p-8 rounded-2xl cursor-pointer overflow-hidden group"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(12px)',
              }}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              whileHover={{
                scale: 1.04,
                boxShadow: `0 25px 60px ${mode.shadow}`,
                y: -6,
              }}
              whileTap={{ scale: 0.97 }}
            >
              {/* Gradient overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-all duration-300 rounded-2xl"
                style={{ background: mode.gradient }}
              />

              {/* Top gradient line */}
              <div
                className="absolute top-0 left-4 right-4 h-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: mode.gradient }}
              />

              {/* Icon */}
              <motion.div
                className="text-6xl mb-5 relative z-10"
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                {mode.icon}
              </motion.div>

              {/* Title */}
              <h2
                className="text-xl font-bold mb-3 relative z-10"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {mode.title}
              </h2>

              {/* Description */}
              <p className="text-sm text-white/55 relative z-10 leading-relaxed">
                {mode.desc}
              </p>

              {/* Arrow button */}
              <motion.div
                className="mt-6 px-5 py-2 rounded-lg text-sm font-semibold relative z-10"
                style={{ background: mode.gradient }}
                whileHover={{ scale: 1.05 }}
              >
                Начать игру →
              </motion.div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
