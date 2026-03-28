'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useRouter } from 'next/navigation';

interface GameOverModalProps {
  isOpen: boolean;
  result: 'win' | 'loss' | 'draw' | null;
  eloChange: number | null;
  coinChange?: number | null;
  reason?: string;
  onPlayAgain: () => void;
}

export default function GameOverModal({ isOpen, result, eloChange, coinChange, reason, onPlayAgain }: GameOverModalProps) {
  const router = useRouter();
  const confettiRef = useRef(false);

  useEffect(() => {
    if (isOpen && result === 'win' && !confettiRef.current) {
      confettiRef.current = true;
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#f59e0b', '#fbbf24', '#ffffff', '#7c3aed'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#f59e0b', '#fbbf24', '#ffffff', '#7c3aed'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }

    if (!isOpen) confettiRef.current = false;
  }, [isOpen, result]);

  const resultConfig = {
    win: {
      icon: '🏆',
      title: 'Победа!',
      subtitle: 'Отличная игра! Вы выиграли!',
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(124,58,237,0.2))',
      border: 'rgba(245,158,11,0.4)',
    },
    loss: {
      icon: '😔',
      title: 'Поражение',
      subtitle: 'Не расстраивайтесь — тренируйтесь!',
      color: '#f87171',
      gradient: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(15,23,42,0.5))',
      border: 'rgba(239,68,68,0.3)',
    },
    draw: {
      icon: '🤝',
      title: 'Ничья',
      subtitle: 'Равная борьба — хорошая партия!',
      color: '#94a3b8',
      gradient: 'linear-gradient(135deg, rgba(148,163,184,0.15), rgba(15,23,42,0.5))',
      border: 'rgba(148,163,184,0.3)',
    },
  };

  const config = result ? resultConfig[result] : null;

  return (
    <AnimatePresence>
      {isOpen && result && config && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative max-w-md w-full mx-4 p-8 rounded-3xl text-center overflow-hidden"
            style={{
              background: config.gradient,
              backdropFilter: 'blur(20px)',
              border: `1px solid ${config.border}`,
              boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 40px ${config.border}`,
            }}
            initial={{ scale: 0.7, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            {/* Icon */}
            <motion.div
              className="text-7xl mb-4 block"
              animate={result === 'win' ? { rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] } : {}}
              transition={{ duration: 0.6 }}
            >
              {config.icon}
            </motion.div>

            {/* Title */}
            <h2
              className="text-4xl font-bold mb-2"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: config.color,
              }}
            >
              {config.title}
            </h2>

            <p className="text-white/60 mb-6">{config.subtitle}</p>

            {/* ELO change */}
            {eloChange !== null && (
              <motion.div
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl mb-3"
                style={{
                  background: eloChange >= 0 ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)',
                  border: `1px solid ${eloChange >= 0 ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
              >
                <span className="text-2xl font-bold" style={{ color: eloChange >= 0 ? '#4ade80' : '#f87171' }}>
                  {eloChange >= 0 ? '+' : ''}{eloChange}
                </span>
                <span className="text-white/60 text-sm">ELO</span>
                <span className="text-lg">{eloChange >= 0 ? '▲' : '▼'}</span>
              </motion.div>
            )}

            {/* Coins change */}
            {coinChange !== null && coinChange !== undefined && (
              <motion.div
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl mb-8"
                style={{
                  background: coinChange >= 0 ? 'rgba(245,158,11,0.15)' : 'rgba(248,113,113,0.15)',
                  border: `1px solid ${coinChange >= 0 ? 'rgba(245,158,11,0.3)' : 'rgba(248,113,113,0.3)'}`,
                }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring' }}
              >
                <span className="text-2xl">{'🪙'}</span>
                <span className="text-2xl font-bold" style={{ color: coinChange >= 0 ? '#f59e0b' : '#f87171' }}>
                  {coinChange >= 0 ? '+' : ''}{coinChange}
                </span>
                <span className="text-white/60 text-sm">коинов</span>
              </motion.div>
            )}

            {reason && (
              <p className="text-white/40 text-sm mb-6">
                {reason === 'checkmate' && 'Мат'}
                {reason === 'stalemate' && 'Пат'}
                {reason === 'draw' && 'Ничья по согласию'}
                {reason === 'resigned' && 'Сдача'}
                {reason === 'threefold' && 'Троекратное повторение'}
                {reason === 'insufficient' && 'Недостаточно материала'}
              </p>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <motion.button
                onClick={onPlayAgain}
                className="flex-1 py-3 px-5 rounded-xl font-semibold text-black"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                🔄 Играть снова
              </motion.button>
              <motion.button
                onClick={() => router.push('/')}
                className="flex-1 py-3 px-5 rounded-xl font-semibold border border-white/20 text-white/80 hover:bg-white/5 transition-colors"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                🏠 В меню
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
