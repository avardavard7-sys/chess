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
  const initializedRef = useRef(false);
  const prevTurnRef = useRef(isWhiteTurn);
  const timeoutFiredRef = useRef(false);

  // ВАЖНО: инициализация только ОДИН РАЗ при первом монтировании
  // Не сбрасываем на ре-рендере родителя
  useEffect(() => {
    if (!initializedRef.current) {
      setWTime(whiteTime);
      setBTime(blackTime);
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Добавка инкремента при смене хода (только если был реальный переход)
  useEffect(() => {
    if (!initializedRef.current) return;
    if (!isRunning) {
      prevTurnRef.current = isWhiteTurn;
      return;
    }
    // Только если реально сменился ход
    if (prevTurnRef.current !== isWhiteTurn) {
      if (increment > 0) {
        // Инкремент игроку который ТОЛЬКО ЧТО сходил
        if (isWhiteTurn) {
          // Сейчас ход белых, значит чёрные только что походили → им инкремент
          setBTime(prev => prev + increment);
        } else {
          setWTime(prev => prev + increment);
        }
      }
      // Сброс точки отсчёта при переключении хода — критично для синхронизации
      lastTickRef.current = Date.now();
      prevTurnRef.current = isWhiteTurn;
    }
  }, [isWhiteTurn, isRunning, increment]);

  // Тикание — независимый таймер, работает плавно с requestAnimationFrame для UI обновлений
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Сброс точки отсчёта при запуске
    lastTickRef.current = Date.now();
    timeoutFiredRef.current = false;

    intervalRef.current = setInterval(() => {
      if (timeoutFiredRef.current) return;
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      if (isWhiteTurn) {
        setWTime(prev => {
          const next = prev - delta;
          if (next <= 0 && !timeoutFiredRef.current) {
            timeoutFiredRef.current = true;
            setTimeout(() => onTimeOut('white'), 0);
            return 0;
          }
          return Math.max(0, next);
        });
      } else {
        setBTime(prev => {
          const next = prev - delta;
          if (next <= 0 && !timeoutFiredRef.current) {
            timeoutFiredRef.current = true;
            setTimeout(() => onTimeOut('black'), 0);
            return 0;
          }
          return Math.max(0, next);
        });
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isWhiteTurn, onTimeOut]);

  const wLow = wTime < 30;
  const bLow = bTime < 30;

  return (
    <div className="flex justify-between items-center gap-3">
      {/* Black clock — слева */}
      <div className={`flex-1 py-2 px-3 rounded-xl text-center transition-all ${!isWhiteTurn && isRunning ? 'ring-2 ring-yellow-400/50' : ''}`}
        style={{ background: bLow ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)' }}>
        <div className="text-xs text-white/40 mb-0.5">{'●'} Чёрные</div>
        <div className={`text-xl font-mono font-bold ${bLow ? 'text-red-400' : 'text-white'}`}
          style={{ fontFamily: "'Playfair Display', monospace" }}>
          {formatTime(bTime)}
        </div>
      </div>

      {/* White clock — справа */}
      <div className={`flex-1 py-2 px-3 rounded-xl text-center transition-all ${isWhiteTurn && isRunning ? 'ring-2 ring-yellow-400/50' : ''}`}
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
