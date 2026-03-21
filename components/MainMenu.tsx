'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import type { Difficulty } from '@/store/gameStore';

const difficulties = [
  {
    id: 'kids' as Difficulty,
    icon: '👶',
    title: 'Детский',
    elo: 'ELO 0–200',
    desc: 'Учимся вместе!',
    gradient: 'linear-gradient(135deg, #ec4899 0%, #fbbf24 100%)',
    shadow: 'rgba(236, 72, 153, 0.4)',
    border: 'rgba(236, 72, 153, 0.3)',
  },
  {
    id: 'beginner' as Difficulty,
    icon: '🌱',
    title: 'Начинающий',
    elo: 'ELO 200–700',
    desc: 'Первые шаги в мире шахмат',
    gradient: 'linear-gradient(135deg, #059669 0%, #34d399 100%)',
    shadow: 'rgba(5, 150, 105, 0.4)',
    border: 'rgba(52, 211, 153, 0.3)',
  },
  {
    id: 'medium' as Difficulty,
    icon: '⚔️',
    title: 'Средний',
    elo: 'ELO 700–1600',
    desc: 'Серьёзная игра',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)',
    shadow: 'rgba(37, 99, 235, 0.4)',
    border: 'rgba(124, 58, 237, 0.3)',
  },
  {
    id: 'hard' as Difficulty,
    icon: '🔥',
    title: 'Сложный',
    elo: 'ELO 1600–2400',
    desc: 'Для опытных игроков',
    gradient: 'linear-gradient(135deg, #dc2626 0%, #f97316 100%)',
    shadow: 'rgba(220, 38, 38, 0.4)',
    border: 'rgba(249, 115, 22, 0.3)',
  },
  {
    id: 'expert' as Difficulty,
    icon: '👑',
    title: 'Эксперт',
    elo: 'ELO 2400+',
    desc: 'Уровень гроссмейстера',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #7c3aed 100%)',
    shadow: 'rgba(245, 158, 11, 0.4)',
    border: 'rgba(245, 158, 11, 0.4)',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

const item = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

interface MainMenuProps {
  onSelectDifficulty: (difficulty: Difficulty) => void;
}

export default function MainMenu({ onSelectDifficulty }: MainMenuProps) {
  const setDifficulty = useGameStore((s) => s.setDifficulty);

  const handleSelect = (difficulty: Difficulty) => {
    setDifficulty(difficulty);
    onSelectDifficulty(difficulty);
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4">
      <motion.div
        className="max-w-6xl mx-auto"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Title */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h1
            className="text-4xl md:text-5xl font-bold mb-3"
            style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}
          >
            Выберите уровень
          </h1>
          <p className="text-white/60 text-lg">
            От первых шагов до мастерства — каждый найдёт своё место
          </p>
        </motion.div>

        {/* Cards grid */}
        <motion.div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5"
          variants={container}
          initial="hidden"
          animate="show"
        >
          {difficulties.map((diff) => (
            <motion.button
              key={diff.id}
              variants={item}
              onClick={() => handleSelect(diff.id)}
              className="relative flex flex-col items-center text-center p-6 rounded-2xl cursor-pointer overflow-hidden group"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${diff.border}`,
                backdropFilter: 'blur(12px)',
              }}
              whileHover={{
                scale: 1.04,
                boxShadow: `0 20px 50px ${diff.shadow}`,
                y: -4,
              }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              {/* Gradient background on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-300 rounded-2xl"
                style={{ background: diff.gradient }}
              />

              {/* Icon */}
              <motion.div
                className="text-5xl mb-4 relative z-10"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                {diff.icon}
              </motion.div>

              {/* Title */}
              <h2
                className="text-xl font-bold mb-1 relative z-10"
                style={{ fontFamily: "'Playfair Display', serif", color: 'white' }}
              >
                {diff.title}
              </h2>

              {/* ELO badge */}
              <div
                className="text-xs font-semibold px-3 py-1 rounded-full mb-3 relative z-10"
                style={{
                  background: `${diff.shadow}`,
                  color: 'white',
                  border: `1px solid ${diff.border}`,
                }}
              >
                {diff.elo}
              </div>

              {/* Description */}
              <p className="text-sm text-white/60 relative z-10 leading-relaxed">
                {diff.desc}
              </p>

              {/* Arrow */}
              <motion.div
                className="mt-4 text-white/30 relative z-10"
                initial={{ opacity: 0, x: -5 }}
                whileHover={{ opacity: 1, x: 0 }}
              >
                →
              </motion.div>
            </motion.button>
          ))}
        </motion.div>

        {/* Bottom hint */}
        <motion.p
          className="text-center text-white/30 text-sm mt-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          ♟ Нажмите на карточку для выбора режима игры
        </motion.p>
      </motion.div>
    </div>
  );
}
