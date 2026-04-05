'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import {
  streamGame,
  sendMove,
  resignGame,
  sendDrawOffer,
  parseMoves,
  formatTime,
  getToken,
  type GameFull,
  type GameState,
} from '@/lib/lichess';
import { getLegalMovesForSquare, getCaptureSquares, isPromotion, getCapturedPieces } from '@/lib/chess-logic';
import OnlineChat from './OnlineChat';

interface LichessGameProps {
  gameId: string;
  myColor: 'white' | 'black';
  opponentName: string;
  opponentRating?: number;
  myName: string;
  myRating?: number;
  onGameEnd: (result: 'win' | 'loss' | 'draw', reason: string, moves?: Array<{ from: string; to: string; san: string; promotion?: string }>) => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function LichessGame({
  gameId,
  myColor,
  opponentName,
  opponentRating,
  myName,
  myRating,
  onGameEnd,
}: LichessGameProps) {
  const chessRef = useRef(new Chess());
  const chess = chessRef.current;
  const abortRef = useRef<AbortController | null>(null);

  const [fen, setFen] = useState(INITIAL_FEN);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [captureSquares, setCaptureSquares] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [shaking, setShaking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [capturedPieces, setCapturedPieces] = useState<{ white: string[]; black: string[] }>({ white: [], black: [] });
  const [promotionSquare, setPromotionSquare] = useState<{ from: Square; to: Square } | null>(null);
  const [wtime, setWtime] = useState(600000);
  const [btime, setBtime] = useState(600000);
  const [boardWidth, setBoardWidth] = useState(480);
  const [opponentGone, setOpponentGone] = useState(false);
  const [drawOffered, setDrawOffered] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [displayOpponentName, setDisplayOpponentName] = useState(opponentName);
  const [displayOpponentRating, setDisplayOpponentRating] = useState(opponentRating);
  const [displayMyName, setDisplayMyName] = useState(myName);
  const moveHistoryRef = useRef<HTMLDivElement>(null);
  const gameEndedRef = useRef(false);

  useEffect(() => {
    const update = () => {
      setBoardWidth(Math.min(window.innerWidth < 640 ? window.innerWidth - 32 : window.innerWidth < 1024 ? 460 : 520, 560));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const applyGameState = useCallback((moves: string) => {
    const uciMoves = parseMoves(moves);
    chess.reset();

    for (const uci of uciMoves) {
      const from = uci.slice(0, 2) as Square;
      const to = uci.slice(2, 4) as Square;
      const promotion = uci.length === 5 ? uci[4] : undefined;
      chess.move({ from, to, promotion: promotion as 'q' | 'r' | 'b' | 'n' | undefined });
    }

    setFen(chess.fen());

    // Update move history (SAN)
    const history = chess.history();
    setMoveHistory(history);

    // Update captured pieces
    const verboseHistory = chess.history({ verbose: true });
    const captured = getCapturedPieces(verboseHistory as Array<{ captured?: string; color: string }>);
    setCapturedPieces(captured);

    // Update last move
    if (uciMoves.length > 0) {
      const lastUci = uciMoves[uciMoves.length - 1];
      setLastMove({ from: lastUci.slice(0, 2), to: lastUci.slice(2, 4) });
    }

    // Scroll move history
    setTimeout(() => {
      if (moveHistoryRef.current) {
        moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
      }
    }, 50);
  }, [chess]);

  const handleGameEnd = useCallback((status: string, winner?: string) => {
    if (gameEndedRef.current) return;
    gameEndedRef.current = true;
    setGameEnded(true);

    let result: 'win' | 'loss' | 'draw';
    const myColorShort = myColor === 'white' ? 'white' : 'black';

    if (['draw', 'stalemate', 'threefoldRepetition', 'insufficientMaterial', 'fiftyMoves'].includes(status)) {
      result = 'draw';
    } else if (status === 'resign' || status === 'resigned') {
      // При resign — если есть winner, определяем по нему; если нет — тот кто resign = loss
      if (winner) {
        result = winner === myColorShort ? 'win' : 'loss';
      } else {
        // Нет winner — значит мы сами сдались
        result = 'loss';
      }
    } else if (winner) {
      result = winner === myColorShort ? 'win' : 'loss';
    } else {
      result = 'draw';
    }

    // Собираем ходы для анализа
    const verboseHistory = chess.history({ verbose: true });
    const movesForAnalysis = verboseHistory.map((m) => ({
      from: m.from, to: m.to, san: m.san,
      ...(m.promotion ? { promotion: m.promotion } : {}),
    }));

    onGameEnd(result, status, movesForAnalysis);
  }, [myColor, onGameEnd, chess]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    abortRef.current = new AbortController();

    streamGame(token, gameId, (event) => {
      if (event.type === 'gameFull') {
        const full = event as GameFull;
        setWtime(full.clock?.initial || 600000);
        setBtime(full.clock?.initial || 600000);
        applyGameState(full.state.moves);

        // Extract real player names from gameFull
        const myPlayer = myColor === 'white' ? full.white : full.black;
        const oppPlayer = myColor === 'white' ? full.black : full.white;
        if (myPlayer?.name) setDisplayMyName(myPlayer.name);
        if (oppPlayer?.name) setDisplayOpponentName(oppPlayer.name);
        if (oppPlayer?.rating) setDisplayOpponentRating(oppPlayer.rating);

        if (full.state.status !== 'started' && full.state.status !== 'created') {
          handleGameEnd(full.state.status, full.state.winner);
        }
      } else if (event.type === 'gameState') {
        const state = event as GameState;
        setWtime(state.wtime);
        setBtime(state.btime);
        applyGameState(state.moves);

        if (state.status !== 'started' && state.status !== 'created') {
          handleGameEnd(state.status, state.winner);
        }
      } else if (event.type === 'opponentGone') {
        setOpponentGone((event as { type: string; gone: boolean }).gone);
      }
    }, abortRef.current.signal);

    return () => {
      abortRef.current?.abort();
    };
  }, [gameId, applyGameState, handleGameEnd]);

  const isMyTurn = useCallback(() => {
    if (gameEndedRef.current) return false;
    return chess.turn() === (myColor === 'white' ? 'w' : 'b');
  }, [chess, myColor]);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const executeMove = useCallback(async (from: Square, to: Square, promotion?: string) => {
    if (!isMyTurn() || gameEndedRef.current) return false;

    const token = getToken();
    if (!token) return false;

    const testChess = new Chess(chess.fen());
    const move = testChess.move({ from, to, promotion: (promotion || 'q') as 'q' | 'r' | 'b' | 'n' });
    if (!move) {
      triggerShake();
      return false;
    }

    const uciMove = from + to + (promotion || '');
    setSelectedSquare(null);
    setLegalMoves([]);
    setCaptureSquares([]);

    const ok = await sendMove(token, gameId, uciMove);
    if (!ok) triggerShake();

    return ok;
  }, [chess, isMyTurn, gameId]);

  const onPieceDrop = useCallback((sourceSquare: Square, targetSquare: Square) => {
    if (!isMyTurn()) return false;

    if (isPromotion(chess.fen(), sourceSquare, targetSquare)) {
      setPromotionSquare({ from: sourceSquare, to: targetSquare });
      return false;
    }

    const testChess = new Chess(chess.fen());
    const valid = testChess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    if (!valid) {
      triggerShake();
      return false;
    }

    executeMove(sourceSquare, targetSquare);
    return true;
  }, [chess, isMyTurn, executeMove]);

  const handleSquareClick = useCallback(async (square: Square) => {
    if (!isMyTurn()) return;

    const piece = chess.get(square);

    if (selectedSquare) {
      if (legalMoves.includes(square)) {
        if (isPromotion(chess.fen(), selectedSquare, square)) {
          setPromotionSquare({ from: selectedSquare, to: square });
          setSelectedSquare(null);
          setLegalMoves([]);
          setCaptureSquares([]);
          return;
        }
        await executeMove(selectedSquare, square);
      } else if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        setLegalMoves(getLegalMovesForSquare(chess.fen(), square));
        setCaptureSquares(getCaptureSquares(chess.fen(), square));
      } else {
        setSelectedSquare(null);
        setLegalMoves([]);
        setCaptureSquares([]);
      }
      return;
    }

    if (piece && piece.color === chess.turn()) {
      setSelectedSquare(square);
      setLegalMoves(getLegalMovesForSquare(chess.fen(), square));
      setCaptureSquares(getCaptureSquares(chess.fen(), square));
    }
  }, [chess, selectedSquare, legalMoves, isMyTurn, executeMove]);

  const handlePromotion = (piece: string) => {
    if (!promotionSquare) return;
    executeMove(promotionSquare.from, promotionSquare.to, piece);
    setPromotionSquare(null);
  };

  const handleResign = async () => {
    const token = getToken();
    if (token && !gameEndedRef.current) {
      await resignGame(token, gameId);
    }
  };

  const handleDrawOffer = async () => {
    const token = getToken();
    if (token) {
      await sendDrawOffer(token, gameId, true);
      setDrawOffered(true);
    }
  };

  // Square styles
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (selectedSquare) customSquareStyles[selectedSquare] = { backgroundColor: 'rgba(99,179,237,0.5)' };
  legalMoves.forEach((sq) => {
    if (!captureSquares.includes(sq)) {
      customSquareStyles[sq] = { background: 'radial-gradient(circle, rgba(99,179,237,0.6) 28%, transparent 32%)' };
    }
  });
  captureSquares.forEach((sq) => {
    customSquareStyles[sq] = { background: 'radial-gradient(circle, rgba(239,68,68,0.6) 42%, transparent 46%)' };
  });
  if (lastMove) {
    customSquareStyles[lastMove.from] = { ...customSquareStyles[lastMove.from], backgroundColor: 'rgba(245,158,11,0.3)' };
    customSquareStyles[lastMove.to] = { ...customSquareStyles[lastMove.to], backgroundColor: 'rgba(245,158,11,0.45)' };
  }

  const myTime = myColor === 'white' ? wtime : btime;
  const opponentTime = myColor === 'white' ? btime : wtime;
  const isMyTurnNow = isMyTurn();

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-5xl mx-auto">
      <div className="flex-shrink-0">
        {/* Opponent info + clock */}
        <div className="glass p-3 rounded-xl flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-lg">
              {myColor === 'white' ? '♟' : '♙'}
            </div>
            <div>
              <div className="text-sm font-semibold text-white/90">{displayOpponentName}</div>
              {opponentRating && <div className="text-xs text-white/40">Рейтинг {displayOpponentRating}</div>}
            </div>
          </div>
          <div
            className={`font-mono font-bold text-xl px-3 py-1 rounded-lg ${
              !isMyTurnNow ? 'text-yellow-400 bg-yellow-400/15' : 'text-white/50 bg-white/5'
            }`}
          >
            {formatTime(opponentTime)}
          </div>
        </div>

        {/* Board */}
        <motion.div className={`relative ${shaking ? 'shake' : ''}`}>
          <Chessboard
            position={fen}
            onSquareClick={handleSquareClick}
            onPieceDrop={onPieceDrop}
            customSquareStyles={customSquareStyles}
            boardWidth={boardWidth}
            customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
            customDarkSquareStyle={{ backgroundColor: '#b58863' }}
            boardOrientation={myColor}
            animationDuration={180}
            areArrowsAllowed={false}
          />
        </motion.div>

        {/* My info + clock */}
        <div className="glass p-3 rounded-xl flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-lg">
              {myColor === 'white' ? '♙' : '♟'}
            </div>
            <div>
              <div className="text-sm font-semibold text-yellow-400">{displayMyName} (Вы)</div>
              {myRating && <div className="text-xs text-white/40">Рейтинг {myRating}</div>}
            </div>
          </div>
          <div
            className={`font-mono font-bold text-xl px-3 py-1 rounded-lg ${
              isMyTurnNow ? 'text-yellow-400 bg-yellow-400/15' : 'text-white/50 bg-white/5'
            }`}
          >
            {formatTime(myTime)}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <motion.button
            onClick={handleResign}
            disabled={gameEnded}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-all"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          >
            🏳️ Сдаться
          </motion.button>
          <motion.button
            onClick={handleDrawOffer}
            disabled={gameEnded || drawOffered}
            className="flex-1 py-2 px-3 rounded-xl text-xs font-medium border border-white/15 text-white/60 hover:bg-white/5 disabled:opacity-40 transition-all"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          >
            {drawOffered ? '🤝 Предложено' : '🤝 Ничья'}
          </motion.button>
        </div>

        {/* Opponent gone warning */}
        <AnimatePresence>
          {opponentGone && !gameEnded && (
            <motion.div
              className="mt-3 p-3 rounded-xl text-sm text-center"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            >
              ⚠️ Соперник отключился. Ожидаем...
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Sidebar */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Turn indicator */}
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full border-2 border-white/20 ${chess.turn() === 'w' ? 'bg-white shadow-md' : 'bg-gray-900'}`} />
            <span className="text-sm font-medium">
              {chess.turn() === (myColor === 'white' ? 'w' : 'b') ? '⚡ Ваш ход' : '⏳ Ход соперника'}
            </span>
          </div>
          {chess.isCheck() && (
            <motion.span className="text-red-400 text-sm font-bold px-2 py-0.5 rounded-lg bg-red-500/15"
              animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
              ⚠️ Шах!
            </motion.span>
          )}
        </div>

        {/* Captured pieces */}
        <div className="glass p-4 rounded-xl">
          <div className="text-xs text-white/50 mb-2 uppercase tracking-wider">Взятые фигуры</div>
          <div className="flex items-start gap-1 mb-1">
            <span className="text-xs text-white/40 w-16 mt-0.5">Белые:</span>
            <span className="text-base leading-tight flex-1">{capturedPieces.white.join('') || '–'}</span>
          </div>
          <div className="flex items-start gap-1">
            <span className="text-xs text-white/40 w-16 mt-0.5">Чёрные:</span>
            <span className="text-base leading-tight flex-1">{capturedPieces.black.join('') || '–'}</span>
          </div>
        </div>

        {/* Move history */}
        <div className="glass p-4 rounded-xl flex-1 flex flex-col">
          <div className="text-xs text-white/50 mb-3 uppercase tracking-wider flex items-center justify-between">
            <span>История ходов</span>
            <span className="text-white/25">{Math.ceil(moveHistory.length / 2)} ход.</span>
          </div>
          <div ref={moveHistoryRef} className="overflow-y-auto" style={{ maxHeight: '220px' }}>
            {moveHistory.length === 0 ? (
              <p className="text-white/25 text-sm italic">Ходов пока нет...</p>
            ) : (
              <div className="space-y-0.5">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                  <div key={i} className="flex gap-2 text-sm font-mono py-0.5 px-1 rounded hover:bg-white/5">
                    <span className="text-white/25 w-7 text-right flex-shrink-0">{i + 1}.</span>
                    <span className="text-white/85 w-14 flex-shrink-0">{moveHistory[i * 2]}</span>
                    {moveHistory[i * 2 + 1] && <span className="text-white/65">{moveHistory[i * 2 + 1]}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass p-3 rounded-xl text-center text-xs text-white/35">
          🌐 Онлайн матч · Игра с живым соперником
        </div>
      </div>

      {/* Chat */}
      <OnlineChat sessionId={gameId} playerColor={myColor} />

      {/* Promotion modal */}
      <AnimatePresence>
        {promotionSquare && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="glass p-6 rounded-2xl text-center"
              initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
              <h3 className="text-xl font-bold mb-5 playfair text-yellow-400">Превращение пешки</h3>
              <div className="flex gap-4">
                {[{ p: 'q', s: '♛', n: 'Ферзь' }, { p: 'r', s: '♜', n: 'Ладья' }, { p: 'b', s: '♝', n: 'Слон' }, { p: 'n', s: '♞', n: 'Конь' }].map(({ p, s, n }) => (
                  <motion.button key={p} onClick={() => handlePromotion(p)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-white/10 hover:bg-white/10 hover:border-yellow-400/40 transition-all"
                    whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                    <span className="text-5xl">{s}</span>
                    <span className="text-xs text-white/60">{n}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
