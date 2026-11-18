import { Chess } from 'chess.js';

// Засчитывается ли ход в задаче — как в Lichess: записанный ход решения ИЛИ любой мат.
export function isAcceptedMove(fen: string, attempted: string, expected: string): 'solution' | 'mate' | false {
  const a = attempted.toLowerCase();
  const e = expected.toLowerCase();
  if (a === e) return 'solution';
  if (a.length === 4 && e.length === 5 && e.startsWith(a) && e[4] === 'q') return 'solution';
  try {
    const c = new Chess(fen);
    const mv = c.move({ from: a.slice(0, 2), to: a.slice(2, 4), promotion: (a[4] as 'q' | 'r' | 'b' | 'n') || 'q' });
    if (mv && c.isCheckmate()) return 'mate';
  } catch {}
  return false;
}
