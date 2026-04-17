'use client';

import { useState, useEffect, use } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { getTournament, getTournamentParticipants, getTournamentMatches, joinTournament, sortStandings } from '@/lib/tournaments';
import { useTranslation } from '@/lib/i18n';

export default function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { t } = useTranslation();
  const [tournament, setTournament] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [countdown, setCountdown] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
      if (user) setUserId(user.id);

      const t = await getTournament(id);
      setTournament(t);

      const p = await getTournamentParticipants(id);
      setParticipants(p);
      if (user && p.some((x: any) => x.user_id === user.id)) setJoined(true);

      const m = await getTournamentMatches(id);
      setMatches(m);
    };
    load();

    // Realtime
    const channel = supabase.channel(`tournament-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, () => {
        getTournamentMatches(id).then(setMatches);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_participants', filter: `tournament_id=eq.${id}` }, () => {
        getTournamentParticipants(id).then(setParticipants);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Countdown timer
  useEffect(() => {
    if (!tournament?.start_time || tournament.status !== 'upcoming') { setCountdown(''); return; }
    const tick = () => {
      const diff = new Date(tournament.start_time).getTime() - Date.now();
      if (diff <= 0) { setCountdown('Начинается!'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(d > 0 ? `${d}д ${h}ч ${m}м` : h > 0 ? `${h}ч ${m}м ${s}с` : `${m}м ${s}с`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [tournament?.start_time, tournament?.status]);

  const handleJoin = async () => {
    try {
      // 1. Получаем сессию
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        alert('Ошибка: нет сессии. Обновите страницу.');
        return;
      }
      const uid = session.user.id;
      console.log('Join tournament: user =', uid, 'tournament =', id);

      // 2. Проверяем не участвует ли уже
      const { data: existing } = await supabase
        .from('tournament_participants')
        .select('id')
        .eq('tournament_id', id)
        .eq('user_id', uid);

      if (existing && existing.length > 0) {
        console.log('Already joined');
        setJoined(true);
        const p = await getTournamentParticipants(id);
        setParticipants(p);
        return;
      }

      // 3. Получаем рейтинг
      const { data: profile } = await supabase
        .from('profiles')
        .select('elo_rating')
        .eq('id', uid)
        .single();

      // 4. ПРЯМОЙ INSERT
      const { data: inserted, error: insertError } = await supabase
        .from('tournament_participants')
        .insert({
          tournament_id: id,
          user_id: uid,
          tournament_rating: profile?.elo_rating || 1200,
        })
        .select()
        .single();

      console.log('Insert result:', inserted, 'Error:', insertError);

      if (insertError) {
        alert('Ошибка вставки: ' + insertError.message + ' (code: ' + insertError.code + ')');
        return;
      }

      if (inserted) {
        setJoined(true);
        const p = await getTournamentParticipants(id);
        setParticipants(p);
        console.log('Joined! Participants:', p.length);
      } else {
        alert('INSERT вернул null. Проверьте права доступа в Supabase.');
      }
    } catch (e: any) {
      console.error('Join error:', e);
      alert('Ошибка: ' + (e?.message || JSON.stringify(e)));
    }
  };

  if (!tournament) return <div className="min-h-screen"><Header /><div className="flex items-center justify-center min-h-screen"><div className="text-white/40">{t('loading')}</div></div></div>;

  const rounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b);
  const getName = (uid: string | null) => {
    if (!uid) return 'BYE';
    return participants.find(p => p.user_id === uid)?.profiles?.username || '?';
  };

  const statusColors: Record<string, string> = { upcoming: '#fbbf24', active: '#4ade80', finished: '#94a3b8' };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.button onClick={() => router.push('/tournaments')} className="text-white/40 text-sm mb-4 hover:text-white/80" whileHover={{ x: -3 }}>
            {'<-'} Турниры
          </motion.button>

          {/* Tournament Header */}
          <motion.div className="glass p-6 rounded-2xl mb-6" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl">{'🏆'}</span>
              <div>
                <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{tournament.name}</h1>
                <p className="text-sm text-white/40">{tournament.description}</p>
              </div>
              <span className="ml-auto text-xs px-3 py-1 rounded-full" style={{ background: `${statusColors[tournament.status]}20`, color: statusColors[tournament.status] }}>
                {tournament.status === 'upcoming' ? 'Ожидание' : tournament.status === 'active' ? 'Идёт' : 'Завершён'}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-sm">
              <div className="p-2 rounded-xl bg-white/5"><div className="text-white/30 text-xs">{t('format_label')}</div><div className="font-semibold">{tournament.format === 'knockout' ? 'Плей-офф' : 'Швейцарская'}</div></div>
              <div className="p-2 rounded-xl bg-white/5"><div className="text-white/30 text-xs">{t('control_label')}</div><div className="font-semibold">{tournament.time_control}</div></div>
              <div className="p-2 rounded-xl bg-white/5"><div className="text-white/30 text-xs">{t('participants_label')}</div><div className="font-semibold text-yellow-400">{participants.length}/{tournament.max_participants}</div></div>
              <div className="p-2 rounded-xl bg-white/5"><div className="text-white/30 text-xs">{t('round_label')}</div><div className="font-semibold">{tournament.current_round}/{tournament.total_rounds}</div></div>
              <div className="p-2 rounded-xl bg-white/5"><div className="text-white/30 text-xs">{t('duration_label')}</div><div className="font-semibold">{tournament.duration_hours}ч</div></div>
            </div>

            {tournament.status === 'upcoming' && !joined && userId && (
              <motion.button onClick={handleJoin} className="mt-4 w-full py-3 rounded-xl font-semibold text-black"
                style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }} whileHover={{ scale: 1.02 }}>
                Участвовать!
              </motion.button>
            )}
            {joined && <div className="mt-4 text-center text-sm text-green-400">{'✅'} Вы участвуете в турнире</div>}

            {/* Countdown Timer */}
            {countdown && tournament.status === 'upcoming' && (
              <motion.div className="mt-4 p-4 rounded-xl text-center" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                <div className="text-xs text-white/40 uppercase tracking-wider mb-1">{t('before_start')}</div>
                <div className="text-2xl font-bold text-yellow-400" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {countdown === 'Начинается!' ? (
                    <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: Infinity }}>{countdown}</motion.span>
                  ) : countdown}
                </div>
                {tournament.start_time && (
                  <div className="text-xs text-white/30 mt-1">
                    {new Date(tournament.start_time).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })} в {new Date(tournament.start_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </motion.div>
            )}

            {/* Winners */}
            {tournament.status === 'finished' && tournament.winner_id && (
              <div className="mt-4 p-4 rounded-xl bg-yellow-500/10 text-center">
                <div className="text-2xl mb-2">{'🥇🥈🥉'}</div>
                <div className="text-yellow-400 font-bold">{'🥇'} {getName(tournament.winner_id)}</div>
                {tournament.second_id && <div className="text-white/60">{'🥈'} {getName(tournament.second_id)}</div>}
                {tournament.third_id && <div className="text-white/40">{'🥉'} {getName(tournament.third_id)}</div>}
              </div>
            )}
          </motion.div>

          {/* Bracket */}
          {matches.length > 0 && (
            <div className="glass p-4 rounded-2xl mb-6">
              <h3 className="text-sm font-bold text-white/40 uppercase tracking-wider mb-4">{t('tournament_bracket')}</h3>
              <div className="flex gap-6 overflow-x-auto pb-4">
                {rounds.map(roundNum => {
                  const roundMatches = matches.filter(m => m.round_number === roundNum);
                  const roundName = roundNum === tournament.total_rounds ? 'Финал'
                    : roundNum === tournament.total_rounds - 1 ? 'Полуфинал'
                    : `Раунд ${roundNum}`;
                  return (
                    <div key={roundNum} className="flex-shrink-0 min-w-[200px]">
                      <div className="text-xs text-yellow-400/60 uppercase tracking-wider mb-3 text-center">{roundName}</div>
                      <div className="space-y-3">
                        {roundMatches.map(m => {
                          const isMyMatch = userId && (m.white_id === userId || m.black_id === userId);
                          const canPlay = isMyMatch && (m.status === 'pending' || m.status === 'active') && m.black_id && tournament.status === 'active';
                          const myColor = m.white_id === userId ? 'white' : 'black';
                          return (
                            <div key={m.id} className={`rounded-xl overflow-hidden ${isMyMatch ? 'ring-1 ring-yellow-400/30' : ''}`}>
                              <div className={`flex items-center gap-2 px-3 py-2 text-sm ${m.winner_id === m.white_id ? 'bg-green-500/10' : 'bg-white/5'}`}>
                                <div className="w-3 h-3 rounded-full bg-white border border-white/20" />
                                <span className="flex-1 truncate">{getName(m.white_id)}</span>
                                <span className="text-xs text-white/30">{m.result === 'white' ? '1' : m.result === 'black' ? '0' : m.result === 'draw' ? '0.5' : ''}</span>
                              </div>
                              <div className="h-px bg-white/10" />
                              <div className={`flex items-center gap-2 px-3 py-2 text-sm ${m.winner_id === m.black_id ? 'bg-green-500/10' : 'bg-white/5'}`}>
                                <div className="w-3 h-3 rounded-full bg-gray-800 border border-white/20" />
                                <span className="flex-1 truncate">{m.black_id ? getName(m.black_id) : 'BYE'}</span>
                                <span className="text-xs text-white/30">{m.result === 'black' ? '1' : m.result === 'white' ? '0' : m.result === 'draw' ? '0.5' : ''}</span>
                              </div>
                              {canPlay && (
                                <motion.button onClick={() => router.push(`/tournaments/${id}/play/${m.id}`)}
                                  className="w-full py-2 text-xs font-bold text-black"
                                  style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}
                                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                                  animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                                  {'⚔️'} Играть!
                                </motion.button>
                              )}
                              {isMyMatch && m.status === 'active' && (
                                <motion.button onClick={() => router.push(`/tournaments/${id}/play/${m.id}`)}
                                  className="w-full py-2 text-xs font-bold text-black"
                                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                                  whileHover={{ scale: 1.02 }}>
                                  {'🔴'} Вернуться к партии
                                </motion.button>
                              )}
                              {isMyMatch && m.status === 'pending' && !m.black_id && (
                                <div className="w-full py-1.5 text-xs text-center text-white/30 bg-white/5">BYE — автопобеда</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Standings Table */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-bold text-white/60 uppercase tracking-wider">{t('tournament_table')} ({participants.length})</span>
              {participants.length > 0 && (
                <span className="text-xs text-white/20">W — победы | L — поражения | D — ничьи</span>
              )}
            </div>
            {participants.length === 0 ? (
              <div className="p-8 text-center text-white/30">{t('no_participants')}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/30 text-xs border-b border-white/10">
                      <th className="px-4 py-2 w-8">#</th>
                      <th className="px-4 py-2">{t('player_label')}</th>
                      <th className="px-4 py-2 text-center">{t('points_col')}</th>
                      <th className="px-4 py-2 text-center">W</th>
                      <th className="px-4 py-2 text-center">L</th>
                      <th className="px-4 py-2 text-center">D</th>
                      <th className="px-4 py-2 text-center">ELO</th>
                      <th className="px-4 py-2 text-center">{t('status_col')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...participants].sort((a, b) => (b.points || 0) - (a.points || 0) || (b.wins || 0) - (a.wins || 0)).map((p, i) => {
                      const medals = ['🥇', '🥈', '🥉'];
                      const isMe = p.user_id === userId;
                      const points = (p.wins || 0) + (p.draws || 0) * 0.5;
                      return (
                        <tr key={p.id} className={`border-b border-white/5 ${isMe ? 'bg-yellow-400/10' : 'hover:bg-white/5'} transition-colors`}>
                          <td className="px-4 py-3 font-bold" style={{ color: i < 3 ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}>
                            {i < 3 && tournament.status !== 'upcoming' ? medals[i] : i + 1}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${isMe ? 'text-yellow-400' : 'text-white/70'}`}>
                              {p.profiles?.username || '?'} {isMe && '(вы)'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-yellow-400" style={{ fontFamily: "'Playfair Display', serif" }}>
                              {points % 1 === 0 ? points : points.toFixed(1)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-green-400">{p.wins || 0}</td>
                          <td className="px-4 py-3 text-center text-red-400">{p.losses || 0}</td>
                          <td className="px-4 py-3 text-center text-white/40">{p.draws || 0}</td>
                          <td className="px-4 py-3 text-center text-white/30">{p.profiles?.elo_rating || 0}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              p.status === 'active' ? 'bg-green-500/10 text-green-400' :
                              p.status === 'eliminated' ? 'bg-red-500/10 text-red-400' :
                              p.status === 'winner' ? 'bg-yellow-500/10 text-yellow-400' :
                              'bg-white/5 text-white/30'
                            }`}>
                              {p.status === 'active' ? 'Играет' : p.status === 'eliminated' ? 'Выбыл' : p.status === 'winner' ? 'Победитель' : 'Зарег.'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
