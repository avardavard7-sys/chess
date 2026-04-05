'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';

interface GameRecord {
  id: string;
  result: string;
  elo_change: number;
  elo_before: number;
  elo_after: number;
  played_at: string;
  mode: string;
  difficulty: string;
  player_color: string;
  opponent_name: string;
  moves_json: unknown[];
  analysis_json: unknown;
  accuracy_white: number | null;
  accuracy_black: number | null;
  opponent: { username: string; avatar_url: string; elo_rating: number } | null;
}

const modeLabels: Record<string, { label: string; icon: string }> = {
  ai: { label: 'vs AI', icon: '🤖' },
  local: { label: 'Вдвоём', icon: '👥' },
  online: { label: 'Онлайн', icon: '🌐' },
  friend: { label: 'С другом', icon: '🔗' },
};

export default function AnalysisListPage() {
  const router = useRouter();
  const [games, setGames] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
      if (!user) { setLoading(false); return; }
      setUserId(user.id);

      const { data } = await supabase
        .from('game_history')
        .select('*, opponent:profiles!game_history_opponent_id_fkey(username, avatar_url, elo_rating)')
        .eq('user_id', user.id)
        .order('played_at', { ascending: false })
        .limit(50);

      if (data) setGames(data as GameRecord[]);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>♞</motion.div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-screen pt-24 px-4">
          <motion.div className="glass p-10 rounded-2xl text-center max-w-md w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-6xl mb-5">🔬</div>
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Анализ партий</h2>
            <p className="text-white/60 mb-8">Войдите для доступа к анализу</p>
            <motion.button
              onClick={() => import('@/lib/supabase').then((m) => m.signInWithGoogle())}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-black"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              Войти через Google
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div className="flex items-center justify-between mb-8" initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}>
            <div>
              <h1 className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
                🔬 Анализ партий
              </h1>
              <p className="text-white/40 text-sm mt-1">Выберите партию для детального анализа</p>
            </div>
          </motion.div>

          {games.length === 0 ? (
            <motion.div className="glass p-10 rounded-2xl text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="text-5xl mb-4">♟</div>
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Партий пока нет</h3>
              <p className="text-white/40 text-sm mb-6">Сыграйте партию, и она появится здесь для анализа</p>
              <motion.button
                onClick={() => router.push('/')}
                className="px-6 py-3 rounded-xl font-semibold text-black"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              >
                Начать игру
              </motion.button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {games.map((game, i) => {
                const modeInfo = modeLabels[game.mode || 'ai'] || modeLabels.ai;
                const hasAnalysis = !!game.analysis_json;
                const hasMoves = game.moves_json && (game.moves_json as unknown[]).length > 0;
                const moveCount = hasMoves ? (game.moves_json as unknown[]).length : 0;
                const playerAccuracy = game.player_color === 'white' ? game.accuracy_white : game.accuracy_black;

                return (
                  <motion.div
                    key={game.id}
                    className="glass p-4 rounded-xl cursor-pointer hover:border-yellow-400/30 transition-all"
                    style={{ borderColor: hasAnalysis ? 'rgba(74,222,128,0.2)' : undefined }}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    whileHover={{ scale: 1.01, y: -2 }}
                    onClick={() => {
                      if (hasMoves) router.push(`/analysis/${game.id}`);
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Result icon */}
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                        style={{
                          background: game.result === 'win' ? 'rgba(74,222,128,0.15)' : game.result === 'loss' ? 'rgba(248,113,113,0.15)' : 'rgba(148,163,184,0.15)',
                          border: `1px solid ${game.result === 'win' ? 'rgba(74,222,128,0.3)' : game.result === 'loss' ? 'rgba(248,113,113,0.3)' : 'rgba(148,163,184,0.3)'}`,
                        }}
                      >
                        {game.result === 'win' ? '🏆' : game.result === 'loss' ? '😔' : '🤝'}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white truncate">
                            {game.opponent_name || game.opponent?.username || 'Соперник'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                            {modeInfo.icon} {modeInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span>{new Date(game.played_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          {moveCount > 0 && <span>{moveCount} ходов</span>}
                          <span className="font-bold" style={{ color: game.elo_change >= 0 ? '#4ade80' : '#f87171' }}>
                            {game.elo_change >= 0 ? '+' : ''}{game.elo_change} ELO
                          </span>
                        </div>
                      </div>

                      {/* Accuracy or analyze button */}
                      <div className="flex-shrink-0 text-right">
                        {hasAnalysis && playerAccuracy != null ? (
                          <div>
                            <div className="text-lg font-bold" style={{ color: playerAccuracy >= 80 ? '#4ade80' : playerAccuracy >= 50 ? '#fbbf24' : '#f87171' }}>
                              {playerAccuracy}%
                            </div>
                            <div className="text-xs text-white/30">Точность</div>
                          </div>
                        ) : hasMoves ? (
                          <div
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', color: 'white' }}
                          >
                            Анализировать →
                          </div>
                        ) : (
                          <div className="text-xs text-white/20">Нет данных</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
