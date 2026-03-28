'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { createTournament, getTournaments, generateKnockoutBracket, generateSwissRound, advanceToNextRound, getTournamentParticipants, getTournamentMatches, isAdmin, reportMatchResult, recalculateTiebreakers, sortStandings, type Tournament } from '@/lib/tournaments';
import { getActiveLiveGames } from '@/lib/lichess-auth';

type Tab = 'dashboard' | 'tournaments' | 'users' | 'create' | 'live' | 'coins';

export default function AdminPage() {
  const router = useRouter();
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [users, setUsers] = useState<{id:string;username:string;elo_rating:number;puzzle_rating:number;is_admin:boolean;games_played:number;coins:number}[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [liveGames, setLiveGames] = useState<any[]>([]);
  const [coinSettings, setCoinSettings] = useState<{mode:string;win_coins:number;loss_coins:number;draw_coins:number}[]>([]);

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', format: 'knockout', time_control: '10+0',
    max_participants: 16, duration_hours: 24,
    start_time: new Date(Date.now() + 86400000).toISOString().slice(0, 16),
  });

  useEffect(() => {
    const check = async () => {
      const ok = await isAdmin();
      setAdmin(ok);
      setLoading(false);
      if (ok) {
        const t = await getTournaments();
        setTournaments(t as Tournament[]);
        const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, games_played, coins').order('elo_rating', { ascending: false });
        setUsers(data || []);
        const lg = await getActiveLiveGames();
        setLiveGames(lg);
        const { data: cs } = await supabase.from('coin_settings').select('mode, win_coins, loss_coins, draw_coins').order('mode');
        setCoinSettings(cs || []);
      }
    };
    check();
  }, []);

  const loadTournamentDetails = async (id: string) => {
    setSelectedTournament(id);
    const p = await getTournamentParticipants(id);
    setParticipants(p);
    const m = await getTournamentMatches(id);
    setMatches(m);
  };

  const handleCreate = async () => {
    try {
      setMsg('Создаём турнир...');
      const tournament = await createTournament(form);
      if (tournament) {
        setMsg('Турнир создан!');
        setTab('tournaments');
        const t = await getTournaments();
        setTournaments(t as Tournament[]);
      } else {
        setMsg('Ошибка: турнир не создан');
      }
    } catch (e: any) {
      console.error('Create tournament error:', e);
      setMsg('Ошибка: ' + (e?.message || 'Не удалось создать турнир. Проверьте что вы админ.'));
    }
  };

  const handleStartTournament = async (id: string) => {
    try {
      const t = tournaments.find(x => x.id === id);
      if (t?.format === 'swiss' || t?.format === 'round_robin' || t?.format === 'arena') {
        await generateSwissRound(id);
        setMsg('Первый раунд создан!');
      } else {
        await generateKnockoutBracket(id);
        setMsg('Жеребёвка проведена!');
      }
      loadTournamentDetails(id);
      const tr = await getTournaments();
      setTournaments(tr as Tournament[]);
    } catch (e: any) { setMsg('Ошибка: ' + e.message); }
  };

  const handleNextRound = async (id: string) => {
    try {
      const t = tournaments.find(x => x.id === id);
      let result;
      if (t?.format === 'swiss' || t?.format === 'round_robin' || t?.format === 'arena') {
        result = await generateSwissRound(id);
        setMsg(`Раунд ${result?.round?.round_number || '?'} создан!`);
      } else {
        result = await advanceToNextRound(id);
        setMsg(result?.finished ? 'Турнир завершён!' : `Раунд ${result?.nextRound} создан!`);
      }
      loadTournamentDetails(id);
      const tr = await getTournaments();
      setTournaments(tr as Tournament[]);
    } catch (e: any) { setMsg('Ошибка: ' + e.message); }
  };

  const handleMatchResult = async (matchId: string, result: 'white' | 'black' | 'draw') => {
    try {
      await reportMatchResult(matchId, result);
      if (selectedTournament) loadTournamentDetails(selectedTournament);
      setMsg('Результат сохранён');
    } catch (e: any) { setMsg('Ошибка: ' + e.message); }
  };

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    await supabase.from('profiles').update({ is_admin: !isAdmin }).eq('id', userId);
    const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, games_played, coins').order('elo_rating', { ascending: false });
    setUsers(data || []);
  };

  if (loading) return <div className="min-h-screen"><Header /><div className="flex items-center justify-center min-h-screen"><div className="text-white/40">Загрузка...</div></div></div>;

  if (!admin) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-screen pt-24">
          <div className="glass p-10 rounded-2xl text-center max-w-md">
            <div className="text-5xl mb-4">{'🔒'}</div>
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Панель администратора</h2>
            <p className="text-white/40 text-sm mb-6">У вас нет доступа. Обратитесь к администратору.</p>
            <motion.button onClick={() => router.push('/')} className="px-6 py-3 rounded-xl border border-white/15 text-white/60" whileHover={{ scale: 1.03 }}>На главную</motion.button>
          </div>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = { upcoming: '#fbbf24', active: '#4ade80', paused: '#fb923c', finished: '#94a3b8' };
  const statusLabels: Record<string, string> = { upcoming: 'Ожидание', active: 'Активен', paused: 'Пауза', finished: 'Завершён' };

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{'🛡️'}</span>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Админ-панель</h1>
          </div>

          {msg && (
            <motion.div className="glass p-3 rounded-xl mb-4 text-sm text-yellow-400" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {msg}
              <button onClick={() => setMsg('')} className="ml-3 text-white/30">x</button>
            </motion.div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {([['dashboard', 'Дашборд', '📊'], ['live', 'Live игры', '🔴'], ['tournaments', 'Турниры', '🏆'], ['create', 'Создать турнир', '➕'], ['users', 'Пользователи', '👥'], ['coins', 'Коины', '🪙']] as [Tab, string, string][]).map(([id, label, icon]) => (
              <button key={id} onClick={() => { setTab(id); setSelectedTournament(null); }}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab === id ? 'bg-yellow-500/20 text-yellow-400' : 'text-white/40 hover:text-white/60 glass'}`}>
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Dashboard */}
          {tab === 'dashboard' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="glass p-5 rounded-xl text-center">
                <div className="text-3xl font-bold text-yellow-400" style={{ fontFamily: "'Playfair Display', serif" }}>{users.length}</div>
                <div className="text-xs text-white/40 mt-1">Пользователей</div>
              </div>
              <div className="glass p-5 rounded-xl text-center">
                <div className="text-3xl font-bold text-green-400" style={{ fontFamily: "'Playfair Display', serif" }}>{tournaments.length}</div>
                <div className="text-xs text-white/40 mt-1">Турниров</div>
              </div>
              <div className="glass p-5 rounded-xl text-center">
                <div className="text-3xl font-bold text-purple-400" style={{ fontFamily: "'Playfair Display', serif" }}>{tournaments.filter(t => t.status === 'active').length}</div>
                <div className="text-xs text-white/40 mt-1">Активных</div>
              </div>
              <div className="glass p-5 rounded-xl text-center">
                <div className="text-3xl font-bold text-blue-400" style={{ fontFamily: "'Playfair Display', serif" }}>{users.reduce((s, u) => s + u.games_played, 0)}</div>
                <div className="text-xs text-white/40 mt-1">Партий сыграно</div>
              </div>
            </div>
          )}

          {/* Live Games */}
          {tab === 'live' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white/60">Активные партии</h3>
                <motion.button onClick={async () => { const lg = await getActiveLiveGames(); setLiveGames(lg); }}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:text-white/80" whileHover={{ scale: 1.03 }}>
                  Обновить
                </motion.button>
              </div>
              {liveGames.length === 0 ? (
                <div className="glass p-10 rounded-2xl text-center">
                  <div className="text-4xl mb-3">{'🎮'}</div>
                  <p className="text-white/40">Нет активных партий</p>
                  <p className="text-white/20 text-xs mt-1">Когда кто-то начнёт играть — партия появится здесь</p>
                </div>
              ) : (
                liveGames.map(g => (
                  <motion.div key={g.id} className="glass p-4 rounded-xl flex items-center gap-4"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs text-green-400">LIVE</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">
                        {g.white_name || '?'} <span className="text-white/30">vs</span> {g.black_name || '?'}
                      </div>
                      <div className="text-xs text-white/30">
                        {g.mode} | {(g.moves_json || []).length} ходов
                        {g.tournament_id && ' | Турнир'}
                      </div>
                    </div>
                    <motion.button onClick={() => router.push(`/admin/watch/${g.id}`)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold text-black"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                      whileHover={{ scale: 1.05 }}>
                      Смотреть
                    </motion.button>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* Create Tournament */}
          {tab === 'create' && (
            <div className="glass p-6 rounded-2xl max-w-xl">
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Новый турнир</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/40 block mb-1">Название турнира</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm" placeholder="Кубок Ход Конём" />
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">Описание</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm" rows={2} placeholder="Описание турнира..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/40 block mb-1">Формат</label>
                    <select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                      <option value="knockout">Нокаут (плей-офф)</option>
                      <option value="swiss">Швейцарская система</option>
                      <option value="round_robin">Круговой (все vs все)</option>
                      <option value="arena">Арена (непрерывные партии)</option>
                      <option value="double_elimination">Двойное выбывание</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1">Контроль времени</label>
                    <select value={form.time_control} onChange={e => setForm({ ...form, time_control: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                      <option value="1|0">Пуля: 1 мин</option>
                      <option value="1|1">Пуля: 1+1</option>
                      <option value="2|1">Пуля: 2+1</option>
                      <option value="3|0">Блиц: 3 мин</option>
                      <option value="3|2">Блиц: 3+2</option>
                      <option value="5|0">Блиц: 5 мин</option>
                      <option value="5|5">Блиц: 5+5</option>
                      <option value="10|0">Рапид: 10 мин</option>
                      <option value="15|10">Рапид: 15+10</option>
                      <option value="30|0">Рапид: 30 мин</option>
                      <option value="60|0">Классика: 60 мин</option>
                      <option value="90|30">Классика: 90+30</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/40 block mb-1">Макс. участников</label>
                    <select value={form.max_participants} onChange={e => setForm({ ...form, max_participants: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                      {[4, 8, 16, 32, 64].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1">Длительность</label>
                    <select value={form.duration_hours} onChange={e => setForm({ ...form, duration_hours: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                      <option value={1}>1 час</option>
                      <option value={3}>3 часа</option>
                      <option value={6}>6 часов</option>
                      <option value={12}>12 часов</option>
                      <option value={24}>1 день</option>
                      <option value={72}>3 дня</option>
                      <option value={168}>1 неделя</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">Дата и время начала</label>
                  <input type="datetime-local" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm" />
                </div>
                <motion.button onClick={handleCreate} disabled={!form.name}
                  className="w-full py-3 rounded-xl font-semibold text-black disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  Создать турнир
                </motion.button>
              </div>
            </div>
          )}

          {/* Tournaments List */}
          {tab === 'tournaments' && !selectedTournament && (
            <div className="space-y-3">
              {tournaments.map(t => (
                <motion.button key={t.id} onClick={() => loadTournamentDetails(t.id)}
                  className="w-full glass p-4 rounded-xl text-left flex items-center gap-4 hover:border-yellow-400/30 transition-all"
                  whileHover={{ scale: 1.01 }}>
                  <span className="text-2xl">{'🏆'}</span>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white">{t.name}</h3>
                    <p className="text-xs text-white/40">Раунд {t.current_round}/{t.total_rounds} | {t.time_control} | {
                      t.format === 'knockout' ? 'Плей-офф' :
                      t.format === 'round_robin' ? 'Круговой' :
                      t.format === 'arena' ? 'Арена' :
                      t.format === 'double_elimination' ? 'Двойное выбывание' :
                      'Швейцарская'
                    }</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${statusColors[t.status]}20`, color: statusColors[t.status] }}>
                    {statusLabels[t.status]}
                  </span>
                </motion.button>
              ))}
              {tournaments.length === 0 && <p className="text-white/30 text-center py-10">Нет турниров</p>}
            </div>
          )}

          {/* Tournament Detail */}
          {tab === 'tournaments' && selectedTournament && (
            <div>
              <button onClick={() => setSelectedTournament(null)} className="text-white/40 text-sm mb-4 hover:text-white/80">{'<-'} Назад</button>
              {(() => {
                const t = tournaments.find(x => x.id === selectedTournament);
                if (!t) return null;
                return (
                  <div className="space-y-4">
                    <div className="glass p-5 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{t.name}</h3>
                        <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${statusColors[t.status]}20`, color: statusColors[t.status] }}>{statusLabels[t.status]}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center text-sm">
                        <div><div className="text-white/30">Участники</div><div className="font-bold text-yellow-400">{participants.length}/{t.max_participants}</div></div>
                        <div><div className="text-white/30">Раунд</div><div className="font-bold">{t.current_round}/{t.total_rounds}</div></div>
                        <div><div className="text-white/30">Контроль</div><div className="font-bold">{t.time_control}</div></div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        {t.status === 'upcoming' && participants.length >= 2 && (
                          <motion.button onClick={() => handleStartTournament(t.id)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-black" style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}
                            whileHover={{ scale: 1.03 }}>Начать жеребёвку</motion.button>
                        )}
                        {t.status === 'active' && (
                          <motion.button onClick={() => handleNextRound(t.id)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-black" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                            whileHover={{ scale: 1.03 }}>Следующий раунд</motion.button>
                        )}
                        <motion.button onClick={async () => {
                          if (!confirm('Удалить турнир ' + t.name + '?')) return;
                          try {
                            // Сначала очищаем ссылки в live_games и tournament_results
                            await supabase.from('live_games').update({ tournament_id: null, tournament_match_id: null }).eq('tournament_id', t.id);
                            await supabase.from('tournament_results').delete().eq('tournament_id', t.id);
                            // Потом удаляем турнир (participants, rounds, matches удалятся по CASCADE)
                            const { error } = await supabase.from('tournaments').delete().eq('id', t.id);
                            if (error) throw error;
                            const tr = await getTournaments();
                            setTournaments(tr as Tournament[]);
                            setSelectedTournament(null);
                            setMsg('Турнир удалён');
                          } catch (e: any) {
                            console.error('Delete tournament error:', e);
                            setMsg('Ошибка удаления: ' + (e?.message || 'Попробуйте ещё'));
                          }
                        }}
                          className="px-4 py-2 rounded-xl text-sm border border-red-400/30 text-red-400 hover:bg-red-500/10"
                          whileHover={{ scale: 1.03 }}>Удалить турнир</motion.button>
                      </div>
                    </div>

                    {/* Matches */}
                    <div className="glass rounded-xl overflow-hidden">
                      <div className="p-3 border-b border-white/10"><span className="text-xs text-white/40 uppercase tracking-wider">Матчи</span></div>
                      <div className="p-3 space-y-2">
                        {matches.map(m => (
                          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 text-sm">
                            <span className="text-xs text-white/30">R{m.round_number}</span>
                            <span className="flex-1 text-white/70">{participants.find(p => p.user_id === m.white_id)?.profiles?.username || 'BYE'}</span>
                            <span className="text-white/20">vs</span>
                            <span className="flex-1 text-right text-white/70">{m.black_id ? participants.find(p => p.user_id === m.black_id)?.profiles?.username || '?' : 'BYE'}</span>
                            {m.status === 'pending' && m.black_id && (
                              <div className="flex gap-1">
                                <button onClick={() => handleMatchResult(m.id, 'white')} className="px-2 py-1 rounded text-xs bg-white/10 hover:bg-green-500/20 text-white/60">1-0</button>
                                <button onClick={() => handleMatchResult(m.id, 'draw')} className="px-2 py-1 rounded text-xs bg-white/10 hover:bg-yellow-500/20 text-white/60">1/2</button>
                                <button onClick={() => handleMatchResult(m.id, 'black')} className="px-2 py-1 rounded text-xs bg-white/10 hover:bg-green-500/20 text-white/60">0-1</button>
                              </div>
                            )}
                            {m.status === 'finished' && (
                              <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-400">
                                {m.result === 'white' ? '1-0' : m.result === 'black' ? '0-1' : m.result === 'bye' ? 'BYE' : '1/2'}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Participants */}
                    <div className="glass rounded-xl overflow-hidden">
                      <div className="p-3 border-b border-white/10 flex items-center justify-between">
                        <span className="text-xs text-white/40 uppercase tracking-wider">Участники ({participants.length})</span>
                        <span className="text-xs text-white/20">Укажите рейтинг перед жеребёвкой</span>
                      </div>
                      <div className="p-2">
                        {participants.map((p, i) => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                            <span className="text-xs text-white/30 w-5">{i + 1}</span>
                            <span className="flex-1 text-white/70 truncate">{p.profiles?.username || '?'}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-white/30">ELO:</span>
                              <input type="number" value={p.tournament_rating || 0}
                                onChange={async (e) => {
                                  const val = parseInt(e.target.value) || 0;
                                  await supabase.from('tournament_participants').update({ tournament_rating: val }).eq('id', p.id);
                                  setParticipants(prev => prev.map(x => x.id === p.id ? { ...x, tournament_rating: val } : x));
                                }}
                                className="w-16 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-yellow-400 text-xs text-center font-bold"
                              />
                            </div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-green-500/10 text-green-400' : p.status === 'eliminated' ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/30'}`}>
                              {p.status === 'active' ? 'В игре' : p.status === 'eliminated' ? 'Выбыл' : p.status === 'winner' ? 'Победитель' : 'Зарег.'}
                            </span>
                            <button onClick={async () => {
                              if (!confirm(`Убрать ${p.profiles?.username || '?'} из турнира?`)) return;
                              await supabase.from('tournament_participants').delete().eq('id', p.id);
                              if (selectedTournament) loadTournamentDetails(selectedTournament);
                            }} className="text-xs text-red-400/50 hover:text-red-400 px-1">✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Coins Settings */}
          {tab === 'coins' && (
            <div className="glass p-6 rounded-2xl max-w-2xl">
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Настройки коинов по режимам</h3>
              <p className="text-xs text-white/30 mb-6">Сколько коинов получает/теряет игрок за партию в каждом режиме</p>
              <div className="space-y-4">
                {coinSettings.map(cs => {
                  const modeLabels: Record<string, string> = { kids: 'Детский', beginner: 'Начинающий', medium: 'Средний', hard: 'Сложный', expert: 'Эксперт', online: 'Онлайн' };
                  return (
                    <div key={cs.mode} className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-sm font-semibold text-yellow-400 mb-3">{modeLabels[cs.mode] || cs.mode}</div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-green-400 block mb-1">Победа +</label>
                          <input type="number" value={cs.win_coins}
                            onChange={e => setCoinSettings(prev => prev.map(p => p.mode === cs.mode ? { ...p, win_coins: parseInt(e.target.value) || 0 } : p))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center" />
                        </div>
                        <div>
                          <label className="text-xs text-red-400 block mb-1">Поражение</label>
                          <input type="number" value={cs.loss_coins}
                            onChange={e => setCoinSettings(prev => prev.map(p => p.mode === cs.mode ? { ...p, loss_coins: parseInt(e.target.value) || 0 } : p))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center" />
                        </div>
                        <div>
                          <label className="text-xs text-white/40 block mb-1">Ничья</label>
                          <input type="number" value={cs.draw_coins}
                            onChange={e => setCoinSettings(prev => prev.map(p => p.mode === cs.mode ? { ...p, draw_coins: parseInt(e.target.value) || 0 } : p))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <motion.button onClick={async () => {
                for (const cs of coinSettings) {
                  await supabase.from('coin_settings').update({ win_coins: cs.win_coins, loss_coins: cs.loss_coins, draw_coins: cs.draw_coins, updated_at: new Date().toISOString() }).eq('mode', cs.mode);
                }
                setMsg('Настройки коинов сохранены!');
              }}
                className="w-full mt-6 py-3 rounded-xl font-semibold text-black"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                Сохранить настройки
              </motion.button>
            </div>
          )}

          {/* Users */}
          {tab === 'users' && (
            <div className="glass rounded-xl overflow-hidden">
              <div className="p-3 border-b border-white/10"><span className="text-xs text-white/40 uppercase tracking-wider">Пользователи ({users.length})</span></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-white/30 text-xs">
                    <th className="px-4 py-2">#</th><th className="px-4 py-2">Имя</th><th className="px-4 py-2">ELO</th>
                    <th className="px-4 py-2">Puzzle ELO</th><th className="px-4 py-2">Коины</th><th className="px-4 py-2">Партий</th><th className="px-4 py-2">Админ</th><th className="px-4 py-2">Действия</th>
                  </tr></thead>
                  <tbody>
                    {users.map((u, i) => (
                      <tr key={u.id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="px-4 py-2 text-white/30">{i + 1}</td>
                        <td className="px-4 py-2 text-white/70">{u.username}</td>
                        <td className="px-4 py-2 text-yellow-400">{u.elo_rating}</td>
                        <td className="px-4 py-2 text-purple-400">{u.puzzle_rating || 1200}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <button onClick={async () => { await supabase.from('profiles').update({ coins: Math.max(0, (u.coins||0) - 10) }).eq('id', u.id); const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, games_played, coins').order('elo_rating', { ascending: false }); setUsers(data || []); }}
                              className="px-1.5 py-0.5 rounded text-xs bg-red-500/10 text-red-400">-</button>
                            <span className="text-yellow-400 font-semibold min-w-[30px] text-center">{u.coins || 0}</span>
                            <button onClick={async () => { await supabase.from('profiles').update({ coins: (u.coins||0) + 10 }).eq('id', u.id); const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, games_played, coins').order('elo_rating', { ascending: false }); setUsers(data || []); }}
                              className="px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-400">+</button>
                          </div>
                        </td>
                        <td className="px-4 py-2 text-white/40">{u.games_played}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => toggleAdmin(u.id, u.is_admin)}
                            className={`px-2 py-1 rounded text-xs ${u.is_admin ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-white/30'}`}>
                            {u.is_admin ? 'Админ' : 'Юзер'}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          <button onClick={async () => { if (confirm(`Удалить ${u.username}?`)) { await supabase.from('profiles').delete().eq('id', u.id); const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, games_played, coins').order('elo_rating', { ascending: false }); setUsers(data || []); setMsg('Пользователь удалён'); } }}
                            className="px-2 py-1 rounded text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20">
                            Удалить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
