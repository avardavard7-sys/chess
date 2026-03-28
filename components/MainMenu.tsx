'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import DailyPuzzle from '@/components/DailyPuzzle';
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
  const router = useRouter();
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

        {/* Learning section */}
        <motion.div
          className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <motion.button
            onClick={() => router.push('/learn')}
            className="relative flex items-center gap-4 p-5 rounded-2xl cursor-pointer overflow-hidden group text-left"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(124,58,237,0.3)',
              backdropFilter: 'blur(12px)',
            }}
            whileHover={{ scale: 1.03, boxShadow: '0 15px 40px rgba(124,58,237,0.3)', y: -3 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-300 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)' }} />
            <motion.span className="text-4xl relative z-10" animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity }}>📚</motion.span>
            <div className="relative z-10">
              <h3 className="text-base font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Обучение</h3>
              <p className="text-xs text-white/50 mt-0.5">Тактика, дебюты, эндшпиль</p>
            </div>
            <span className="ml-auto text-white/20 group-hover:text-white/50 transition-colors relative z-10">→</span>
          </motion.button>

          <motion.button
            onClick={() => router.push('/train')}
            className="relative flex items-center gap-4 p-5 rounded-2xl cursor-pointer overflow-hidden group text-left"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(74,222,128,0.3)',
              backdropFilter: 'blur(12px)',
            }}
            whileHover={{ scale: 1.03, boxShadow: '0 15px 40px rgba(74,222,128,0.3)', y: -3 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-300 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #4ade80, #06b6d4)' }} />
            <motion.span className="text-4xl relative z-10" animate={{ y: [0, -4, 0] }} transition={{ duration: 2.8, repeat: Infinity }}>🤖</motion.span>
            <div className="relative z-10">
              <h3 className="text-base font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Учись с ИИ-тренером</h3>
              <p className="text-xs text-white/50 mt-0.5">Играй и получай подсказки в реальном времени</p>
            </div>
            <span className="ml-auto text-white/20 group-hover:text-white/50 transition-colors relative z-10">→</span>
          </motion.button>

          <motion.button
            onClick={() => router.push('/analysis')}
            className="relative flex items-center gap-4 p-5 rounded-2xl cursor-pointer overflow-hidden group text-left"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(245,158,11,0.2)',
              backdropFilter: 'blur(12px)',
            }}
            whileHover={{ scale: 1.03, boxShadow: '0 15px 40px rgba(245,158,11,0.3)', y: -3 }}
            whileTap={{ scale: 0.97 }}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-300 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #dc2626)' }} />
            <motion.span className="text-4xl relative z-10" animate={{ y: [0, -4, 0] }} transition={{ duration: 3.5, repeat: Infinity }}>🔬</motion.span>
            <div className="relative z-10">
              <h3 className="text-base font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Анализ партий</h3>
              <p className="text-xs text-white/50 mt-0.5">Разбор ваших сыгранных партий</p>
            </div>
            <span className="ml-auto text-white/20 group-hover:text-white/50 transition-colors relative z-10">→</span>
          </motion.button>
        </motion.div>

        {/* Tournament button */}
        <motion.div className="mt-4 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}>
          <motion.button onClick={() => router.push('/tournaments')}
            className="relative w-full flex items-center gap-4 p-5 rounded-2xl cursor-pointer overflow-hidden group text-left"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(74,222,128,0.3)', backdropFilter: 'blur(12px)' }}
            whileHover={{ scale: 1.03, boxShadow: '0 15px 40px rgba(74,222,128,0.3)', y: -3 }} whileTap={{ scale: 0.97 }}>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-15 transition-opacity duration-300 rounded-2xl" style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }} />
            <motion.span className="text-4xl relative z-10" animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity }}>{'🏆'}</motion.span>
            <div className="relative z-10">
              <h3 className="text-base font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Турниры</h3>
              <p className="text-xs text-white/50 mt-0.5">Соревнуйтесь с другими учениками</p>
            </div>
            <span className="ml-auto text-white/20 group-hover:text-white/50 transition-colors relative z-10">→</span>
          </motion.button>
        </motion.div>

        {/* Now Playing */}
        <motion.div className="mt-4 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }}>
          <motion.button onClick={() => router.push('/watch')}
            className="relative w-full flex items-center gap-4 p-5 rounded-2xl cursor-pointer overflow-hidden group text-left"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(239,68,68,0.3)', backdropFilter: 'blur(12px)' }}
            whileHover={{ scale: 1.03, y: -3 }} whileTap={{ scale: 0.97 }}>
            <div className="relative z-10 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-3xl">{'🎮'}</span>
            </div>
            <div className="relative z-10">
              <h3 className="text-base font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Сейчас играют</h3>
              <p className="text-xs text-white/50 mt-0.5">Смотрите партии в реальном времени</p>
            </div>
            <span className="ml-auto text-white/20 group-hover:text-white/50 transition-colors relative z-10">{'>'}</span>
          </motion.button>
        </motion.div>

        {/* Daily Puzzle */}
        <motion.div className="mt-6 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }}>
          <DailyPuzzle compact />
        </motion.div>

        {/* Leaderboard */}
        <motion.div className="mt-4 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.0 }}>
          <motion.button onClick={() => router.push('/leaderboard')}
            className="relative w-full flex items-center gap-4 p-5 rounded-2xl cursor-pointer overflow-hidden group text-left"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(245,158,11,0.3)', backdropFilter: 'blur(12px)' }}
            whileHover={{ scale: 1.03, y: -3 }} whileTap={{ scale: 0.97 }}>
            <span className="text-3xl relative z-10">{'🏅'}</span>
            <div className="relative z-10">
              <h3 className="text-base font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>Таблица лидеров</h3>
              <p className="text-xs text-white/50 mt-0.5">Топ игроков школы</p>
            </div>
            <span className="ml-auto text-white/20 group-hover:text-white/50 transition-colors relative z-10">{'>'}</span>
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  );
}
