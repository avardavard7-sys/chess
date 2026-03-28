'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';

type SortBy = 'elo' | 'puzzle' | 'coins' | 'games';

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('elo');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) setUserId(session.user.id);
      const { data } = await supabase.from('profiles')
        .select('id, username, avatar_url, elo_rating, puzzle_rating, coins, games_played, games_won')
        .order('elo_rating', { ascending: false });
      setPlayers(data || []);
    };
    load();
  }, []);

  const sorted = [...players].sort((a, b) => {
    if (sortBy === 'elo') return (b.elo_rating || 0) - (a.elo_rating || 0);
    if (sortBy === 'puzzle') return (b.puzzle_rating || 0) - (a.puzzle_rating || 0);
    if (sortBy === 'coins') return (b.coins || 0) - (a.coins || 0);
    return (b.games_played || 0) - (a.games_played || 0);
  });

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div className="text-center mb-6" initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Таблица лидеров</h1>
            <p className="text-white/50 text-sm">Лучшие игроки школы</p>
          </motion.div>

          <div className="flex gap-2 mb-6 justify-center">
            {([['elo', 'ELO', '⚔️'], ['puzzle', 'Puzzle', '🧩'], ['coins', 'Коины', '🪙'], ['games', 'Партии', '♟']] as [SortBy, string, string][]).map(([key, label, icon]) => (
              <button key={key} onClick={() => setSortBy(key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${sortBy === key ? 'bg-yellow-500/20 text-yellow-400' : 'text-white/40 hover:text-white/60 glass'}`}>
                {icon} {label}
              </button>
            ))}
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            {sorted.map((p, i) => {
              const isMe = p.id === userId;
              const value = sortBy === 'elo' ? p.elo_rating : sortBy === 'puzzle' ? (p.puzzle_rating || 1200) : sortBy === 'coins' ? (p.coins || 0) : p.games_played;
              const winRate = p.games_played > 0 ? Math.round((p.games_won / p.games_played) * 100) : 0;
              return (
                <motion.div key={p.id}
                  className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 ${isMe ? 'bg-yellow-500/10' : 'hover:bg-white/5'} transition-all`}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                  <span className="text-lg w-8 text-center">{i < 3 ? medals[i] : <span className="text-xs text-white/30">{i + 1}</span>}</span>
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm overflow-hidden">
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : '♟'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{p.username || 'Игрок'} {isMe && <span className="text-yellow-400 text-xs">(вы)</span>}</div>
                    <div className="text-xs text-white/30">{p.games_played} партий | {winRate}% побед</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif", color: sortBy === 'coins' ? '#f59e0b' : sortBy === 'puzzle' ? '#a855f7' : '#4ade80' }}>
                      {value}
                    </div>
                    <div className="text-xs text-white/20">
                      {sortBy === 'elo' ? 'ELO' : sortBy === 'puzzle' ? 'Puzzle' : sortBy === 'coins' ? 'коинов' : 'партий'}
                    </div>
                  </div>
                </motion.div>
              );
            })}
            {sorted.length === 0 && <div className="p-10 text-center text-white/30">Нет игроков</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
