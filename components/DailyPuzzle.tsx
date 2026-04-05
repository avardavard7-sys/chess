'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';

interface DailyPuzzleProps {
  compact?: boolean;
}

export default function DailyPuzzle({ compact = false }: DailyPuzzleProps) {
  const [puzzle, setPuzzle] = useState<any>(null);
  const [fen, setFen] = useState('');
  const [moveStep, setMoveStep] = useState(0);
  const [state, setState] = useState<'loading' | 'thinking' | 'correct' | 'wrong'>('loading');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const chessRef = useRef(new Chess());

  useEffect(() => {
    // Загружаем ежедневную задачу (определяется по дате)
    const loadDaily = async () => {
      try {
        // Берём из задач mateIn1 по дню года
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        const res = await fetch('/puzzles/mateIn1.json');
        if (!res.ok) return;
        const puzzles = await res.json();
        const daily = puzzles[dayOfYear % puzzles.length];
        if (!daily) return;

        setPuzzle(daily);
        const chess = new Chess(daily.fen);
        chessRef.current = chess;
        setFen(daily.fen);

        // Первый ход — авто
        if (daily.moves.length > 0) {
          const uci = daily.moves[0];
          setTimeout(() => {
            try {
              chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length === 5 ? uci[4] as any : undefined });
              setFen(chess.fen());
              setMoveStep(1);
              setPlayerColor(chess.turn() === 'w' ? 'white' : 'black');
              setState('thinking');
            } catch { /* skip */ }
          }, 500);
        }
      } catch { /* skip */ }
    };
    loadDaily();
  }, []);

  const onDrop = (from: Square, to: Square) => {
    if (state !== 'thinking' || !puzzle) return false;
    const expected = puzzle.moves[moveStep];
    if (!expected) return false;
    const uci = from + to;
    if (uci === expected.slice(0, 4)) {
      const chess = chessRef.current;
      const promo = expected.length === 5 ? expected[4] : undefined;
      try {
        chess.move({ from, to, promotion: promo as any });
        setFen(chess.fen());
        const next = moveStep + 1;
        if (next >= puzzle.moves.length) {
          setState('correct');
        } else {
          setMoveStep(next);
          // Ход компа
          setTimeout(() => {
            const compUci = puzzle.moves[next];
            try {
              chess.move({ from: compUci.slice(0, 2), to: compUci.slice(2, 4), promotion: compUci.length === 5 ? compUci[4] as any : undefined });
              setFen(chess.fen());
              setMoveStep(next + 1);
            } catch { /* skip */ }
          }, 400);
        }
        return true;
      } catch { return false; }
    } else {
      setState('wrong');
      setTimeout(() => setState('thinking'), 1000);
      return false;
    }
  };

  if (state === 'loading' || !puzzle) {
    return <div className="glass p-4 rounded-xl text-center text-white/30 text-sm">Загрузка задачи...</div>;
  }

  return (
    <motion.div className="glass p-4 rounded-xl" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{'🧩'}</span>
        <span className="text-sm font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Задача дня</span>
        {state === 'correct' && <span className="text-xs text-green-400 ml-auto">Решено!</span>}
        {state === 'wrong' && <span className="text-xs text-red-400 ml-auto">Попробуйте ещё</span>}
        {state === 'thinking' && <span className="text-xs text-white/30 ml-auto">{playerColor === 'white' ? 'Ход белых' : 'Ход чёрных'}</span>}
      </div>
      <Chessboard
        position={fen}
        onPieceDrop={onDrop}
        boardWidth={compact ? 200 : 280}
        customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
        customDarkSquareStyle={{ backgroundColor: '#b58863' }}
        boardOrientation={playerColor}
        arePiecesDraggable={state === 'thinking'}
        animationDuration={200}
      />
      <div className="text-xs text-white/20 text-center mt-2">Рейтинг: {puzzle.rating}</div>
    </motion.div>
  );
}
