'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import ChessBoard from '@/components/ChessBoard';
import GameOverModal from '@/components/GameOverModal';
import TimeControlSelector from '@/components/TimeControlSelector';
import type { Difficulty } from '@/store/gameStore';

// Генерация случайной Chess960 позиции
function generateChess960Fen(): string {
  const pieces = new Array(8).fill('');
  // 1. Слоны на разноцветных клетках
  const lightSquares = [0, 2, 4, 6];
  const darkSquares = [1, 3, 5, 7];
  pieces[lightSquares[Math.floor(Math.random() * 4)]] = 'B';
  pieces[darkSquares[Math.floor(Math.random() * 4)]] = 'B';
  // 2. Ферзь на случайном пустом
  const empty1 = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);
  pieces[empty1[Math.floor(Math.random() * empty1.length)]] = 'Q';
  // 3. Кони на случайных пустых
  const empty2 = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);
  const n1 = Math.floor(Math.random() * empty2.length);
  pieces[empty2[n1]] = 'N';
  const empty3 = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);
  pieces[empty3[Math.floor(Math.random() * empty3.length)]] = 'N';
  // 4. Ладья-Король-Ладья на оставшихся трёх
  const remaining = pieces.map((p, i) => p === '' ? i : -1).filter(i => i >= 0);
  pieces[remaining[0]] = 'R';
  pieces[remaining[1]] = 'K';
  pieces[remaining[2]] = 'R';

  const backRank = pieces.join('');
  const blackRank = backRank.toLowerCase();
  return `${blackRank}/pppppppp/8/8/8/8/PPPPPPPP/${backRank} w KQkq - 0 1`;
}

const VARIANTS = [
  { id: 'chess960', name: 'Chess960', icon: '🔀', desc: 'Случайная расстановка фигур (Фишер)' },
  { id: 'threecheck', name: '3-Check', icon: '✅✅✅', desc: 'Три шаха — и ты победил!' },
  { id: 'koth', name: 'King of the Hill', icon: '👑', desc: 'Приведи короля в центр!' },
];

export default function Chess960Page() {
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [timeControl, setTimeControl] = useState<{ minutes: number; increment: number } | null>(null);
  const [phase, setPhase] = useState<'select' | 'time' | 'playing'>('select');
  const [gameKey, setGameKey] = useState(0);
  const [gameOverData, setGameOverData] = useState<{ result: 'win' | 'loss' | 'draw'; eloChange: number } | null>(null);

  const variant = VARIANTS.find(v => v.id === selectedVariant);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">

          {phase === 'select' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
                  Варианты шахмат
                </h1>
                <p className="text-white/40">Попробуйте необычные правила!</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                {VARIANTS.map(v => (
                  <motion.button key={v.id} onClick={() => { setSelectedVariant(v.id); setPhase('time'); }}
                    className="glass p-6 rounded-2xl text-center hover:ring-1 hover:ring-yellow-400/30"
                    whileHover={{ scale: 1.05, y: -5 }} whileTap={{ scale: 0.97 }}>
                    <div className="text-4xl mb-3">{v.icon}</div>
                    <h3 className="text-lg font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{v.name}</h3>
                    <p className="text-xs text-white/40">{v.desc}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {phase === 'time' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="text-center mb-4">
                <span className="text-3xl">{variant?.icon}</span>
                <h2 className="text-xl font-bold mt-2" style={{ fontFamily: "'Playfair Display', serif" }}>{variant?.name}</h2>
              </div>
              <TimeControlSelector title="Выберите время" onSelect={(_, minutes, increment) => {
                setTimeControl(minutes > 0 ? { minutes, increment } : null);
                setPhase('playing');
              }} />
            </motion.div>
          )}

          {phase === 'playing' && (
            <>
              <div className="text-center mb-4">
                <span className="text-sm text-white/40">{variant?.icon} {variant?.name}</span>
              </div>
              <div className="flex justify-center">
                <ChessBoard
                  key={gameKey}
                  difficulty={'medium' as Difficulty}
                  mode="ai"
                  isKidsMode={false}
                  timeControl={timeControl || undefined}
                  onGameOver={(result, eloChange) => setGameOverData({ result, eloChange })}
                />
              </div>
            </>
          )}
        </div>
      </main>

      <GameOverModal
        isOpen={!!gameOverData}
        result={gameOverData?.result || 'draw'}
        eloChange={gameOverData?.eloChange || 0}
        onPlayAgain={() => { setGameOverData(null); setGameKey(k => k + 1); }}
      />
    </div>
  );
}
