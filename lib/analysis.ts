import { Chess } from 'chess.js';

// ─── Типы ─────────────────────────────────────────────────────────────────────

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
  eval_before: number;       // centipawns
  eval_after: number;        // centipawns
  best_move_san: string;
  best_move_uci: string;
  best_eval: number;
  classification: MoveClassification;
  eval_drop: number;         // потеря в centipawns (положительное = потеря)
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

// ─── Классификация ходов ──────────────────────────────────────────────────────

function classifyMove(evalDrop: number, isBestMove: boolean, isSacrifice: boolean): MoveClassification {
  // evalDrop — потеря в centipawns (с точки зрения игрока чей ход)
  // Положительное значение = потеря, отрицательное = улучшение

  if (isBestMove && isSacrifice && evalDrop <= 10) {
    return 'brilliant';
  }
  if (isBestMove) {
    return 'best';
  }
  if (evalDrop <= 10) {
    return 'great';
  }
  if (evalDrop <= 25) {
    return 'good';
  }
  if (evalDrop <= 50) {
    return 'good';
  }
  if (evalDrop <= 100) {
    return 'inaccuracy';
  }
  if (evalDrop <= 200) {
    return 'mistake';
  }
  return 'blunder';
}

// ─── Stockfish Worker для анализа ─────────────────────────────────────────────

let analysisWorker: Worker | null = null;

function getAnalysisWorker(): Worker {
  if (!analysisWorker) {
    analysisWorker = new Worker('/stockfish/stockfish.js');
    analysisWorker.postMessage('uci');
  }
  return analysisWorker;
}

export function terminateAnalysisWorker() {
  if (analysisWorker) {
    analysisWorker.terminate();
    analysisWorker = null;
  }
}

function evaluatePosition(fen: string, depth: number = 16): Promise<{ eval: number; bestMove: string; isMate: boolean; mateIn?: number }> {
  return new Promise((resolve, reject) => {
    const w = getAnalysisWorker();
    const timeout = setTimeout(() => {
      w.removeEventListener('message', handler);
      resolve({ eval: 0, bestMove: '', isMate: false });
    }, 10000);

    let bestMove = '';
    let evalScore = 0;
    let isMate = false;
    let mateIn: number | undefined;

    const handler = (e: MessageEvent) => {
      const msg: string = e.data;

      // Парсим info строки для получения eval
      if (msg.startsWith('info') && msg.includes('score')) {
        const depthMatch = msg.match(/depth (\d+)/);
        const currentDepth = depthMatch ? parseInt(depthMatch[1]) : 0;

        if (currentDepth >= Math.max(depth - 4, 1)) {
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
              evalScore = mateIn > 0 ? 10000 - mateIn * 10 : -10000 - mateIn * 10;
            }
          }

          // Берём PV для best move
          const pvMatch = msg.match(/pv ([a-h][1-8][a-h][1-8][qrbn]?)/);
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
    w.postMessage('ucinewgame');
    w.postMessage('isready');
    w.postMessage(`position fen ${fen}`);
    w.postMessage(`go depth ${depth}`);
  });
}

// ─── UCI в SAN ────────────────────────────────────────────────────────────────

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

// ─── Проверка жертвы ─────────────────────────────────────────────────────────

function isSacrificeMove(fen: string, uci: string): boolean {
  try {
    const chess = new Chess(fen);
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length === 5 ? uci[4] : undefined;
    const move = chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
    if (!move) return false;

    // Если фигура взята и наша фигура стоит дороже — это жертва
    if (move.captured) {
      const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
      const movedValue = pieceValues[move.piece] || 0;
      const capturedValue = pieceValues[move.captured] || 0;
      if (movedValue > capturedValue + 1) return true;
    }

    // Если после хода фигура может быть взята
    const afterChess = new Chess(chess.fen());
    const opponentMoves = afterChess.moves({ verbose: true });
    for (const oppMove of opponentMoves) {
      if (oppMove.to === to && oppMove.captured) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// ─── Определение дебюта ──────────────────────────────────────────────────────

const COMMON_OPENINGS: [string[], string][] = [
  [['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], 'Испанская партия (Руй Лопез)'],
  [['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], 'Итальянская партия'],
  [['e4', 'e5', 'Nf3', 'Nf6'], 'Русская партия (Петрова)'],
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
        if (moves[i] !== seq[i]) {
          match = false;
          break;
        }
      }
      if (match && seq.length > bestLen) {
        bestLen = seq.length;
        bestMatch = name;
      }
    }
  }

  return bestMatch;
}

// ─── Расчёт accuracy ─────────────────────────────────────────────────────────

function calculateAccuracy(moves: AnalyzedMove[], color: 'w' | 'b'): number {
  const playerMoves = moves.filter((m) => m.color === color);
  if (playerMoves.length === 0) return 100;

  let totalScore = 0;
  for (const m of playerMoves) {
    // Конвертируем eval drop в accuracy баллы
    const drop = Math.max(0, m.eval_drop);
    // Формула как в Chess.com — экспоненциальный decay
    const moveAccuracy = Math.max(0, 100 * Math.exp(-drop / 150));
    totalScore += moveAccuracy;
  }

  return Math.round((totalScore / playerMoves.length) * 10) / 10;
}

// ─── Основная функция анализа ─────────────────────────────────────────────────

export async function analyzeGame(
  movesJson: Array<{ from: string; to: string; san: string; promotion?: string }>,
  onProgress?: (current: number, total: number) => void,
  depth: number = 14
): Promise<GameAnalysis> {
  const chess = new Chess();
  const analyzedMoves: AnalyzedMove[] = [];
  const sanList: string[] = [];

  const totalMoves = movesJson.length;

  // Оцениваем начальную позицию
  let prevEval = 0; // начальная позиция = 0

  for (let i = 0; i < movesJson.length; i++) {
    const moveData = movesJson[i];
    const fenBefore = chess.fen();
    const color = chess.turn();

    // Получаем лучший ход движка для текущей позиции
    let bestResult;
    try {
      bestResult = await evaluatePosition(fenBefore, depth);
    } catch {
      bestResult = { eval: 0, bestMove: '', isMate: false };
    }

    const bestEval = bestResult.eval;
    const bestMoveUci = bestResult.bestMove;
    const bestMoveSan = bestMoveUci ? uciToSan(fenBefore, bestMoveUci) : '';

    // Делаем ход игрока — пробуем несколько способов
    let move;
    try {
      // Способ 1: from + to + promotion
      move = chess.move({
        from: moveData.from,
        to: moveData.to,
        promotion: (moveData.promotion || undefined) as 'q' | 'r' | 'b' | 'n' | undefined,
      });
    } catch { /* invalid move by from/to */ }

    if (!move && moveData.san) {
      try {
        // Способ 2: SAN нотация (e4, Nf3, Bxc6 etc.)
        move = chess.move(moveData.san);
      } catch { /* invalid SAN */ }
    }

    if (!move) {
      // Способ 3: ищем любой легальный ход из from в to
      try {
        const legalMoves = chess.moves({ verbose: true });
        const matching = legalMoves.find(m => m.from === moveData.from && m.to === moveData.to);
        if (matching) move = chess.move(matching);
      } catch { /* no legal match */ }
    }

    if (!move) {
      // Не удалось — пропускаем, но анализ продолжается с текущей позиции
      console.warn(`Skipping invalid move ${i}: ${JSON.stringify(moveData)}`);
      continue;
    }

    sanList.push(move.san);
    const fenAfter = chess.fen();

    // Оцениваем позицию после хода
    let afterResult;
    try {
      afterResult = await evaluatePosition(fenAfter, depth);
    } catch {
      afterResult = { eval: 0, bestMove: '', isMate: false };
    }

    // === ПРАВИЛЬНАЯ ЛОГИКА EVAL ===
    // Stockfish ВСЕГДА оценивает с точки зрения СТОРОНЫ, ЧЕЙ ХОД
    //
    // bestEval: оценка ДО хода, с точки зрения color (кто ходит)
    //   bestEval > 0 = color в лучшей позиции
    //
    // afterResult.eval: оценка ПОСЛЕ хода, с точки зрения ОППОНЕНТА (теперь его ход)
    //   afterResult.eval > 0 = оппонент в лучшей позиции
    //
    // Чтобы сравнить: приводим всё к точке зрения color (кто сделал ход):
    //   bestForPlayer = bestEval (уже с его точки зрения)
    //   actualForPlayer = -afterResult.eval (инвертируем, т.к. Stockfish дал с т.з. оппонента)
    //
    // evalDrop = bestForPlayer - actualForPlayer (сколько потерял)

    const bestForPlayer = bestEval;
    const actualForPlayer = -afterResult.eval;
    const evalDrop = Math.max(0, bestForPlayer - actualForPlayer);

    // eval_after для ГРАФИКА: всегда с точки зрения БЕЛЫХ
    // Если ходили белые: actualForPlayer = с т.з. белых
    // Если ходили чёрные: actualForPlayer = с т.з. чёрных → инвертируем
    const evalAfterWhitePerspective = color === 'w' ? actualForPlayer : -actualForPlayer;

    const playerUci = moveData.from + moveData.to + (moveData.promotion || '');
    const isBest = playerUci === bestMoveUci || evalDrop <= 5;
    const isSacrifice = isSacrificeMove(fenBefore, playerUci);

    const classification = classifyMove(evalDrop, isBest, isSacrifice);

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

  // Подсчитываем summary
  const emptySummary = (): Record<MoveClassification, number> => ({
    brilliant: 0, great: 0, best: 0, good: 0, book: 0,
    inaccuracy: 0, mistake: 0, blunder: 0, miss: 0,
  });

  const whiteSummary = emptySummary();
  const blackSummary = emptySummary();

  for (const m of analyzedMoves) {
    if (m.color === 'w') whiteSummary[m.classification]++;
    else blackSummary[m.classification]++;
  }

  return {
    moves: analyzedMoves,
    accuracy_white: calculateAccuracy(analyzedMoves, 'w'),
    accuracy_black: calculateAccuracy(analyzedMoves, 'b'),
    summary: { white: whiteSummary, black: blackSummary },
    opening: detectOpening(sanList),
    result: chess.isCheckmate() ? (chess.turn() === 'w' ? '0-1' : '1-0') : chess.isDraw() ? '½-½' : '*',
  };
}

// ─── Конфиг классификаций для UI ──────────────────────────────────────────────

export const CLASSIFICATION_CONFIG: Record<MoveClassification, { label: string; icon: string; color: string; bgColor: string }> = {
  brilliant: { label: 'Блестящий', icon: '💎', color: '#00bcd4', bgColor: 'rgba(0,188,212,0.15)' },
  great:     { label: 'Отличный', icon: '⭐', color: '#2196f3', bgColor: 'rgba(33,150,243,0.15)' },
  best:      { label: 'Лучший', icon: '✅', color: '#4caf50', bgColor: 'rgba(76,175,80,0.15)' },
  good:      { label: 'Хороший', icon: '👍', color: '#8bc34a', bgColor: 'rgba(139,195,74,0.15)' },
  book:      { label: 'Теория', icon: '📖', color: '#9e9e9e', bgColor: 'rgba(158,158,158,0.15)' },
  inaccuracy:{ label: 'Неточность', icon: '⚠️', color: '#ffc107', bgColor: 'rgba(255,193,7,0.15)' },
  mistake:   { label: 'Ошибка', icon: '❌', color: '#ff9800', bgColor: 'rgba(255,152,0,0.15)' },
  blunder:   { label: 'Зевок', icon: '💀', color: '#f44336', bgColor: 'rgba(244,67,54,0.15)' },
  miss:      { label: 'Упущение', icon: '👀', color: '#e91e63', bgColor: 'rgba(233,30,99,0.15)' },
};
