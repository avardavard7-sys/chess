'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import { getAIMove, parseStockfishMove, DIFFICULTY_CONFIG } from '@/lib/stockfish';
import { getLegalMovesForSquare, getCaptureSquares, getGameStatus, isPromotion, getCapturedPieces } from '@/lib/chess-logic';
import { supabase, updateElo, getProfile } from '@/lib/supabase';
import { calculateEloChange } from '@/lib/elo';
import type { Difficulty } from '@/store/gameStore';

interface ChessBoardProps {
  difficulty: Difficulty;
  mode: 'ai' | 'local' | 'online' | 'friend';
  isKidsMode?: boolean;
  sessionId?: string;
  playerColor?: 'white' | 'black';
  onGameOver?: (result: 'win' | 'loss' | 'draw', eloChange: number) => void;
}

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function ChessBoard({
  difficulty,
  mode,
  isKidsMode = false,
  sessionId,
  playerColor = 'white',
  onGameOver,
}: ChessBoardProps) {
  const chessRef = useRef(new Chess());
  const chess = chessRef.current;
  const [fen, setFen] = useState(INITIAL_FEN);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [captureSquares, setCaptureSquares] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [capturedPieces, setCapturedPieces] = useState<{ white: string[]; black: string[] }>({ white: [], black: [] });
  const [promotionSquare, setPromotionSquare] = useState<{ from: Square; to: Square } | null>(null);
  const [gameOver, setGameOver] = useState<{ status: string; winner?: string } | null>(null);
  const [playerElo, setPlayerElo] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [boardWidth, setBoardWidth] = useState(480);
  const moveHistoryRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isThinkingRef = useRef(false);
  const gameOverRef = useRef(false);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setBoardWidth(Math.min(w < 640 ? w - 32 : w < 1024 ? 460 : 520, 560));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const isMyTurn = useCallback(() => {
    if (gameOverRef.current) return false;
    if (mode === 'local') return true;
    if (mode === 'ai') return chess.turn() === 'w';
    return chess.turn() === (playerColor === 'white' ? 'w' : 'b');
  }, [mode, playerColor, chess]);

  useEffect(() => {
    if (mode === 'ai' || mode === 'online' || mode === 'friend') {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          const { data } = await getProfile(user.id);
          if (data) {
            setPlayerElo(data.elo_rating);
            setGamesPlayed(data.games_played || 0);
          }
        }
      });
    }
  }, [mode]);

  useEffect(() => {
    if ((mode !== 'online' && mode !== 'friend') || !sessionId) return;
    const channel = supabase.channel(`game:${sessionId}`, {
      config: { broadcast: { self: false }, presence: { key: playerColor } },
    });
    channelRef.current = channel;
    channel
      .on('broadcast', { event: 'MOVE' }, ({ payload }) => {
        const { move, fen: newFen } = payload;
        chess.load(newFen);
        setFen(newFen);
        setLastMove({ from: move.from as Square, to: move.to as Square });
        setMoveHistory((prev) => [...prev, move.san || '']);
        updateCaptured();
        checkGameOverState();
      })
      .on('broadcast', { event: 'RESIGN' }, () => {
        gameOverRef.current = true;
        setGameOver({ status: 'resigned', winner: playerColor });
        handleGameEnd('win');
      })
      .on('presence', { event: 'sync' }, () => {})
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ color: playerColor, online: true });
        }
      });
    return () => { channel.unsubscribe(); };
  }, [mode, sessionId]);

  const updateCaptured = useCallback(() => {
    const history = chess.history({ verbose: true });
    const captured = getCapturedPieces(history as Array<{ captured?: string; color: string }>);
    setCapturedPieces(captured);
  }, [chess]);

  const handleGameEnd = useCallback(async (result: 'win' | 'loss' | 'draw') => {
    const config = DIFFICULTY_CONFIG[difficulty];
    const opponentElo = mode === 'ai' ? config.eloTarget : playerElo;
    const change = calculateEloChange(playerElo, opponentElo, result, gamesPlayed);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await updateElo(user.id, playerElo + change, result);
    onGameOver?.(result, change);
  }, [difficulty, mode, playerElo, gamesPlayed, onGameOver]);

  const checkGameOverState = useCallback(() => {
    if (gameOverRef.current) return;
    const status = getGameStatus(chess.fen());
    if (status.status !== 'playing') {
      gameOverRef.current = true;
      setGameOver({ status: status.status, winner: status.winner });
      if (mode === 'ai' || mode === 'online' || mode === 'friend') {
        const result: 'win' | 'loss' | 'draw' =
          status.status === 'checkmate'
            ? status.winner === playerColor ? 'win' : 'loss'
            : 'draw';
        handleGameEnd(result);
      }
    }
  }, [chess, mode, playerColor, handleGameEnd]);

  const runAI = useCallback(async (currentFen: string) => {
    if (isThinkingRef.current || gameOverRef.current) return;
    isThinkingRef.current = true;
    setIsThinking(true);
    try {
      const aiMoveStr = await getAIMove(currentFen, difficulty);
      const parsed = parseStockfishMove(aiMoveStr);
      const aiMove = chess.move({
        from: parsed.from as Square,
        to: parsed.to as Square,
        promotion: (parsed.promotion || 'q') as 'q' | 'r' | 'b' | 'n',
      });
      if (aiMove) {
        const aiFen = chess.fen();
        setFen(aiFen);
        setLastMove({ from: parsed.from as Square, to: parsed.to as Square });
        setMoveHistory((prev) => [...prev, aiMove.san]);
        updateCaptured();
        checkGameOverState();
      }
    } catch (err) {
      console.error('AI error:', err);
    } finally {
      isThinkingRef.current = false;
      setIsThinking(false);
    }
  }, [chess, difficulty, updateCaptured, checkGameOverState]);

  const triggerShake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const executeMove = useCallback(async (from: Square, to: Square, promotion?: string) => {
    if (gameOverRef.current) return false;

    const move = chess.move({
      from,
      to,
      promotion: (promotion || 'q') as 'q' | 'r' | 'b' | 'n',
    });

    if (!move) {
      triggerShake();
      return false;
    }

    const newFen = chess.fen();
    setFen(newFen);
    setLastMove({ from, to });
    setSelectedSquare(null);
    setLegalMoves([]);
    setCaptureSquares([]);
    setMoveHistory((prev) => [...prev, move.san]);
    updateCaptured();

    setTimeout(() => {
      if (moveHistoryRef.current) {
        moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
      }
    }, 50);

    if ((mode === 'online' || mode === 'friend') && channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'MOVE',
        payload: { move: { from, to, promotion, san: move.san }, fen: newFen },
      });
    }

    checkGameOverState();

    if (mode === 'ai' && !chess.isGameOver()) {
      await runAI(newFen);
    }

    return true;
  }, [chess, mode, updateCaptured, checkGameOverState, runAI]);

  // ✅ DRAG AND DROP — AI отвечает после перетаскивания
  const onPieceDrop = useCallback((sourceSquare: Square, targetSquare: Square) => {
    if (!isMyTurn()) return false;

    if (isPromotion(chess.fen(), sourceSquare, targetSquare)) {
      setPromotionSquare({ from: sourceSquare, to: targetSquare });
      return false;
    }

    // Test if move is legal
    const testChess = new Chess(chess.fen());
    const testMove = testChess.move({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    if (!testMove) {
      triggerShake();
      return false;
    }

    executeMove(sourceSquare, targetSquare);
    return true;
  }, [chess, isMyTurn, executeMove]);

  // ✅ CLICK handler
  const handleSquareClick = useCallback(async (square: Square) => {
    if (!isMyTurn() || isThinkingRef.current) return;

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
    if (gameOverRef.current) return;
    if ((mode === 'online' || mode === 'friend') && channelRef.current) {
      await channelRef.current.send({ type: 'broadcast', event: 'RESIGN', payload: {} });
    }
    gameOverRef.current = true;
    setGameOver({ status: 'resigned' });
    await handleGameEnd('loss');
  };

  const handleNewGame = () => {
    chess.reset();
    gameOverRef.current = false;
    isThinkingRef.current = false;
    setFen(INITIAL_FEN);
    setSelectedSquare(null);
    setLegalMoves([]);
    setCaptureSquares([]);
    setLastMove(null);
    setMoveHistory([]);
    setCapturedPieces({ white: [], black: [] });
    setGameOver(null);
    setIsThinking(false);
  };

  // Square styles
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (selectedSquare) {
    customSquareStyles[selectedSquare] = { backgroundColor: 'rgba(99,179,237,0.5)' };
  }
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

  const boardColors = isKidsMode
    ? { light: '#fce7f3', dark: '#a78bfa' }
    : { light: '#f0d9b5', dark: '#b58863' };

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full max-w-5xl mx-auto">
      <div className="flex-shrink-0">
        <motion.div className={`relative ${shaking ? 'shake' : ''}`}>
          <AnimatePresence>
            {isThinking && (
              <motion.div
                className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center gap-2 py-2 rounded-t-lg text-sm font-medium"
                style={{ background: 'rgba(124,58,237,0.92)', color: 'white' }}
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              >
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>♞</motion.span>
                ИИ думает...
              </motion.div>
            )}
          </AnimatePresence>

          <Chessboard
            position={fen}
            onSquareClick={handleSquareClick}
            onPieceDrop={onPieceDrop}
            customSquareStyles={customSquareStyles}
            boardWidth={boardWidth}
            customLightSquareStyle={{ backgroundColor: boardColors.light }}
            customDarkSquareStyle={{ backgroundColor: boardColors.dark }}
            boardOrientation={playerColor}
            animationDuration={180}
            areArrowsAllowed={false}
          />
        </motion.div>

        <div className="flex gap-3 mt-4">
          <motion.button onClick={handleResign} disabled={!!gameOver}
            className="flex-1 py-2 px-4 rounded-xl text-sm font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-all"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            🏳️ Сдаться
          </motion.button>
          <motion.button onClick={handleNewGame}
            className="flex-1 py-2 px-4 rounded-xl text-sm font-medium border border-green-500/30 text-green-400 hover:bg-green-500/10 transition-all"
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            🔄 Новая игра
          </motion.button>
        </div>
      </div>

      {/* Sidebar */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="glass p-4 rounded-xl flex items-center justify-between"
          style={isKidsMode ? { background: 'rgba(255,255,255,0.85)', border: '2px solid #a78bfa' } : {}}>
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded-full border-2 border-white/20 ${chess.turn() === 'w' ? 'bg-white shadow-md' : 'bg-gray-900'}`} />
            <span className="text-sm font-medium" style={isKidsMode ? { color: '#4c1d95' } : {}}>
              Ход: {chess.turn() === 'w' ? 'Белые' : 'Чёрные'}
            </span>
          </div>
          {chess.isCheck() && (
            <motion.span className="text-red-400 text-sm font-bold px-2 py-0.5 rounded-lg bg-red-500/15"
              animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 0.6, repeat: Infinity }}>
              ⚠️ Шах!
            </motion.span>
          )}
        </div>

        <div className="glass p-4 rounded-xl" style={isKidsMode ? { background: 'rgba(255,255,255,0.85)' } : {}}>
          <div className="text-xs text-white/50 mb-2 uppercase tracking-wider" style={isKidsMode ? { color: '#6d28d9' } : {}}>
            Взятые фигуры
          </div>
          <div className="flex items-start gap-1 mb-1">
            <span className="text-xs text-white/40 w-16 mt-0.5" style={isKidsMode ? { color: '#7c3aed' } : {}}>Белые:</span>
            <span className="text-base leading-tight flex-1">{capturedPieces.white.join('') || '–'}</span>
          </div>
          <div className="flex items-start gap-1">
            <span className="text-xs text-white/40 w-16 mt-0.5" style={isKidsMode ? { color: '#7c3aed' } : {}}>Чёрные:</span>
            <span className="text-base leading-tight flex-1">{capturedPieces.black.join('') || '–'}</span>
          </div>
        </div>

        <div className="glass p-4 rounded-xl flex-1 flex flex-col" style={isKidsMode ? { background: 'rgba(255,255,255,0.85)' } : {}}>
          <div className="text-xs text-white/50 mb-3 uppercase tracking-wider flex items-center justify-between"
            style={isKidsMode ? { color: '#6d28d9' } : {}}>
            <span>История ходов</span>
            <span className="text-white/30">{Math.ceil(moveHistory.length / 2)} ход{moveHistory.length >= 2 ? 'а' : ''}</span>
          </div>
          <div ref={moveHistoryRef} className="overflow-y-auto" style={{ maxHeight: '220px' }}>
            {moveHistory.length === 0 ? (
              <p className="text-white/30 text-sm italic">Ходов пока нет...</p>
            ) : (
              <div className="space-y-0.5">
                {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                  <div key={i} className="flex gap-2 text-sm font-mono py-0.5 rounded px-1 hover:bg-white/5">
                    <span className="text-white/25 w-7 text-right flex-shrink-0">{i + 1}.</span>
                    <span className="text-white/85 w-14 flex-shrink-0">{moveHistory[i * 2]}</span>
                    {moveHistory[i * 2 + 1] && (
                      <span className="text-white/65">{moveHistory[i * 2 + 1]}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="glass p-3 rounded-xl text-center text-xs text-white/40"
          style={isKidsMode ? { background: 'rgba(255,255,255,0.7)', color: '#6d28d9' } : {}}>
          {mode === 'ai' && `🤖 Hod Konem AI · ${DIFFICULTY_CONFIG[difficulty].label} · ELO ${DIFFICULTY_CONFIG[difficulty].eloTarget}`}
          {mode === 'local' && '👥 Игра вдвоём на одном экране'}
          {mode === 'online' && '🌐 Онлайн матч · Рейтинговая партия'}
          {mode === 'friend' && '👥 Игра с другом'}
        </div>
      </div>

      {/* Promotion modal */}
      <AnimatePresence>
        {promotionSquare && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="glass p-6 rounded-2xl text-center"
              initial={{ scale: 0.8, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.8, y: 20 }}>
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
