import { Chess } from 'chess.js';

export type MoveClassification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'good'
  | 'book'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'miss';

export interface AnalyzedMove {
  moveNumber: number;
  color: 'w' | 'b';
  san: string;
  uci: string;
  fen_before: string;
  fen_after: string;
  eval_before: number;
  eval_after: number;
  best_move_san: string;
  best_move_uci: string;
  best_eval: number;
  classification: MoveClassification;
  eval_drop: number;
  is_mate_before: boolean;
  is_mate_after: boolean;
  mate_in_before?: number;
  mate_in_after?: number;
}

export interface GameAnalysis {
  moves: AnalyzedMove[];
  accuracy_white: number;
  accuracy_black: number;
  summary: {
    white: Record<MoveClassification, number>;
    black: Record<MoveClassification, number>;
  };
  opening: string;
  result: string;
}

function cpToWinProb(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

function classifyMove(
  winProbBefore: number,
  winProbAfter: number,
  isBestMove: boolean,
  isSacrifice: boolean
): MoveClassification {
  const winLoss = winProbBefore - winProbAfter;

  if (isBestMove && isSacrifice && winLoss <= 2) return 'brilliant';
  if (isBestMove) return 'best';
  if (winLoss < 2) return 'great';
  if (winLoss < 5) return 'good';
  if (winLoss < 10) return 'inaccuracy';
  if (winLoss < 20) return 'mistake';
  return 'blunder';
}

let analysisWorker: Worker | null = null;

function getAnalysisWorker(): Worker {
  if (!analysisWorker) {
    analysisWorker = new Worker('/stockfish/stockfish.js');
    analysisWorker.postMessage('uci');
    analysisWorker.postMessage('setoption name Threads value 1');
    analysisWorker.postMessage('setoption name Hash value 256');
    analysisWorker.postMessage('setoption name MultiPV value 1');
    analysisWorker.postMessage('ucinewgame');
  }
  return analysisWorker;
}

export function terminateAnalysisWorker() {
  if (analysisWorker) {
    analysisWorker.terminate();
    analysisWorker = null;
  }
}

let cloudDisabled = false;
let cloudHits = 0;
let cloudMisses = 0;
let cloudConsecutiveMisses = 0;

function cleanFen(fen: string): string {
  const parts = fen.split(' ');
  if (parts.length >= 4) {
    parts[3] = '-';
  }
  return parts.join(' ');
}

async function fetchLichessCloud(fen: string): Promise<{ eval: number; bestMove: string; isMate: boolean; mateIn?: number } | null> {
  if (cloudDisabled) return null;

  try {
    const cleanedFen = cleanFen(fen);
    const url = `https://lichess.org/api/cloud-eval?fen=${encodeURIComponent(cleanedFen)}&multiPv=1`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 800);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.status === 429) {
      cloudDisabled = true;
      return null;
    }

    if (!res.ok) {
      cloudMisses++;
      cloudConsecutiveMisses++;
      if (cloudConsecutiveMisses >= 2) {
        cloudDisabled = true;
      }
      return null;
    }

    const data = await res.json();
    if (!data.pvs || data.pvs.length === 0) {
      cloudMisses++;
      cloudConsecutiveMisses++;
      if (cloudConsecutiveMisses >= 3) cloudDisabled = true;
      return null;
    }

    const pv = data.pvs[0];
    const firstMove = (pv.moves || '').split(' ')[0] || '';

    cloudConsecutiveMisses = 0;

    if (pv.mate !== undefined) {
      const mateIn = pv.mate;
      const evalScore = mateIn > 0 ? 31000 - Math.abs(mateIn) : -31000 + Math.abs(mateIn);
      cloudHits++;
      return { eval: evalScore, bestMove: firstMove, isMate: true, mateIn };
    }

    if (pv.cp !== undefined) {
      cloudHits++;
      return { eval: pv.cp, bestMove: firstMove, isMate: false };
    }

    cloudMisses++;
    cloudConsecutiveMisses++;
    return null;
  } catch {
    cloudConsecutiveMisses++;
    if (cloudConsecutiveMisses >= 3) cloudDisabled = true;
    return null;
  }
}

export function resetCloudStats() {
  cloudDisabled = false;
  cloudHits = 0;
  cloudMisses = 0;
  cloudConsecutiveMisses = 0;
}

function evaluatePosition(fen: string, depth: number = 16): Promise<{ eval: number; bestMove: string; isMate: boolean; mateIn?: number }> {
  return new Promise(async (resolve) => {
    const cloudResult = await fetchLichessCloud(fen);
    if (cloudResult) {
      resolve(cloudResult);
      return;
    }

    const w = getAnalysisWorker();
    const timeout = setTimeout(() => {
      w.removeEventListener('message', handler);
      resolve({ eval: 0, bestMove: '', isMate: false });
    }, 5000);

    let bestMove = '';
    let evalScore = 0;
    let isMate = false;
    let mateIn: number | undefined;
    let lastDepth = 0;

    const handler = (e: MessageEvent) => {
      const msg: string = e.data;

      if (msg.startsWith('info') && msg.includes('score') && msg.includes(' pv ')) {
        const depthMatch = msg.match(/depth (\d+)/);
        const currentDepth = depthMatch ? parseInt(depthMatch[1]) : 0;

        if (currentDepth >= lastDepth) {
          lastDepth = currentDepth;

          if (msg.includes('score cp')) {
            const cpMatch = msg.match(/score cp (-?\d+)/);
            if (cpMatch) {
              evalScore = parseInt(cpMatch[1]);
              isMate = false;
              mateIn = undefined;
            }
          } else if (msg.includes('score mate')) {
            const mateMatch = msg.match(/score mate (-?\d+)/);
            if (mateMatch) {
              mateIn = parseInt(mateMatch[1]);
              isMate = true;
              if (mateIn === 0) {
                evalScore = 32000;
              } else {
                evalScore = mateIn > 0 ? 31000 - Math.abs(mateIn) : -31000 + Math.abs(mateIn);
              }
            }
          }

          const pvMatch = msg.match(/ pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
          if (pvMatch) {
            bestMove = pvMatch[1];
          }
        }
      }

      if (msg.startsWith('bestmove')) {
        clearTimeout(timeout);
        w.removeEventListener('message', handler);
        const parts = msg.split(' ');
        if (parts[1] && parts[1] !== '(none)') {
          bestMove = bestMove || parts[1];
        }
        resolve({ eval: evalScore, bestMove, isMate, mateIn });
      }
    };

    w.addEventListener('message', handler);
    w.postMessage('isready');
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go movetime 200`);
  });
}

function uciToSan(fen: string, uci: string): string {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length === 5 ? uci[4] : undefined;
    const move = chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
    return move ? move.san : uci;
  } catch {
    return uci;
  }
}

function isSacrificeMove(fen: string, uci: string): boolean {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length === 5 ? uci[4] : undefined;
    const move = chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
    if (!move) return false;

    const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
    const movedValue = pieceValues[move.piece] || 0;

    if (move.captured) {
      const capturedValue = pieceValues[move.captured] || 0;
      if (movedValue > capturedValue + 1) return true;
    }

    const afterChess = new Chess(chess.fen());
    const opponentMoves = afterChess.moves({ verbose: true });
    for (const oppMove of opponentMoves) {
      if (oppMove.to === to) return true;
    }
    return false;
  } catch {
    return false;
  }
}

const COMMON_OPENINGS: [string[], string][] = [
  [['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], 'Испанская партия'],
  [['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], 'Итальянская партия'],
  [['e4', 'e5', 'Nf3', 'Nf6'], 'Русская партия'],
  [['e4', 'c5'], 'Сицилианская защита'],
  [['e4', 'e5', 'f4'], 'Королевский гамбит'],
  [['e4', 'e6'], 'Французская защита'],
  [['e4', 'c6'], 'Защита Каро-Канн'],
  [['d4', 'd5', 'c4'], 'Ферзевый гамбит'],
  [['d4', 'Nf6', 'c4', 'g6'], 'Староиндийская защита'],
  [['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], 'Защита Нимцовича'],
  [['d4', 'd5'], 'Ферзевый дебют'],
  [['d4', 'Nf6'], 'Индийская защита'],
  [['Nf3'], 'Дебют Рети'],
  [['c4'], 'Английское начало'],
  [['e4', 'e5'], 'Открытая игра'],
  [['e4'], 'Дебют королевской пешки'],
  [['d4'], 'Дебют ферзевой пешки'],
];

function detectOpening(moves: string[]): string {
  let bestMatch = 'Неизвестный дебют';
  let bestLen = 0;
  for (const [seq, name] of COMMON_OPENINGS) {
    if (seq.length <= moves.length) {
      let match = true;
      for (let i = 0; i < seq.length; i++) {
        if (moves[i] !== seq[i]) { match = false; break; }
      }
      if (match && seq.length > bestLen) { bestLen = seq.length; bestMatch = name; }
    }
  }
  return bestMatch;
}

function calculateAccuracy(moves: AnalyzedMove[], color: 'w' | 'b'): number {
  const playerMoves = moves.filter((m) => m.color === color);
  if (playerMoves.length === 0) return 100;

  const accuracies: number[] = [];
  for (const m of playerMoves) {
    const winProbBefore = cpToWinProb(m.best_eval);
    const winProbAfter = cpToWinProb(m.color === 'w' ? m.eval_after : -m.eval_after);
    const winLoss = Math.max(0, winProbBefore - winProbAfter);
    const acc = Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * winLoss) - 3.1669));
    accuracies.push(acc);
  }

  const avg = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  return Math.round(avg * 10) / 10;
}

export async function analyzeGame(
  movesJson: Array<{ from: string; to: string; san: string; promotion?: string }>,
  onProgress?: (current: number, total: number) => void,
  depth: number = 16
): Promise<GameAnalysis> {
  resetCloudStats();

  const chess = new Chess();
  const analyzedMoves: AnalyzedMove[] = [];
  const sanList: string[] = [];
  const totalMoves = movesJson.length;
  let prevEval = 0;
  let nextBestResult: { eval: number; bestMove: string; isMate: boolean; mateIn?: number } | null = null;

  for (let i = 0; i < movesJson.length; i++) {
    const moveData = movesJson[i];
    const fenBefore = chess.fen();
    const color = chess.turn();

    let bestResult;
    if (nextBestResult) {
      bestResult = nextBestResult;
      nextBestResult = null;
    } else {
      try {
        bestResult = await evaluatePosition(fenBefore, depth);
      } catch {
        bestResult = { eval: 0, bestMove: '', isMate: false };
      }
    }

    const bestEval = bestResult.eval;
    const bestMoveUci = bestResult.bestMove;
    const bestMoveSan = bestMoveUci ? uciToSan(fenBefore, bestMoveUci) : '';

    let move;
    try {
      move = chess.move({
        from: moveData.from,
        to: moveData.to,
        promotion: (moveData.promotion || undefined) as 'q' | 'r' | 'b' | 'n' | undefined,
      });
    } catch {  }

    if (!move && moveData.san) {
      try { move = chess.move(moveData.san); } catch {  }
    }

    if (!move) {
      try {
        const legalMoves = chess.moves({ verbose: true });
        const matching = legalMoves.find(m => m.from === moveData.from && m.to === moveData.to);
        if (matching) move = chess.move(matching);
      } catch {  }
    }

    if (!move) {
      console.warn(`Skipping invalid move ${i}`);
      continue;
    }

    sanList.push(move.san);
    const fenAfter = chess.fen();

    let afterResult;
    try {
      afterResult = await evaluatePosition(fenAfter, depth);
      nextBestResult = afterResult;
    } catch {
      afterResult = { eval: 0, bestMove: '', isMate: false };
    }

    const bestForPlayer = bestEval;
    const actualForPlayer = -afterResult.eval;

    const winProbBefore = cpToWinProb(bestForPlayer);
    const winProbAfter = cpToWinProb(actualForPlayer);

    const evalDrop = Math.max(0, bestForPlayer - actualForPlayer);

    const evalAfterWhitePerspective = color === 'w' ? actualForPlayer : -actualForPlayer;

    const playerUci = moveData.from + moveData.to + (moveData.promotion || '');
    const isBest = playerUci === bestMoveUci || (winProbBefore - winProbAfter) < 1;
    const isSacrifice = isSacrificeMove(fenBefore, playerUci);

    const classification = classifyMove(winProbBefore, winProbAfter, isBest, isSacrifice);

    analyzedMoves.push({
      moveNumber: Math.floor(i / 2) + 1,
      color,
      san: move.san,
      uci: playerUci,
      fen_before: fenBefore,
      fen_after: fenAfter,
      eval_before: prevEval,
      eval_after: evalAfterWhitePerspective,
      best_move_san: bestMoveSan,
      best_move_uci: bestMoveUci,
      best_eval: bestEval,
      classification,
      eval_drop: evalDrop,
      is_mate_before: bestResult.isMate,
      is_mate_after: afterResult.isMate,
      mate_in_before: bestResult.mateIn,
      mate_in_after: afterResult.mateIn,
    });

    prevEval = evalAfterWhitePerspective;
    onProgress?.(i + 1, totalMoves);
  }

  const emptySummary = (): Record<MoveClassification, number> => ({
    brilliant: 0, great: 0, best: 0, good: 0, book: 0,
    inaccuracy: 0, mistake: 0, blunder: 0, miss: 0,
  });

  const summary = { white: emptySummary(), black: emptySummary() };
  for (const m of analyzedMoves) {
    if (m.color === 'w') summary.white[m.classification]++;
    else summary.black[m.classification]++;
  }

  return {
    moves: analyzedMoves,
    accuracy_white: calculateAccuracy(analyzedMoves, 'w'),
    accuracy_black: calculateAccuracy(analyzedMoves, 'b'),
    summary,
    opening: detectOpening(sanList),
    result: '',
  };
}

export const CLASSIFICATION_CONFIG: Record<MoveClassification, { label: string; color: string; bgColor: string; symbol: string }> = {
  brilliant: { label: 'Блестящий', color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.15)', symbol: '!!' },
  great: { label: 'Отличный', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', symbol: '!' },
  best: { label: 'Лучший', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', symbol: '★' },
  good: { label: 'Хороший', color: '#84cc16', bgColor: 'rgba(132, 204, 22, 0.15)', symbol: '✓' },
  book: { label: 'Теория', color: '#a78bfa', bgColor: 'rgba(167, 139, 250, 0.15)', symbol: '📖' },
  inaccuracy: { label: 'Неточность', color: '#fbbf24', bgColor: 'rgba(251, 191, 36, 0.15)', symbol: '?!' },
  mistake: { label: 'Ошибка', color: '#fb923c', bgColor: 'rgba(251, 146, 60, 0.15)', symbol: '?' },
  blunder: { label: 'Зевок', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', symbol: '??' },
  miss: { label: 'Упущение', color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.15)', symbol: '⚡' },
};
