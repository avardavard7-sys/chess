'use client';

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import { Chessboard } from 'react-chessboard';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';

export default function WatchGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const router = useRouter();
  const [game, setGame] = useState<any>(null);
  const [boardWidth, setBoardWidth] = useState(400);

  useEffect(() => {
    const u = () => setBoardWidth(Math.min(window.innerWidth < 640 ? window.innerWidth - 32 : 440, 480));
    u(); window.addEventListener('resize', u); return () => window.removeEventListener('resize', u);
  }, []);

  useEffect(() => {
    // Load game
    supabase.from('live_games').select('*').eq('id', gameId).single().then(({ data }) => {
      if (data) setGame(data);
    });

    // Realtime subscription
    const channel = supabase.channel(`watch-${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'live_games',
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        setGame(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  if (!game) return (
    <div className="min-h-screen"><Header />
      <div className="flex items-center justify-center min-h-screen"><div className="text-white/40">Загрузка...</div></div>
    </div>
  );

  const moves = game.moves_json || [];
  const isFinished = game.status === 'finished';

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.button onClick={() => router.back()} className="text-white/40 text-sm mb-4 hover:text-white/80">
            {'<-'} Назад
          </motion.button>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Board */}
            <div className="flex-shrink-0">
              <div className="glass p-4 rounded-xl mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-800 border border-white/20" />
                    <span className="text-sm font-semibold text-white">{game.black_name || '?'}</span>
                  </div>
                  {!isFinished && (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      LIVE
                    </span>
                  )}
                  {isFinished && (
                    <span className="text-xs text-white/40">
                      {game.result === 'white' ? '0-1' : game.result === 'black' ? '1-0' : game.result === 'draw' ? '1/2' : game.result}
                    </span>
                  )}
                </div>
              </div>

              <Chessboard
                position={game.fen}
                boardWidth={boardWidth}
                customLightSquareStyle={{ backgroundColor: '#f0d9b5' }}
                customDarkSquareStyle={{ backgroundColor: '#b58863' }}
                arePiecesDraggable={false}
                animationDuration={300}
              />

              <div className="glass p-4 rounded-xl mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-white border border-white/20" />
                  <span className="text-sm font-semibold text-white">{game.white_name || '?'}</span>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="flex-1 min-w-0 flex flex-col gap-4">
              <div className="glass p-4 rounded-xl">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Информация</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-white/40">Режим</span><span className="text-white/70">{game.mode}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Статус</span><span className={isFinished ? 'text-white/40' : 'text-green-400'}>{isFinished ? 'Завершена' : 'Идёт'}</span></div>
                  <div className="flex justify-between"><span className="text-white/40">Ходов</span><span className="text-white/70">{moves.length}</span></div>
                  {game.tournament_id && <div className="flex justify-between"><span className="text-white/40">Турнир</span><span className="text-yellow-400">Да</span></div>}
                </div>
              </div>

              {/* Move list */}
              <div className="glass rounded-xl overflow-hidden flex-1">
                <div className="p-3 border-b border-white/10">
                  <span className="text-xs text-white/40 uppercase tracking-wider">Ходы</span>
                </div>
                <div className="overflow-y-auto p-3 font-mono text-sm" style={{ maxHeight: boardWidth - 100 }}>
                  {moves.length === 0 ? (
                    <p className="text-white/20 text-center py-4">Ожидание ходов...</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {moves.map((m: any, i: number) => (
                        <span key={i} className="px-1.5 py-0.5 rounded text-xs bg-white/5 text-white/60">
                          {i % 2 === 0 ? `${Math.floor(i / 2) + 1}.` : ''}{m.san || m.to || m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
