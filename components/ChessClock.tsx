'use client';

import { useState, useEffect, useRef } from 'react';

interface ChessClockProps {
  whiteTime: number; // секунды
  blackTime: number;
  isWhiteTurn: boolean;
  isRunning: boolean;
  increment: number;
  onTimeOut: (color: 'white' | 'black') => void;
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ChessClock({ whiteTime, blackTime, isWhiteTurn, isRunning, increment, onTimeOut }: ChessClockProps) {
  const [wTime, setWTime] = useState(whiteTime);
  const [bTime, setBTime] = useState(blackTime);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef(Date.now());

  // Сброс при смене начального времени
  useEffect(() => {
    setWTime(whiteTime);
    setBTime(blackTime);
  }, [whiteTime, blackTime]);

  // Добавка при смене хода
  useEffect(() => {
    if (!isRunning) return;
    if (increment > 0) {
      if (isWhiteTurn) {
        setBTime(prev => prev + increment);
      } else {
        setWTime(prev => prev + increment);
      }
    }
  }, [isWhiteTurn]);

  // Тикание
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    lastTickRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      if (isWhiteTurn) {
        setWTime(prev => {
          const next = prev - delta;
          if (next <= 0) { onTimeOut('white'); return 0; }
          return next;
        });
      } else {
        setBTime(prev => {
          const next = prev - delta;
          if (next <= 0) { onTimeOut('black'); return 0; }
          return next;
        });
      }
    }, 100);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, isWhiteTurn, onTimeOut]);

  const wLow = wTime < 30;
  const bLow = bTime < 30;

  return (
    <div className="flex justify-between items-center gap-3">
      {/* Black clock */}
      <div className={`flex-1 py-2 px-3 rounded-xl text-center ${!isWhiteTurn && isRunning ? 'ring-2 ring-yellow-400/50' : ''}`}
        style={{ background: bLow ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)' }}>
        <div className="text-xs text-white/40 mb-0.5">{'●'} Чёрные</div>
        <div className={`text-xl font-mono font-bold ${bLow ? 'text-red-400' : 'text-white'}`}
          style={{ fontFamily: "'Playfair Display', monospace" }}>
          {formatTime(bTime)}
        </div>
      </div>

      {/* White clock */}
      <div className={`flex-1 py-2 px-3 rounded-xl text-center ${isWhiteTurn && isRunning ? 'ring-2 ring-yellow-400/50' : ''}`}
        style={{ background: wLow ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)' }}>
        <div className="text-xs text-white/40 mb-0.5">{'○'} Белые</div>
        <div className={`text-xl font-mono font-bold ${wLow ? 'text-red-400' : 'text-white'}`}
          style={{ fontFamily: "'Playfair Display', monospace" }}>
          {formatTime(wTime)}
        </div>
      </div>
    </div>
  );
}

export { formatTime };
