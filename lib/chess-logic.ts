import { Chess, Square } from 'chess.js';

export function getLegalMovesForSquare(fen: string, square: Square): Square[] {
  const chess = new Chess(fen);
  const moves = chess.moves({ square, verbose: true });
  return moves.map((m) => m.to as Square);
}

export function getCaptureSquares(fen: string, square: Square): Square[] {
  const chess = new Chess(fen);
  const moves = chess.moves({ square, verbose: true });
  return moves.filter((m) => m.flags.includes('c') || m.flags.includes('e')).map((m) => m.to as Square);
}

export function isLegalMove(fen: string, from: Square, to: Square, promotion?: string): boolean {
  const chess = new Chess(fen);
  const moves = chess.moves({ square: from, verbose: true });
  return moves.some((m) => m.to === to && (!promotion || m.promotion === promotion));
}

export function makeMove(fen: string, from: Square, to: Square, promotion?: string): string | null {
  const chess = new Chess(fen);
  try {
    const result = chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
    return result ? chess.fen() : null;
  } catch {
    return null;
  }
}

export function getGameStatus(fen: string): {
  status: 'playing' | 'checkmate' | 'draw' | 'stalemate' | 'threefold' | 'insufficient';
  winner?: 'white' | 'black';
} {
  const chess = new Chess(fen);

  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? 'black' : 'white';
    return { status: 'checkmate', winner };
  }
  if (chess.isStalemate()) return { status: 'stalemate' };
  if (chess.isThreefoldRepetition()) return { status: 'threefold' };
  if (chess.isInsufficientMaterial()) return { status: 'insufficient' };
  if (chess.isDraw()) return { status: 'draw' };
  return { status: 'playing' };
}

export function isInCheck(fen: string): boolean {
  const chess = new Chess(fen);
  return chess.isCheck();
}

export function getCapturedPieces(moveHistory: Array<{ captured?: string; color: string }>): {
  white: string[];
  black: string[];
} {
  const white: string[] = [];
  const black: string[] = [];

  const pieceSymbols: Record<string, string> = {
    p: '♟', n: '♞', b: '♝', r: '♜', q: '♛',
  };

  for (const move of moveHistory) {
    if (move.captured) {
      const symbol = pieceSymbols[move.captured] || move.captured;
      if (move.color === 'w') {
        white.push(symbol);
      } else {
        black.push(symbol);
      }
    }
  }

  return { white, black };
}

export function getMoveNotation(fen: string, from: Square, to: Square, promotion?: string): string {
  const chess = new Chess(fen);
  const move = chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
  return move ? move.san : '';
}

export function isPromotion(fen: string, from: Square, to: Square): boolean {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  if (!piece || piece.type !== 'p') return false;
  return (piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1');
}
