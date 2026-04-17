'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

const sparklePositions = [
  { top: '15%', left: '8%', delay: 0.2, size: 16 },
  { top: '25%', right: '10%', delay: 0.5, size: 12 },
  { top: '60%', left: '5%', delay: 0.8, size: 20 },
  { top: '70%', right: '7%', delay: 0.3, size: 14 },
  { top: '40%', left: '15%', delay: 1.0, size: 10 },
  { top: '50%', right: '15%', delay: 0.6, size: 18 },
  { top: '80%', left: '20%', delay: 0.9, size: 12 },
  { top: '10%', right: '25%', delay: 0.4, size: 16 },
  { top: '35%', left: '3%', delay: 0.7, size: 10 },
  { top: '65%', right: '3%', delay: 1.1, size: 14 },
];

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 600);
    }, 2800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const textLines = [
    { text: 'Добро пожаловать в', size: 'text-xl md:text-2xl', gold: false },
    { text: 'шахматную школу', size: 'text-2xl md:text-3xl', gold: false },
    { text: 'ХОД КОНЁМ', size: 'text-5xl md:text-7xl', gold: true },
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          {/* Sparkle particles */}
          {sparklePositions.map((pos, i) => (
            <motion.div
              key={i}
              className="absolute text-yellow-400 select-none pointer-events-none"
              style={{
                top: pos.top,
                left: (pos as { left?: string }).left,
                right: (pos as { right?: string }).right,
                fontSize: pos.size,
              }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0.3, 1, 0],
                scale: [0, 1, 0.6, 1.2, 0],
                rotate: [0, 90, 180, 270, 360],
              }}
              transition={{
                duration: 2.5,
                delay: pos.delay,
                repeat: Infinity,
                repeatType: 'loop',
              }}
            >
              ✦
            </motion.div>
          ))}

          {/* Knight icon */}
          <motion.div
            className="mb-8 select-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, type: 'spring', stiffness: 200 }}
          >
            <motion.span
              className="text-8xl md:text-9xl block"
              style={{
                filter: 'drop-shadow(0 0 30px rgba(245, 158, 11, 0.8)) drop-shadow(0 0 60px rgba(245, 158, 11, 0.4))',
              }}
              animate={{
                filter: [
                  'drop-shadow(0 0 20px rgba(245,158,11,0.6))',
                  'drop-shadow(0 0 40px rgba(245,158,11,1)) drop-shadow(0 0 80px rgba(245,158,11,0.5))',
                  'drop-shadow(0 0 20px rgba(245,158,11,0.6))',
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              ♞
            </motion.span>
          </motion.div>

          {/* Text lines with stagger */}
          <motion.div
            className="text-center px-4"
            variants={{
              hidden: {},
              show: {
                transition: { staggerChildren: 0.25, delayChildren: 0.4 },
              },
            }}
            initial="hidden"
            animate="show"
          >
            {textLines.map((line, i) => (
              <motion.div
                key={i}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: { opacity: 1, y: 0 },
                }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`block ${line.size} font-semibold mb-2`}
                style={
                  line.gold
                    ? {
                        fontFamily: "'Playfair Display', serif",
                        color: '#f59e0b',
                        fontWeight: 900,
                        letterSpacing: '0.06em',
                        textShadow:
                          '0 0 20px rgba(245,158,11,0.8), 0 0 40px rgba(245,158,11,0.4)',
                      }
                    : {
                        color: 'rgba(255,255,255,0.85)',
                        fontFamily: "'Inter', sans-serif",
                        letterSpacing: '0.02em',
                      }
                }
              >
                {line.text}
              </motion.div>
            ))}
          </motion.div>

          {/* Bottom subtitle */}
          <motion.p
            className="mt-6 text-sm text-white/40 tracking-widest uppercase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6, duration: 0.5 }}
          >
            Шахматная школа Казахстана
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
