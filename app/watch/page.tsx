'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/lib/i18n';

export default function WatchPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      // Автозакрытие старых партий
      await supabase.from('live_games').update({ status: 'finished', finished_at: new Date().toISOString() })
        .eq('status', 'active').lt('started_at', twoHoursAgo);

      const { data } = await supabase.from('live_games')
        .select('*').eq('status', 'active')
        .gte('started_at', twoHoursAgo)
        .order('started_at', { ascending: false });
      setGames(data || []);
      setLoading(false);
    };
    load();

    // Realtime
    const channel = supabase.channel('live-games-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_games' }, () => {
        load();
      })
      .subscribe();

    // Обновлять каждые 10 сек
    const interval = setInterval(load, 10000);

    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, []);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
              Сейчас играют
            </h1>
            <p className="text-white/50">{t('live_watch')}</p>
          </motion.div>

          {loading ? (
            <div className="text-center text-white/30 py-20">{t("loading")}</div>
          ) : games.length === 0 ? (
            <motion.div className="glass p-10 rounded-2xl text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="text-5xl mb-4">{'🎮'}</div>
              <p className="text-white/40">{t('nobody_plays')}</p>
              <p className="text-white/20 text-sm mt-2">{t('game_appear')}</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {games.map((g, i) => (
                <motion.button key={g.id} onClick={() => router.push(`/watch/${g.id}`)}
                  className="w-full glass p-5 rounded-xl text-left flex items-center gap-4 hover:border-yellow-400/30 transition-all group"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.01 }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-xs font-bold text-red-400">LIVE</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded-full bg-white border border-white/20" />
                      <span className="font-semibold text-white">{g.white_name || '?'}</span>
                      <span className="text-white/20 mx-1">vs</span>
                      <div className="w-3 h-3 rounded-full bg-gray-800 border border-white/20" />
                      <span className="font-semibold text-white">{g.black_name || '?'}</span>
                    </div>
                    <div className="text-xs text-white/30 mt-1">
                      {g.mode || 'online'} | {(g.moves_json || []).length} ходов
                      {g.tournament_id && ' | Турнир'}
                    </div>
                  </div>
                  <span className="text-white/20 group-hover:text-yellow-400 transition-colors text-lg">{'>'}</span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
