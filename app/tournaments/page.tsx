'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { getTournaments, joinTournament, leaveTournament, type Tournament } from '@/lib/tournaments';

export default function TournamentsPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [myTournaments, setMyTournaments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async (uid?: string) => {
      const t = await getTournaments();
      setTournaments(t as Tournament[]);
      if (uid) {
        const { data } = await supabase.from('tournament_participants').select('tournament_id').eq('user_id', uid);
        if (data) setMyTournaments(new Set(data.map(d => d.tournament_id)));
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
      loadData(session?.user?.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserId(null);
        setMyTournaments(new Set());
      } else if (session?.user) {
        setUserId(session.user.id);
        loadData(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleJoin = async (tid: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { alert('Войдите в аккаунт'); return; }
      const uid = session.user.id;

      // Проверяем уже участвует
      const { data: existing } = await supabase.from('tournament_participants')
        .select('id').eq('tournament_id', tid).eq('user_id', uid);
      if (existing && existing.length > 0) {
        setMyTournaments(new Set([...myTournaments, tid]));
        return;
      }

      // Прямой INSERT
      const { data: profile } = await supabase.from('profiles').select('elo_rating').eq('id', uid).single();
      const { error } = await supabase.from('tournament_participants').insert({
        tournament_id: tid, user_id: uid, tournament_rating: profile?.elo_rating || 1200,
      });

      if (error) {
        alert('Ошибка: ' + error.message);
        return;
      }
      setMyTournaments(new Set([...myTournaments, tid]));
    } catch (e: any) {
      alert('Ошибка: ' + (e?.message || 'Попробуйте ещё'));
    }
  };

  const handleLeave = async (id: string) => {
    await leaveTournament(id);
    const s = new Set(myTournaments);
    s.delete(id);
    setMyTournaments(s);
  };

  const statusColors: Record<string, string> = { upcoming: '#fbbf24', active: '#4ade80', paused: '#fb923c', finished: '#94a3b8' };
  const statusLabels: Record<string, string> = { upcoming: 'Скоро', active: 'Идёт', paused: 'Пауза', finished: 'Завершён' };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
              {'🏆'} Турниры
            </h1>
            <p className="text-white/50">Соревнуйтесь с другими учениками</p>
          </motion.div>

          {loading ? (
            <div className="text-center text-white/30 py-20">Загрузка...</div>
          ) : tournaments.length === 0 ? (
            <div className="glass p-10 rounded-2xl text-center">
              <div className="text-5xl mb-4">{'🏆'}</div>
              <p className="text-white/40">Пока нет турниров</p>
              <p className="text-white/20 text-sm mt-2">Администратор скоро создаст новый!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {tournaments.map((t, i) => {
                const joined = myTournaments.has(t.id);
                const canJoin = t.status === 'upcoming' && !joined;
                const canLeave = t.status === 'upcoming' && joined;
                const startDate = t.start_time ? new Date(t.start_time) : null;
                const timeLeft = startDate ? startDate.getTime() - Date.now() : 0;
                const countdownText = timeLeft > 0
                  ? timeLeft > 86400000
                    ? `через ${Math.floor(timeLeft / 86400000)}д ${Math.floor((timeLeft % 86400000) / 3600000)}ч`
                    : timeLeft > 3600000
                    ? `через ${Math.floor(timeLeft / 3600000)}ч ${Math.floor((timeLeft % 3600000) / 60000)}м`
                    : `через ${Math.floor(timeLeft / 60000)}м`
                  : '';

                return (
                  <motion.div key={t.id} className="glass p-5 rounded-xl"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <div className="flex items-start gap-4">
                      <div className="text-3xl">{'🏆'}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>{t.name}</h3>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${statusColors[t.status]}20`, color: statusColors[t.status] }}>
                            {statusLabels[t.status]}
                          </span>
                        </div>
                        {t.description && <p className="text-sm text-white/40 mb-3">{t.description}</p>}
                        <div className="flex flex-wrap gap-4 text-xs text-white/30">
                          <span>{'⏱'} {t.time_control}</span>
                          <span>{t.format === 'knockout' ? '🥊 Плей-офф' : '🔄 Швейцарская'}</span>
                          <span>{'👥'} до {t.max_participants} чел.</span>
                          <span>{'📅'} Раунд {t.current_round}/{t.total_rounds}</span>
                          {startDate && <span>{'🕐'} {startDate.toLocaleDateString('ru')} {startDate.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>}
                          {t.status === 'upcoming' && countdownText && <span className="text-yellow-400 font-medium">{'⏳'} {countdownText}</span>}
                        </div>

                        {t.winner_id && (
                          <div className="mt-3 p-2 rounded-lg bg-yellow-500/10 text-sm text-yellow-400">
                            {'🥇'} Турнир завершён!
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {canJoin && (
                          <motion.button onClick={() => handleJoin(t.id)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-black"
                            style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}
                            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            Участвовать
                          </motion.button>
                        )}
                        {canLeave && (
                          <motion.button onClick={() => handleLeave(t.id)}
                            className="px-4 py-2 rounded-xl text-sm border border-red-400/30 text-red-400"
                            whileHover={{ scale: 1.05 }}>
                            Покинуть
                          </motion.button>
                        )}
                        {joined && <span className="text-xs text-green-400 text-center">{'✅'} Вы участвуете</span>}
                        <motion.button onClick={() => router.push(`/tournaments/${t.id}`)}
                          className="px-4 py-2 rounded-xl text-sm border border-white/15 text-white/50"
                          whileHover={{ scale: 1.05 }}>
                          Подробнее
                        </motion.button>
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
