'use client';

import { useState, useEffect, useRef, use } from 'react';
import { motion } from 'framer-motion';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { playChessSound } from '@/lib/sounds';

export default function DailyGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [game, setGame] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [fen, setFen] = useState('');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [opponentName, setOpponentName] = useState('Соперник');
  const [myName, setMyName] = useState('Игрок');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [boardWidth, setBoardWidth] = useState(400);
  const chessRef = useRef(new Chess());

  useEffect(() => {
    const update = () => setBoardWidth(Math.min(window.innerWidth < 640 ? window.innerWidth - 32 : 420, 460));
    update(); window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const loadGame = async (uid: string) => {
      const { data: g } = await supabase.from('daily_games').select('*').eq('id', id).single();
      if (!g) { router.push('/daily'); return; }
      setGame(g);

      const color = g.white_id === uid ? 'white' : 'black';
      setPlayerColor(color);

      const chess = new Chess(g.fen || undefined);
      chessRef.current = chess;
      setFen(chess.fen());

      const myTurn = (chess.turn() === 'w' && color === 'white') || (chess.turn() === 'b' && color === 'black');
      setIsMyTurn(myTurn && g.status === 'active');
      setGameOver(chess.isGameOver() || g.status === 'finished');
      setMoveHistory(g.moves_json?.map((m: any) => m.san || `${m.from}-${m.to}`) || []);

      const { data: myP } = await supabase.from('profiles').select('username').eq('id', uid).single();
      if (myP) setMyName(myP.username);
      const oppId = g.white_id === uid ? g.black_id : g.white_id;
      if (oppId) {
        const { data: oppP } = await supabase.from('profiles').select('username').eq('id', oppId).single();
        if (oppP) setOpponentName(oppP.username);
      }
    };

    let currentUid: string | null = null;

    // Auth init
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        currentUid = session.user.id;
        setUserId(currentUid);
        loadGame(currentUid);
      }
    });

    // Auth listener — не выкидывает при refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserId(null);
      } else if (session?.user && !currentUid) {
        currentUid = session.user.id;
        setUserId(currentUid);
        loadGame(currentUid);
      }
    });

    // Polling — обновляем доску каждые 5 сек (когда друг сделает ход)
    const poll = setInterval(async () => {
      if (!currentUid) return;
      const { data: g } = await supabase.from('daily_games').select('*').eq('id', id).single();
      if (!g) return;
      const color = g.white_id === currentUid ? 'white' : 'black';
      const chess = new Chess(g.fen || undefined);
      chessRef.current = chess;
      setFen(chess.fen());
      setGame(g);
      const myTurn = (chess.turn() === 'w' && color === 'white') || (chess.turn() === 'b' && color === 'black');
      setIsMyTurn(myTurn && g.status === 'active');
      setGameOver(chess.isGameOver() || g.status === 'finished');
      setMoveHistory(g.moves_json?.map((m: any) => m.san || `${m.from}-${m.to}`) || []);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearInterval(poll);
    };
  }, [id, router]);

  const saveMove = async (from: string, to: string, san: string) => {
    if (!game) return;
    const newMoves = [...(game.moves_json || []), { from, to, san }];
    const newFen = chessRef.current.fen();
    const isOver = chessRef.current.isGameOver();

    let result = null;
    let status = 'active';
    if (isOver) {
      status = 'finished';
      result = chessRef.current.isCheckmate() ? (chessRef.current.turn() === 'w' ? 'black' : 'white') : 'draw';
      setGameOver(true);
    }

    await supabase.from('daily_games').update({
      fen: newFen, moves_json: newMoves, status, result,
      updated_at: new Date().toISOString(), last_move_at: new Date().toISOString(),
    }).eq('id', game.id);

    setMoveHistory(newMoves.map((m: any) => m.san));
    setGame({ ...game, fen: newFen, moves_json: newMoves, status, result });
  };

  const handleDrop = (from: Square, to: Square): boolean => {
    if (!isMyTurn || gameOver || !game) return false;
    const move = chessRef.current.move({ from, to, promotion: 'q' });
    if (!move) return false;
    playChessSound(move);
    setFen(chessRef.current.fen());
    setIsMyTurn(false);
    saveMove(from, to, move.san);
    return true;
  };

  if (!game || !userId) return (
    <div className="min-h-screen"><Header />
      <div className="flex items-center justify-center min-h-screen">
        <motion.div className="text-3xl" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>♞</motion.div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Info bar */}
          <motion.div className="glass p-4 rounded-xl mb-4 flex items-center gap-4"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-2xl">📬</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-yellow-400">Партия по переписке</div>
              <div className="text-xs text-white/30">
                {myName} ({playerColor === 'white' ? '♔' : '♚'}) vs {opponentName} ({playerColor === 'white' ? '♚' : '♔'})
              </div>
            </div>
            <div className="text-right">
              {gameOver ? (
                <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/50">Завершена</span>
              ) : isMyTurn ? (
                <span className="text-xs px-2 py-1 rounded-full bg-green-400/15 text-green-400 font-semibold">Ваш ход!</span>
              ) : (
                <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-white/30">Ждём соперника</span>
              )}
            </div>
          </motion.div>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* Board */}
            <div className="flex-shrink-0">
              <Chessboard
                position={fen}
                boardWidth={boardWidth}
                onPieceDrop={handleDrop}
                customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
                customDarkSquareStyle={{ backgroundColor: '#b58863' }}
                boardOrientation={playerColor}
                arePiecesDraggable={isMyTurn && !gameOver}
                animationDuration={200}
              />

              <div className="flex gap-2 mt-3">
                <motion.button onClick={() => router.push('/daily')}
                  className="flex-1 py-2 rounded-xl text-sm border border-white/10 text-white/50"
                  whileTap={{ scale: 0.95 }}>
                  ← Назад
                </motion.button>
              </div>
            </div>

            {/* Move list */}
            <div className="flex-1 min-w-0">
              <div className="glass rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: boardWidth }}>
                <div className="p-3 border-b border-white/10">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Ходы ({moveHistory.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {moveHistory.length > 0 ? (
                    <div className="space-y-0.5">
                      {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => {
                        const w = moveHistory[i * 2];
                        const b = moveHistory[i * 2 + 1];
                        return (
                          <div key={i} className="flex gap-1 text-sm font-mono">
                            <span className="text-white/20 w-6 text-right text-xs py-0.5">{i + 1}.</span>
                            <span className="flex-1 px-1 py-0.5 text-white/80 text-xs">{w}</span>
                            {b && <span className="flex-1 px-1 py-0.5 text-white/60 text-xs">{b}</span>}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-white/30 text-sm text-center py-8">Пока нет ходов</p>
                  )}
                </div>

                {/* Game over result */}
                {gameOver && game.result && (
                  <div className="p-4 border-t border-white/10 text-center">
                    <div className="text-2xl mb-2">
                      {game.result === playerColor ? '🏆' : game.result === 'draw' ? '🤝' : '😔'}
                    </div>
                    <div className="text-sm font-bold" style={{ color: game.result === playerColor ? '#4ade80' : game.result === 'draw' ? '#fbbf24' : '#f87171' }}>
                      {game.result === playerColor ? 'Победа!' : game.result === 'draw' ? 'Ничья' : 'Поражение'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
