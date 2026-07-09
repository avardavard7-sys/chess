'use client';

import { motion } from 'framer-motion';

interface EvalBarProps {
  evaluation: number;
  mate?: number | null;
  height?: number;
  orientation?: 'white' | 'black';
}

export default function EvalBar({ evaluation, mate, height = 400, orientation = 'white' }: EvalBarProps) {
  let whitePercent: number;

  if (mate !== null && mate !== undefined) {
    whitePercent = mate > 0 ? 100 : 0;
  } else {
    const clamped = Math.max(-1000, Math.min(1000, evaluation));
    whitePercent = 50 + (50 * (2 / (1 + Math.exp(-clamped / 200)) - 1));
  }

  const displayPercent = orientation === 'white' ? whitePercent : 100 - whitePercent;

  let evalText: string;
  if (mate !== null && mate !== undefined) {
    evalText = `M${Math.abs(mate)}`;
  } else {
    const pawnValue = Math.abs(evaluation / 100);
    evalText = pawnValue >= 10 ? pawnValue.toFixed(0) : pawnValue.toFixed(1);
  }

  const isWhiteAdvantage = mate ? mate > 0 : evaluation > 0;

  return (
    <div className="relative flex-shrink-0" style={{ width: 28, height }}>
      {}
      <div className="absolute inset-0 rounded-lg overflow-hidden" style={{ background: '#333' }}>
        {}
        <motion.div
          className="absolute bottom-0 left-0 right-0 rounded-b-lg"
          style={{ background: '#e8e8e8' }}
          animate={{ height: `${displayPercent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="text-[9px] font-bold leading-none px-0.5"
          style={{
            color: isWhiteAdvantage ? '#333' : '#e8e8e8',
            textShadow: isWhiteAdvantage ? 'none' : '0 0 2px rgba(0,0,0,0.5)',
          }}
        >
          {evaluation === 0 && !mate ? '=' : (isWhiteAdvantage ? '+' : '-')}{evalText}
        </span>
      </div>
    </div>
  );
}
