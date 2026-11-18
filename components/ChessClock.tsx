'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { afterLocalMove, afterRemoteMove, ClockColor, ClockTimes, formatClock, tick } from '@/lib/clockCore';

// Часы партии. На одном устройстве добавка за ход начисляется при смене хода; в игре по сети
// (external) доска сама вызывает localMove/remoteMove и сверяет время с соперником на каждом
// ходу — так показания у обоих игроков одинаковые (см. lib/clockCore.ts).

interface ChessClockProps {
  whiteTime: number;
  blackTime: number;
  isWhiteTurn: boolean;
  isRunning: boolean;
  increment: number;
  onTimeOut: (color: 'white' | 'black') => void;
  external?: boolean;
}

export interface ClockHandle {
  localMove: (mover: ClockColor) => number;
  remoteMove: (mover: ClockColor, reported?: number | null) => void;
  getTimes: () => ClockTimes;
}

const formatTime = formatClock;

const ChessClock = forwardRef<ClockHandle, ChessClockProps>(function ChessClock(
  { whiteTime, blackTime, isWhiteTurn, isRunning, increment, onTimeOut, external },
  ref,
) {
  const timesRef = useRef<ClockTimes>({ white: whiteTime, black: blackTime });
  const [view, setView] = useState<ClockTimes>(timesRef.current);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastTickRef = useRef(Date.now());
  const prevTurnRef = useRef(isWhiteTurn);
  const timeoutFiredRef = useRef(false);
  const runningRef = useRef(isRunning);
  runningRef.current = isRunning;
  const incRef = useRef(increment);
  incRef.current = increment;
  const onTimeOutRef = useRef(onTimeOut);
  onTimeOutRef.current = onTimeOut;

  const commit = (t: ClockTimes) => {
    timesRef.current = t;
    setView(t);
  };

  const flush = (turn: ClockColor) => {
    const now = Date.now();
    if (runningRef.current && !timeoutFiredRef.current) {
      timesRef.current = tick(timesRef.current, turn, (now - lastTickRef.current) / 1000).times;
    }
    lastTickRef.current = now;
  };

  useImperativeHandle(ref, () => ({
    localMove: (mover) => {
      flush(mover);
      const r = afterLocalMove(timesRef.current, mover, runningRef.current ? incRef.current : 0);
      commit(r.times);
      return r.report;
    },
    remoteMove: (mover, reported) => {
      flush(mover);
      commit(afterRemoteMove(timesRef.current, mover, runningRef.current ? incRef.current : 0, reported));
      if (timesRef.current[mover] > 0) timeoutFiredRef.current = false;
    },
    getTimes: () => timesRef.current,
  }));

  useEffect(() => {
    if (external || !isRunning) {
      prevTurnRef.current = isWhiteTurn;
      return;
    }
    if (prevTurnRef.current !== isWhiteTurn) {
      if (increment > 0) {
        const mover: ClockColor = isWhiteTurn ? 'black' : 'white';
        commit({ ...timesRef.current, [mover]: timesRef.current[mover] + increment });
      }
      lastTickRef.current = Date.now();
      prevTurnRef.current = isWhiteTurn;
    }
  }, [isWhiteTurn, isRunning, increment, external]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    lastTickRef.current = Date.now();
    timeoutFiredRef.current = false;

    intervalRef.current = setInterval(() => {
      if (timeoutFiredRef.current) return;
      const now = Date.now();
      const delta = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      const r = tick(timesRef.current, isWhiteTurn ? 'white' : 'black', delta);
      commit(r.times);
      if (r.flagged && !timeoutFiredRef.current) {
        timeoutFiredRef.current = true;
        const color = r.flagged;
        setTimeout(() => onTimeOutRef.current(color), 0);
      }
    }, 100);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, isWhiteTurn]);

  const wTime = view.white;
  const bTime = view.black;

  const wLow = wTime < 30;
  const bLow = bTime < 30;

  return (
    <div className="flex justify-between items-center gap-3">
      {}
      <div className={`flex-1 py-2 px-3 rounded-xl text-center transition-all ${!isWhiteTurn && isRunning ? 'ring-2 ring-yellow-400/50' : ''}`}
        style={{ background: bLow ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.05)' }}>
        <div className="text-xs text-white/40 mb-0.5">{'●'} Чёрные</div>
        <div className={`text-xl font-mono font-bold ${bLow ? 'text-red-400' : 'text-white'}`}
          style={{ fontFamily: "'Playfair Display', monospace" }}>
          {formatTime(bTime)}
        </div>
      </div>

      {}
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
});

export default ChessClock;

export { formatTime };
