'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { createTournament, getTournaments, generateKnockoutBracket, generateSwissRound, advanceToNextRound, getTournamentParticipants, getTournamentMatches, isAdmin, reportMatchResult, recalculateTiebreakers, sortStandings, type Tournament } from '@/lib/tournaments';
import { getActiveLiveGames } from '@/lib/lichess-auth';

type Tab = 'dashboard' | 'tournaments' | 'users' | 'create' | 'live' | 'coins' | 'rating' | 'trainers' | 'shop' | 'analytics' | 'orders';

export default function AdminPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [users, setUsers] = useState<{id:string;username:string;elo_rating:number;puzzle_rating:number;is_admin:boolean;is_trainer:boolean;games_played:number;coins:number}[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const [liveGames, setLiveGames] = useState<any[]>([]);
  const [coinSettings, setCoinSettings] = useState<{mode:string;win_coins:number;loss_coins:number;draw_coins:number}[]>([]);
  // Rating states
  const [schoolTrainers, setSchoolTrainers] = useState<any[]>([]);
  const [schoolStudents, setSchoolStudents] = useState<any[]>([]);
  const [newTrainerName, setNewTrainerName] = useState('');
  // Shop
  const [shopProducts, setShopProducts] = useState<any[]>([]);
  const [productForm, setProductForm] = useState({ name: '', description: '', price: '100' });
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  // Analytics
  const [analyticsRange, setAnalyticsRange] = useState<'week' | 'month' | 'custom'>('week');
  const [analyticsMonth, setAnalyticsMonth] = useState(new Date().toISOString().slice(0, 7));
  const [coinTransactions, setCoinTransactions] = useState<any[]>([]);
  const [analyticsTrainer, setAnalyticsTrainer] = useState('');
  // Orders
  const [shopOrders, setShopOrders] = useState<any[]>([]);
  const [studentForm, setStudentForm] = useState({ full_name: '', birth_year: '', rating: '0', trainer_id: '', achievements: '', profile_id: '' });
  const [studentSearch, setStudentSearch] = useState('');

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
        const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, is_trainer, games_played, coins').order('username', { ascending: true });
        setUsers(data || []);
        const lg = await getActiveLiveGames();
        setLiveGames(lg);
        const { data: cs } = await supabase.from('coin_settings').select('mode, win_coins, loss_coins, draw_coins').order('mode');
        setCoinSettings(cs || []);
        // Внутренний рейтинг
        const { data: tr } = await supabase.from('school_trainers').select('*').order('name');
        setSchoolTrainers(tr || []);
        const { data: st } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
        setSchoolStudents(st || []);
        // Магазин
        const { data: sp } = await supabase.from('shop_products').select('*').order('created_at', { ascending: false });
        setShopProducts(sp || []);
        // Аналитика коинов
        const { data: ct } = await supabase.from('coin_transactions').select('*').order('created_at', { ascending: false }).limit(5000);
        setCoinTransactions(ct || []);
        // Заказы
        const { data: orders } = await supabase.from('shop_orders').select('*').order('created_at', { ascending: false });
        setShopOrders(orders || []);
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
    const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, is_trainer, games_played, coins').order('username', { ascending: true });
    setUsers(data || []);
  };

  if (loading) return <div className="min-h-screen"><Header /><div className="flex items-center justify-center min-h-screen"><div className="text-white/40">{t('loading')}</div></div></div>;

  if (!admin) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-screen pt-24">
          <div className="glass p-10 rounded-2xl text-center max-w-md">
            <div className="text-5xl mb-4">{'🔒'}</div>
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{t('admin_title')}</h2>
            <p className="text-white/40 text-sm mb-6">{t('admin_no_access_full')}</p>
            <motion.button onClick={() => router.push('/')} className="px-6 py-3 rounded-xl border border-white/15 text-white/60" whileHover={{ scale: 1.03 }}>{t('invite_go_main')}</motion.button>
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
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{t('admin_panel')}</h1>
          </div>

          {msg && (
            <motion.div className="glass p-3 rounded-xl mb-4 text-sm text-yellow-400" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              {msg}
              <button onClick={() => setMsg('')} className="ml-3 text-white/30">x</button>
            </motion.div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {([['dashboard', t('admin_dashboard'), '📊'], ['live', t('admin_live'), '🔴'], ['tournaments', t('admin_tournaments'), '🏆'], ['create', t('admin_create_tournament'), '➕'], ['users', t('admin_users'), '👥'], ['coins', t('admin_coins'), '🪙'], ['rating', t('admin_rating'), '📈'], ['trainers', t('admin_trainers'), '👨‍🏫'], ['shop', t('admin_shop'), '🛍️'], ['orders', t('admin_orders'), '📩'], ['analytics', t('admin_analytics'), '📉']] as [Tab, string, string][]).map(([id, label, icon]) => (
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
                <div className="text-xs text-white/40 mt-1">{t('admin_users_count')}</div>
              </div>
              <div className="glass p-5 rounded-xl text-center">
                <div className="text-3xl font-bold text-green-400" style={{ fontFamily: "'Playfair Display', serif" }}>{tournaments.length}</div>
                <div className="text-xs text-white/40 mt-1">{t('admin_tournaments_count')}</div>
              </div>
              <div className="glass p-5 rounded-xl text-center">
                <div className="text-3xl font-bold text-purple-400" style={{ fontFamily: "'Playfair Display', serif" }}>{tournaments.filter(t => t.status === 'active').length}</div>
                <div className="text-xs text-white/40 mt-1">{t('admin_active_count')}</div>
              </div>
              <div className="glass p-5 rounded-xl text-center">
                <div className="text-3xl font-bold text-blue-400" style={{ fontFamily: "'Playfair Display', serif" }}>{users.reduce((s, u) => s + u.games_played, 0)}</div>
                <div className="text-xs text-white/40 mt-1">{t('admin_games_played')}</div>
              </div>
            </div>
          )}

          {/* Live Games */}
          {tab === 'live' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white/60">{t('admin_active_games')}</h3>
                <motion.button onClick={async () => { const lg = await getActiveLiveGames(); setLiveGames(lg); }}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white/5 text-white/40 hover:text-white/80" whileHover={{ scale: 1.03 }}>
                  Обновить
                </motion.button>
              </div>
              {liveGames.length === 0 ? (
                <div className="glass p-10 rounded-2xl text-center">
                  <div className="text-4xl mb-3">{'🎮'}</div>
                  <p className="text-white/40">{t('admin_no_active')}</p>
                  <p className="text-white/20 text-xs mt-1">{t('admin_game_will_appear')}</p>
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
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>{t('admin_new_tournament')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/40 block mb-1">{t('admin_tournament_name')}</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm" placeholder="Кубок Ход Конём" />
                </div>
                <div>
                  <label className="text-xs text-white/40 block mb-1">{t('admin_description')}</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm" rows={2} placeholder="Описание турнира..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/40 block mb-1">{t('admin_format')}</label>
                    <select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                      <option value="knockout">{t("playoff")}</option>
                      <option value="swiss">{t("swiss")}</option>
                      <option value="round_robin">{t("tournament_arena")}</option>
                      <option value="arena">{t("tournament_arena")}</option>
                      <option value="double_elimination">{t("playoff")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1">{t('admin_time_control')}</label>
                    <select value={form.time_control} onChange={e => setForm({ ...form, time_control: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                      <option value="1|0">Bullet: 1 min</option>
                      <option value="1|1">Bullet: 1+1</option>
                      <option value="2|1">Bullet: 2+1</option>
                      <option value="3|0">Blitz: 3 min</option>
                      <option value="3|2">Blitz: 3+2</option>
                      <option value="5|0">Blitz: 5 min</option>
                      <option value="5|5">Blitz: 5+5</option>
                      <option value="10|0">Rapid: 10 min</option>
                      <option value="15|10">Rapid: 15+10</option>
                      <option value="30|0">Rapid: 30 min</option>
                      <option value="60|0">Classic: 60 min</option>
                      <option value="90|30">Classic: 90+30</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/40 block mb-1">{t("admin_max_players")}</label>
                    <select value={form.max_participants} onChange={e => setForm({ ...form, max_participants: parseInt(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                      {[4, 8, 16, 32, 64].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1">{t("duration_label")}</label>
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
                  <label className="text-xs text-white/40 block mb-1">{t("admin_period")}</label>
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
              {tournaments.map(tour => (
                <motion.button key={tour.id} onClick={() => loadTournamentDetails(tour.id)}
                  className="w-full glass p-4 rounded-xl text-left flex items-center gap-4 hover:border-yellow-400/30 transition-all"
                  whileHover={{ scale: 1.01 }}>
                  <span className="text-2xl">{'🏆'}</span>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white">{tour.name}</h3>
                    <p className="text-xs text-white/40">Раунд {tour.current_round}/{tour.total_rounds} | {tour.time_control} | {
                      tour.format === 'knockout' ? 'Плей-офф' :
                      tour.format === 'round_robin' ? 'Круговой' :
                      tour.format === 'arena' ? 'Арена' :
                      tour.format === 'double_elimination' ? 'Двойное выбывание' :
                      'Швейцарская'
                    }</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${statusColors[tour.status]}20`, color: statusColors[tour.status] }}>
                    {statusLabels[tour.status]}
                  </span>
                </motion.button>
              ))}
              {tournaments.length === 0 && <p className="text-white/30 text-center py-10">{t('no_tournaments')}</p>}
            </div>
          )}

          {/* Tournament Detail */}
          {tab === 'tournaments' && selectedTournament && (
            <div>
              <button onClick={() => setSelectedTournament(null)} className="text-white/40 text-sm mb-4 hover:text-white/80">{'<-'} Назад</button>
              {(() => {
                const tour = tournaments.find(x => x.id === selectedTournament);
                if (!tour) return null;
                return (
                  <div className="space-y-4">
                    <div className="glass p-5 rounded-xl">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{tour.name}</h3>
                        <span className="text-xs px-2 py-1 rounded-full" style={{ background: `${statusColors[tour.status]}20`, color: statusColors[tour.status] }}>{statusLabels[tour.status]}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-center text-sm">
                        <div><div className="text-white/30">{t('participants_label')}</div><div className="font-bold text-yellow-400">{participants.length}/{tour.max_participants}</div></div>
                        <div><div className="text-white/30">{t('round_label')}</div><div className="font-bold">{tour.current_round}/{tour.total_rounds}</div></div>
                        <div><div className="text-white/30">{t('control_label')}</div><div className="font-bold">{tour.time_control}</div></div>
                      </div>
                      <div className="flex gap-2 mt-4">
                        {tour.status === 'upcoming' && participants.length >= 2 && (
                          <motion.button onClick={() => handleStartTournament(tour.id)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-black" style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}
                            whileHover={{ scale: 1.03 }}>{t('start_draw')}</motion.button>
                        )}
                        {tour.status === 'active' && (
                          <motion.button onClick={() => handleNextRound(tour.id)}
                            className="px-4 py-2 rounded-xl text-sm font-semibold text-black" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                            whileHover={{ scale: 1.03 }}>{t('next_round')}</motion.button>
                        )}
                        <motion.button onClick={async () => {
                          if (!confirm('Удалить турнир ' + tour.name + '?')) return;
                          try {
                            // Сначала очищаем ссылки в live_games и tournament_results
                            await supabase.from('live_games').update({ tournament_id: null, tournament_match_id: null }).eq('tournament_id', tour.id);
                            await supabase.from('tournament_results').delete().eq('tournament_id', tour.id);
                            // Потом удаляем турнир (participants, rounds, matches удалятся по CASCADE)
                            const { error } = await supabase.from('tournaments').delete().eq('id', tour.id);
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
                          whileHover={{ scale: 1.03 }}>{t('delete_tournament')}</motion.button>
                      </div>
                    </div>

                    {/* Matches */}
                    <div className="glass rounded-xl overflow-hidden">
                      <div className="p-3 border-b border-white/10"><span className="text-xs text-white/40 uppercase tracking-wider">{t('matches_label')}</span></div>
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
                        <span className="text-xs text-white/20">{t('set_rating')}</span>
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
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>{t('coin_settings')}</h3>
              <p className="text-xs text-white/30 mb-6">{t('coin_settings_desc')}</p>
              <div className="space-y-4">
                {coinSettings.map(cs => {
                  const modeLabels: Record<string, string> = { kids: 'Детский', beginner: 'Начинающий', medium: 'Средний', hard: 'Сложный', expert: 'Эксперт', online: 'Онлайн', friend: 'С другом', local: 'Вдвоём' };
                  return (
                    <div key={cs.mode} className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="text-sm font-semibold text-yellow-400 mb-3">{modeLabels[cs.mode] || cs.mode}</div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs text-green-400 block mb-1">{t('win_plus')}</label>
                          <input type="number" value={cs.win_coins}
                            onChange={e => setCoinSettings(prev => prev.map(p => p.mode === cs.mode ? { ...p, win_coins: parseInt(e.target.value) || 0 } : p))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center" />
                        </div>
                        <div>
                          <label className="text-xs text-red-400 block mb-1">{t('loss_minus')}</label>
                          <input type="number" value={cs.loss_coins}
                            onChange={e => setCoinSettings(prev => prev.map(p => p.mode === cs.mode ? { ...p, loss_coins: parseInt(e.target.value) || 0 } : p))}
                            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm text-center" />
                        </div>
                        <div>
                          <label className="text-xs text-white/40 block mb-1">{t('draw_coins')}</label>
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
              <div className="p-3 border-b border-white/10"><span className="text-xs text-white/40 uppercase tracking-wider">{t('admin_users')} ({users.length})</span></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-white/30 text-xs">
                    <th className="px-4 py-2">#</th><th className="px-4 py-2">{t('name_col')}</th><th className="px-4 py-2">ELO</th>
                    <th className="px-4 py-2">{t("admin_puzzle_elo")}</th><th className="px-4 py-2">{t("admin_coins")}</th><th className="px-4 py-2">{t("admin_games_col")}</th><th className="px-4 py-2">{t("sidebar_admin")}</th><th className="px-4 py-2">{t("admin_trainers")}</th><th className="px-4 py-2">{t('admin_actions')}</th>
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
                            <button onClick={async () => {
                              const newCoins = Math.max(0, (u.coins||0) - 10);
                              await supabase.from('profiles').update({ coins: newCoins }).eq('id', u.id);
                              await supabase.from('coin_transactions').insert({ user_id: u.id, amount: -10, source: 'admin', description: 'Админ снял коины' });
                              const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, is_trainer, games_played, coins').order('username', { ascending: true }); setUsers(data || []);
                            }}
                              className="px-1.5 py-0.5 rounded text-xs bg-red-500/10 text-red-400">-</button>
                            <span className="text-yellow-400 font-semibold min-w-[30px] text-center">{u.coins || 0}</span>
                            <button onClick={async () => {
                              const newCoins = (u.coins||0) + 10;
                              await supabase.from('profiles').update({ coins: newCoins }).eq('id', u.id);
                              await supabase.from('coin_transactions').insert({ user_id: u.id, amount: 10, source: 'admin', description: 'Админ начислил коины' });
                              const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, is_trainer, games_played, coins').order('username', { ascending: true }); setUsers(data || []);
                            }}
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
                          <button onClick={async () => {
                            const newVal = !u.is_trainer;
                            // 1. Обновляем профиль
                            const { error: profErr } = await supabase.from('profiles').update({ is_trainer: newVal }).eq('id', u.id);
                            if (profErr) { console.error('Profile update error:', profErr); setMsg('Ошибка: ' + profErr.message); return; }
                            
                            if (newVal) {
                              // 2. Создаём запись в school_trainers если нет
                              const { data: existing } = await supabase.from('school_trainers').select('id').eq('profile_id', u.id).maybeSingle();
                              if (!existing) {
                                const { error: insertErr } = await supabase.from('school_trainers').insert({ name: u.username, profile_id: u.id });
                                if (insertErr) { console.error('Trainer insert error:', insertErr); setMsg('Ошибка создания тренера: ' + insertErr.message); return; }
                              }
                            } else {
                              // 3. Удаляем из school_trainers
                              await supabase.from('school_trainers').delete().eq('profile_id', u.id);
                            }
                            // 4. Обновляем список
                            const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, is_trainer, games_played, coins').order('username', { ascending: true });
                            setUsers(data || []);
                            // 5. Обновляем список тренеров
                            const { data: tr } = await supabase.from('school_trainers').select('*').order('name');
                            setSchoolTrainers(tr || []);
                            setMsg(newVal ? `${u.username} теперь тренер!` : `${u.username} больше не тренер`);
                          }}
                            className={`px-2 py-1 rounded text-xs ${u.is_trainer ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/30'}`}>
                            {u.is_trainer ? 'Тренер ✓' : 'Назначить'}
                          </button>
                        </td>
                        <td className="px-4 py-2">
                          <button onClick={async () => { if (confirm(`Удалить ${u.username}?`)) { await supabase.from('profiles').delete().eq('id', u.id); const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, is_trainer, games_played, coins').order('username', { ascending: true }); setUsers(data || []); setMsg('Пользователь удалён'); } }}
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

          {/* Rating Tab */}
          {tab === 'rating' && (
            <div className="space-y-6">
              {/* Тренеры */}
              <div className="glass p-6 rounded-2xl">
                <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>{t('admin_trainers')}</h3>
                <div className="flex gap-2 mb-4">
                  <input value={newTrainerName} onChange={e => setNewTrainerName(e.target.value)} placeholder="Имя тренера"
                    className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30" />
                  <motion.button onClick={async () => {
                    if (!newTrainerName.trim()) return;
                    await supabase.from('school_trainers').insert({ name: newTrainerName.trim() });
                    setNewTrainerName('');
                    const { data } = await supabase.from('school_trainers').select('*').order('name');
                    setSchoolTrainers(data || []);
                    setMsg('Тренер добавлен!');
                  }} className="px-4 py-2 rounded-xl text-sm font-semibold text-black"
                    style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}
                    whileTap={{ scale: 0.95 }}>{t('admin_add')}</motion.button>
                </div>
                <div className="space-y-2">
                  {schoolTrainers.map(tr => {
                    const trStudents = schoolStudents.filter(s => s.trainer_id === tr.id);
                    return (
                      <div key={tr.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5">
                        <span className="text-lg">👨‍🏫</span>
                        <div className="flex-1">
                          <span className="text-sm font-medium text-white/80">{tr.name}</span>
                          <span className="text-xs text-white/30 ml-2">({trStudents.length} учеников)</span>
                        </div>
                        {trStudents.length > 0 && (
                          <div className="text-xs text-white/20">{trStudents.map(s => s.full_name).join(', ')}</div>
                        )}
                        <button onClick={async () => {
                          if (!confirm(`Удалить тренера ${tr.name}?`)) return;
                          await supabase.from('school_trainers').delete().eq('id', tr.id);
                          const { data } = await supabase.from('school_trainers').select('*').order('name');
                          setSchoolTrainers(data || []);
                        }} className="text-xs text-red-400/50 hover:text-red-400">✕</button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Добавить ученика */}
              <div className="glass p-6 rounded-2xl">
                <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>{t('add_student')}</h3>
                
                {/* Выбрать из зарегистрированных */}
                <div className="mb-3">
                  <div className="text-xs text-white/40 mb-1">{t('admin_select_user')}</div>
                  <select onChange={e => {
                    const userId = e.target.value;
                    if (!userId) return;
                    const user = users.find(u => u.id === userId);
                    if (user) {
                      setStudentForm({ ...studentForm, full_name: user.username, profile_id: userId });
                    }
                  }} className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                    <option value="">— Или введите ФИО вручную ниже —</option>
                    {users.filter(u => !schoolStudents.some(s => s.profile_id === u.id)).map(u => (
                      <option key={u.id} value={u.id}>{u.username} (ELO {u.elo_rating})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-3">
                  <input value={studentForm.full_name} onChange={e => setStudentForm({ ...studentForm, full_name: e.target.value })} placeholder="ФИО"
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30" />
                  <input value={studentForm.birth_year} onChange={e => setStudentForm({ ...studentForm, birth_year: e.target.value })} placeholder="Год рождения" type="number"
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30" />
                  <input value={studentForm.rating} onChange={e => setStudentForm({ ...studentForm, rating: e.target.value })} placeholder="Баллы" type="number"
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30" />
                </div>
                <input value={studentForm.achievements} onChange={e => setStudentForm({ ...studentForm, achievements: e.target.value })} placeholder="Достижения через запятую"
                  className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 mb-3" />
                <motion.button onClick={async () => {
                  if (!studentForm.full_name.trim()) return;
                  const rating = parseInt(studentForm.rating) || 0;
                  const profileId = studentForm.profile_id || null;
                  await supabase.from('school_students').insert({
                    full_name: studentForm.full_name.trim(),
                    birth_year: studentForm.birth_year ? parseInt(studentForm.birth_year) : null,
                    rating,
                    trainer_id: null,
                    profile_id: profileId,
                    achievements: studentForm.achievements ? studentForm.achievements.split(',').map(a => a.trim()).filter(Boolean) : [],
                    rating_history: [{ date: new Date().toLocaleDateString('ru-RU'), rating }],
                  });
                  // Тренера назначаем потом через кнопку на карточке ученика
                  setStudentForm({ full_name: '', birth_year: '', rating: '0', trainer_id: '', achievements: '', profile_id: '' });
                  const { data } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
                  setSchoolStudents(data || []);
                  setMsg('Ученик добавлен!');
                }} className="w-full py-2.5 rounded-xl text-sm font-semibold text-black"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  whileTap={{ scale: 0.97 }}>{t('admin_add_student')}</motion.button>
              </div>

              {/* Список учеников */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex flex-col gap-3">
                  <span className="text-xs text-white/40 uppercase tracking-wider">{t('admin_students_count')} ({schoolStudents.length})</span>
                  <input type="text" placeholder="🔍 Поиск по ФИО или ID..."
                    value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30" />

                  {/* Массовое назначение тренера */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                    <span className="text-[11px] text-yellow-400/70">👥 Назначить всем без тренера:</span>
                    <select
                      onChange={async (e) => {
                        const newTrainerId = e.target.value;
                        if (!newTrainerId) return;
                        const tr = schoolTrainers.find(t => t.id === newTrainerId);
                        const withoutTrainer = schoolStudents.filter(s => !s.trainer_id);
                        if (withoutTrainer.length === 0) {
                          alert('Все ученики уже привязаны к тренерам');
                          e.target.value = '';
                          return;
                        }
                        if (!confirm(`Назначить ${withoutTrainer.length} учеников без тренера к "${tr?.name}"?`)) {
                          e.target.value = '';
                          return;
                        }
                        const ids = withoutTrainer.map(s => s.id);
                        await supabase.from('school_students').update({ trainer_id: newTrainerId }).in('id', ids);
                        // profiles.trainer_id НЕ трогаем — в кабинет тренера попадают только те,
                        // кто сам зарегался и выбрал тренера в своём профиле
                        const { data } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
                        setSchoolStudents(data || []);
                        setMsg(`✅ Назначено ${withoutTrainer.length} учеников к ${tr?.name}`);
                        e.target.value = '';
                      }}
                      className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1 text-white/70 cursor-pointer hover:bg-white/10 flex-1"
                      defaultValue=""
                    >
                      <option value="">— Выбрать тренера —</option>
                      {schoolTrainers.map(tr => (
                        <option key={tr.id} value={tr.id} style={{ background: '#1a1a2e' }}>
                          {tr.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  {schoolStudents.filter(s => {
                    if (!studentSearch.trim()) return true;
                    const q = studentSearch.toLowerCase();
                    return s.full_name.toLowerCase().includes(q) ||
                           (s.student_code && s.student_code.toLowerCase().includes(q));
                  }).map(s => {
                    const RANKS = [{ min: 0, name: 'Без разряда', short: 'Без', color: '#6b7280' }, { min: 700, name: '5 разряд', short: '5р', color: '#CD7F32' }, { min: 800, name: '4 разряд', short: '4р', color: '#3b82f6' }, { min: 1000, name: '3 разряд', short: '3р', color: '#8b5cf6' }, { min: 1200, name: '2 разряд', short: '2р', color: '#f59e0b' }, { min: 1400, name: '1 разряд', short: '1р', color: '#ef4444' }];
                    let rank = RANKS[0]; for (let i = RANKS.length - 1; i >= 0; i--) if (s.rating >= RANKS[i].min) { rank = RANKS[i]; break; }
                    let nextRank = null; for (const r of RANKS) { if (s.rating < r.min) { nextRank = r; break; } }
                    const progress = nextRank ? Math.min(100, Math.round(((s.rating - rank.min) / (nextRank.min - rank.min)) * 100)) : 100;

                    const updateRating = async (delta: number) => {
                      const newRating = Math.max(0, s.rating + delta);
                      const history = [...(s.rating_history || []), { date: new Date().toLocaleDateString('ru-RU'), rating: newRating }];
                      await supabase.from('school_students').update({ rating: newRating, rating_history: history }).eq('id', s.id);
                      const { data } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
                      setSchoolStudents(data || []);
                    };

                    return (
                      <div key={s.id} className={`rounded-xl bg-white/5 p-4 ${s.graduated ? 'opacity-50' : ''}`}>
                        {/* Имя + разряд */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white/90">{s.full_name}</span>
                              <button
                                onClick={async () => {
                                  const newName = prompt('Изменить ФИО ученика:', s.full_name);
                                  if (newName === null) return;
                                  const trimmed = newName.trim();
                                  if (!trimmed) { alert('ФИО не может быть пустым'); return; }
                                  await supabase.from('school_students').update({ full_name: trimmed }).eq('id', s.id);
                                  const { data } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
                                  setSchoolStudents(data || []);
                                  setMsg('✅ ФИО обновлено');
                                }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border border-yellow-500/20"
                                title="Редактировать ФИО"
                              >
                                ✏️ ФИО
                              </button>
                              {s.birth_year && <span className="text-xs text-white/20">({s.birth_year} г.р.)</span>}
                              {s.student_code && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                                  ID: {s.student_code}
                                </span>
                              )}
                              <button
                                onClick={async () => {
                                  const current = s.student_code || '';
                                  const newId = prompt(`ID ученика (цифры/буквы для поиска):`, current);
                                  if (newId === null) return;
                                  const trimmed = newId.trim();
                                  await supabase.from('school_students').update({ student_code: trimmed || null }).eq('id', s.id);
                                  const { data } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
                                  setSchoolStudents(data || []);
                                }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
                                title="Добавить/изменить ID ученика"
                              >
                                {s.student_code ? '✏️ ID' : '+ ID'}
                              </button>
                            </div>
                            <div className="mt-1">
                              <select
                                value={s.trainer_id || ''}
                                onChange={async (e) => {
                                  const newTrainerId = e.target.value || null;
                                  await supabase.from('school_students').update({ trainer_id: newTrainerId }).eq('id', s.id);
                                  // Примечание: profiles.trainer_id НЕ обновляется автоматически —
                                  // ученик попадает в кабинет тренера только если сам выберет тренера в профиле
                                  const { data } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
                                  setSchoolStudents(data || []);
                                }}
                                className="text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/70 cursor-pointer hover:bg-white/10"
                                style={{ maxWidth: 200 }}
                              >
                                <option value="">— Без тренера —</option>
                                {schoolTrainers.map(tr => (
                                  <option key={tr.id} value={tr.id} style={{ background: '#1a1a2e' }}>
                                    {tr.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-yellow-400" style={{ fontFamily: "'Playfair Display', serif" }}>{s.rating}</div>
                            <div className="text-xs font-semibold" style={{ color: rank.color }}>{rank.name}</div>
                          </div>
                        </div>

                        {/* Прогресс-бар */}
                        {nextRank ? (
                          <div className="mb-3">
                            <div className="flex justify-between text-[10px] text-white/40 mb-1">
                              <span style={{ color: rank.color }}>{rank.name} ({rank.min})</span>
                              <span style={{ color: nextRank.color }}>{nextRank.name} ({nextRank.min})</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(progress, 2)}%`, background: `linear-gradient(90deg, ${rank.color}, ${nextRank.color})` }} />
                            </div>
                            <div className="text-[11px] text-white/50 text-center mt-1">
                              📊 До <b style={{ color: nextRank.color }}>{nextRank.name}</b> осталось <b className="text-yellow-400">{nextRank.min - s.rating}</b> баллов
                            </div>
                          </div>
                        ) : (
                          <div className="mb-3 text-center py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                            <div className="text-xs text-yellow-400">🏆 Максимальный разряд достигнут!</div>
                          </div>
                        )}

                        {/* Мини-график */}
                        {s.rating_history && s.rating_history.length >= 2 && (
                          <div className="mb-3" style={{ height: 40 }}>
                            <svg viewBox="0 0 200 40" className="w-full h-full">
                              {(() => {
                                const hist = s.rating_history.slice(-20);
                                const ratings = hist.map((h: any) => h.rating);
                                const minR = Math.min(...ratings) - 10;
                                const maxR = Math.max(...ratings) + 10;
                                const range = maxR - minR || 1;
                                const points = ratings.map((r: number, i: number) => `${(i / (ratings.length - 1)) * 190 + 5},${35 - ((r - minR) / range) * 30}`).join(' ');
                                return <polyline points={points} fill="none" stroke={rank.color} strokeWidth="1.5" strokeLinejoin="round" />;
                              })()}
                            </svg>
                          </div>
                        )}

                        {/* Достижения */}
                        {s.achievements && s.achievements.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {s.achievements.map((a: string, i: number) => (
                              <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-400/10 text-yellow-400">{a}</span>
                            ))}
                          </div>
                        )}

                        {/* +/- баллы */}
                        <div className="flex items-center gap-1 flex-wrap">
                          {[1, 5, 10, 25, 50].map(v => (
                            <button key={`+${v}`} onClick={() => updateRating(v)}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 hover:bg-green-500/20">+{v}</button>
                          ))}
                          <span className="text-white/10 mx-1">|</span>
                          {[1, 5, 10, 25].map(v => (
                            <button key={`-${v}`} onClick={() => updateRating(-v)}
                              className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20">-{v}</button>
                          ))}
                          <span className="text-white/10 mx-1">|</span>
                          {s.rating >= 1300 && !s.graduated && (
                            <button onClick={async () => {
                              if (!confirm(`Перевести ${s.full_name} на официальный рейтинг?`)) return;
                              await supabase.from('school_students').update({ graduated: true, rating: 0 }).eq('id', s.id);
                              const { data } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
                              setSchoolStudents(data || []); setMsg(`${s.full_name} переведён!`);
                            }} className="px-2 py-0.5 rounded text-[10px] bg-purple-500/10 text-purple-400 hover:bg-purple-500/20">{t('admin_transfer')}</button>
                          )}
                          <button onClick={async () => {
                            if (!confirm(`Удалить ${s.full_name}?`)) return;
                            await supabase.from('school_students').delete().eq('id', s.id);
                            const { data } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
                            setSchoolStudents(data || []);
                          }} className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500/20">{t('admin_delete_btn')}</button>
                        </div>

                        {s.graduated && <div className="mt-2 text-xs text-green-400">✅ Переведён на официальный</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Trainers Tab */}
          {tab === 'trainers' && (
            <div className="space-y-4">
              <div className="glass p-6 rounded-2xl">
                <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>{t('admin_assigned_trainers')}</h3>
                <p className="text-xs text-white/30 mb-4">{t('admin_assign_desc')} </p>
                {users.filter(u => u.is_trainer).length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-3">👨‍🏫</div>
                    <p className="text-white/40">{t('admin_no_trainers')}</p>
                    <p className="text-white/20 text-xs mt-1">{t("admin_assign_desc")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {users.filter(u => u.is_trainer).map(u => (
                      <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                        <span className="text-2xl">👨‍🏫</span>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-white/90">{u.username}</div>
                          <div className="text-xs text-white/30">ELO {u.elo_rating} · {u.games_played} партий</div>
                        </div>
                        <span className="text-xs text-green-400 px-2 py-1 rounded-full bg-green-500/10">{t('admin_trainer_ok')}</span>
                        <button onClick={async () => {
                          if (!confirm(`Убрать роль тренера у ${u.username}?`)) return;
                          await supabase.from('profiles').update({ is_trainer: false }).eq('id', u.id);
                          await supabase.from('school_trainers').delete().eq('profile_id', u.id);
                          const { data } = await supabase.from('profiles').select('id, username, elo_rating, puzzle_rating, is_admin, is_trainer, games_played, coins').order('username', { ascending: true });
                          setUsers(data || []);
                          setMsg(`${u.username} больше не тренер`);
                        }} className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20">
                          Убрать доступ
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shop Tab */}
          {tab === 'shop' && (
            <div className="space-y-4">
              <div className="glass p-6 rounded-2xl">
                <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>{t('admin_add_product')}</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} placeholder="Название товара"
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30" />
                  <input value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} placeholder="Цена (коины)" type="number"
                    className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30" />
                </div>
                <textarea value={productForm.description} onChange={e => setProductForm({ ...productForm, description: e.target.value })} placeholder="Описание товара"
                  rows={2} className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 mb-3 resize-none" />

                {/* Загрузка фото */}
                <div className="mb-3">
                  <label className="block text-xs text-white/40 mb-2">{t('admin_product_photo')}</label>
                  <input type="file" accept="image/*" multiple onChange={async (e) => {
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    setUploading(true);
                    const urls: string[] = [...uploadedImages];
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i];
                      // Сжимаем и конвертируем в base64
                      const dataUrl = await new Promise<string>((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = new window.Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX = 600;
                            let w = img.width, h = img.height;
                            if (w > MAX || h > MAX) {
                              if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
                              else { w = Math.round(w * MAX / h); h = MAX; }
                            }
                            canvas.width = w; canvas.height = h;
                            canvas.getContext('2d')?.drawImage(img, 0, 0, w, h);
                            resolve(canvas.toDataURL('image/jpeg', 0.7));
                          };
                          img.src = ev.target?.result as string;
                        };
                        reader.readAsDataURL(file);
                      });
                      urls.push(dataUrl);
                    }
                    setUploadedImages(urls);
                    setUploading(false);
                    e.target.value = '';
                  }}
                    className="w-full px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-yellow-400/20 file:text-yellow-400 file:text-xs file:cursor-pointer" />
                  {uploading && <p className="text-xs text-yellow-400 mt-1 animate-pulse">{t('admin_uploading_photo')}</p>}
                </div>

                {/* Превью загруженных фото */}
                {uploadedImages.length > 0 && (
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {uploadedImages.map((url, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden bg-white/5">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setUploadedImages(uploadedImages.filter((_, idx) => idx !== i))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">✕</button>
                      </div>
                    ))}
                    <span className="text-[10px] text-white/20 self-center">{uploadedImages.length} фото</span>
                  </div>
                )}

                <motion.button onClick={async () => {
                  if (!productForm.name.trim()) return;
                  await supabase.from('shop_products').insert({ name: productForm.name.trim(), description: productForm.description || null, price: parseInt(productForm.price) || 0, images: uploadedImages });
                  setProductForm({ name: '', description: '', price: '100' });
                  setUploadedImages([]);
                  const { data } = await supabase.from('shop_products').select('*').order('created_at', { ascending: false });
                  setShopProducts(data || []);
                  setMsg('Товар добавлен!');
                }} className="w-full py-2.5 rounded-xl text-sm font-semibold text-black"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  whileTap={{ scale: 0.97 }}>🛍️ Добавить товар</motion.button>
              </div>

              {/* Product list */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10"><span className="text-xs text-white/40 uppercase tracking-wider">{t('admin_products_count')} ({shopProducts.length})</span></div>
                <div className="space-y-2 p-3">
                  {shopProducts.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                      <div className="w-14 h-14 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                        {p.images && p.images.length > 0 ? (
                          <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                        ) : <div className="w-full h-full flex items-center justify-center text-xl text-white/10">📦</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white/80 truncate">{p.name}</div>
                        <div className="text-xs text-white/30 truncate">{p.description || 'Без описания'}</div>
                        <div className="flex items-center gap-1 mt-1"><span className="text-xs">🪙</span><span className="text-sm font-bold text-yellow-400">{p.price}</span></div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={async () => {
                          await supabase.from('shop_products').update({ in_stock: !p.in_stock }).eq('id', p.id);
                          const { data } = await supabase.from('shop_products').select('*').order('created_at', { ascending: false });
                          setShopProducts(data || []);
                        }} className={`px-2 py-1 rounded text-[10px] ${p.in_stock ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                          {p.in_stock ? '✓ В наличии' : '✕ Нет'}
                        </button>
                        <button onClick={async () => {
                          if (!confirm(`Удалить "${p.name}"?`)) return;
                          await supabase.from('shop_products').delete().eq('id', p.id);
                          const { data } = await supabase.from('shop_products').select('*').order('created_at', { ascending: false });
                          setShopProducts(data || []);
                        }} className="px-2 py-1 rounded text-[10px] bg-red-500/10 text-red-400">{t('admin_delete_btn')}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Orders Tab */}
          {tab === 'orders' && (
            <div className="space-y-4">
              <div className="glass p-4 rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>📩 Заказы</h3>
                  <span className="text-xs text-white/30">{shopOrders.filter(o => o.status === 'pending').length} новых</span>
                </div>

                {shopOrders.length === 0 ? (
                  <div className="text-center py-8"><div className="text-4xl mb-3">📩</div><p className="text-white/40">{t('admin_orders_empty')}</p></div>
                ) : (
                  <div className="space-y-2">
                    {shopOrders.map(o => (
                      <div key={o.id} className={`flex items-center gap-3 p-3 rounded-xl ${o.status === 'pending' ? 'bg-yellow-400/5 border border-yellow-400/10' : o.status === 'delivered' ? 'bg-green-500/5' : 'bg-white/5 opacity-50'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-white/80">{o.buyer_name}</div>
                          <div className="text-xs text-white/40">{o.product_name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-yellow-400">🪙 {o.product_price}</span>
                            <span className="text-[10px] text-white/20">{new Date(o.created_at).toLocaleDateString('ru-RU')} {new Date(o.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {o.status === 'pending' && (
                            <>
                              <button onClick={async () => {
                                await supabase.from('shop_orders').update({ status: 'delivered' }).eq('id', o.id);
                                const { data } = await supabase.from('shop_orders').select('*').order('created_at', { ascending: false });
                                setShopOrders(data || []);
                                setMsg(`Заказ "${o.product_name}" для ${o.buyer_name} — выдан!`);
                              }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20">
                                ✓ Выдано
                              </button>
                              <button onClick={async () => {
                                if (!confirm(`Отклонить заказ "${o.product_name}" от ${o.buyer_name}? Коины вернутся.`)) return;
                                // Возвращаем коины
                                const { data: prof } = await supabase.from('profiles').select('coins').eq('id', o.user_id).single();
                                if (prof) {
                                  await supabase.from('profiles').update({ coins: (prof.coins || 0) + o.product_price }).eq('id', o.user_id);
                                }
                                await supabase.from('shop_orders').update({ status: 'rejected' }).eq('id', o.id);
                                const { data } = await supabase.from('shop_orders').select('*').order('created_at', { ascending: false });
                                setShopOrders(data || []);
                                setMsg(`Заказ отклонён, ${o.product_price} коинов возвращены`);
                              }} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20">
                                ✕ Отклонить
                              </button>
                            </>
                          )}
                          {o.status === 'delivered' && <span className="px-3 py-1.5 rounded-lg text-xs bg-green-500/10 text-green-400">✓ Выдано</span>}
                          {o.status === 'rejected' && <span className="px-3 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-400">✕ Отклонено</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Analytics Tab */}
          {tab === 'analytics' && (
            <div className="space-y-4">
              {/* Period selector */}
              <div className="glass p-4 rounded-xl flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold">{t('admin_period')}:</span>
                {(['week', 'month', 'custom'] as const).map(r => (
                  <button key={r} onClick={() => setAnalyticsRange(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${analyticsRange === r ? 'text-black bg-yellow-400' : 'text-white/50 border border-white/10'}`}>
                    {r === 'week' ? 'Неделя' : r === 'month' ? 'Месяц' : 'Выбрать'}
                  </button>
                ))}
                {analyticsRange === 'custom' && (
                  <input type="month" value={analyticsMonth} onChange={e => setAnalyticsMonth(e.target.value)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs" />
                )}
              </div>

              {/* Trainer filter */}
              <div className="glass p-4 rounded-xl flex flex-wrap items-center gap-3">
                <span className="text-sm font-bold">{t('admin_trainer_filter')}:</span>
                <button onClick={() => setAnalyticsTrainer('')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${!analyticsTrainer ? 'text-black bg-yellow-400' : 'text-white/50 border border-white/10'}`}>
                  Все
                </button>
                {users.filter(u => u.is_trainer).map(tr => (
                  <button key={tr.id} onClick={() => setAnalyticsTrainer(tr.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${analyticsTrainer === tr.id ? 'text-black bg-green-400' : 'text-white/50 border border-white/10'}`}>
                    {tr.username}
                  </button>
                ))}
              </div>
              {(() => {
                const now = new Date();
                let startDate: Date;
                if (analyticsRange === 'week') {
                  startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                } else if (analyticsRange === 'month') {
                  startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                } else {
                  const [y, m] = analyticsMonth.split('-').map(Number);
                  startDate = new Date(y, m - 1, 1);
                }
                const endDate = analyticsRange === 'custom' ? new Date(parseInt(analyticsMonth.split('-')[0]), parseInt(analyticsMonth.split('-')[1]), 0, 23, 59, 59) : now;

                const filtered = coinTransactions.filter(t => {
                  const d = new Date(t.created_at);
                  return d >= startDate && d <= endDate;
                });

                const totalEarned = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
                const totalSpent = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
                const fromGames = filtered.filter(t => t.source === 'game' && t.amount > 0).reduce((s, t) => s + t.amount, 0);
                const fromTrainer = filtered.filter(t => t.source === 'trainer' && t.amount > 0).reduce((s, t) => s + t.amount, 0);
                const fromAdmin = filtered.filter(t => t.source === 'admin' && t.amount > 0).reduce((s, t) => s + t.amount, 0);
                const fromTournament = filtered.filter(t => t.source === 'tournament' && t.amount > 0).reduce((s, t) => s + t.amount, 0);

                // Per user breakdown
                const userMap: Record<string, { earned: number; name: string }> = {};
                for (const t of filtered) {
                  if (!userMap[t.user_id]) {
                    const u = users.find(u => u.id === t.user_id);
                    userMap[t.user_id] = { earned: 0, name: u?.username || 'Неизвестный' };
                  }
                  if (t.amount > 0) userMap[t.user_id].earned += t.amount;
                }
                const topUsers = Object.values(userMap).sort((a, b) => b.earned - a.earned).slice(0, 10);

                const periodLabel = analyticsRange === 'week' ? 'за неделю' : analyticsRange === 'month' ? 'за месяц' : `за ${analyticsMonth}`;

                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="glass p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold text-yellow-400" style={{ fontFamily: "'Playfair Display', serif" }}>{totalEarned}</div>
                        <div className="text-xs text-white/40">{t('earned_period')} {periodLabel}</div>
                      </div>
                      <div className="glass p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold text-green-400" style={{ fontFamily: "'Playfair Display', serif" }}>{fromGames}</div>
                        <div className="text-xs text-white/40">{t('admin_for_games')}</div>
                      </div>
                      <div className="glass p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold text-purple-400" style={{ fontFamily: "'Playfair Display', serif" }}>{fromTrainer}</div>
                        <div className="text-xs text-white/40">{t('admin_from_trainers')}</div>
                      </div>
                      <div className="glass p-4 rounded-xl text-center">
                        <div className="text-2xl font-bold text-blue-400" style={{ fontFamily: "'Playfair Display', serif" }}>{fromAdmin + fromTournament}</div>
                        <div className="text-xs text-white/40">{t('admin_admin_tournaments')}</div>
                      </div>
                    </div>

                    {/* Top earners */}
                    <div className="glass p-4 rounded-xl">
                      <div className="text-sm font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>{t('top_students')} {periodLabel}</div>
                      {topUsers.length === 0 ? (
                        <p className="text-center text-white/30 py-4">{t('admin_no_data_period')}</p>
                      ) : topUsers.map((u, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                          <span className="w-6 text-right font-bold" style={{ color: i < 3 ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}>{i < 3 ? ['🥇','🥈','🥉'][i] : i+1}</span>
                          <span className="flex-1 text-white/70">{u.name}</span>
                          <span className="font-bold text-yellow-400">+{u.earned} 🪙</span>
                        </div>
                      ))}
                    </div>

                    {/* Trainer stats */}
                    {analyticsTrainer && (() => {
                      const trainerName = users.find(u => u.id === analyticsTrainer)?.username || '?';
                      // Фильтруем транзакции от этого тренера (description содержит его ID)
                      const trainerTxs = filtered.filter(t => t.source === 'trainer' && t.description?.includes(analyticsTrainer));
                      const trainerAdded = trainerTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
                      const trainerOps = trainerTxs.length;
                      // Уникальные ученики
                      const trainerStudents = new Set(trainerTxs.map(t => t.user_id)).size;
                      return (
                        <div className="glass p-4 rounded-xl border border-green-500/20">
                          <div className="text-sm font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>
                            👨‍🏫 Тренер: <span className="text-green-400">{trainerName}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div className="p-3 rounded-lg bg-white/5 text-center">
                              <div className="text-xl font-bold text-green-400">{trainerAdded}</div>
                              <div className="text-[10px] text-white/30">{t('admin_coins_credited')}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 text-center">
                              <div className="text-xl font-bold text-purple-400">{trainerOps}</div>
                              <div className="text-[10px] text-white/30">{t('admin_operations')}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-white/5 text-center">
                              <div className="text-xl font-bold text-blue-400">{trainerStudents}</div>
                              <div className="text-[10px] text-white/30">{t('admin_to_students')}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Recent transactions */}
                    <div className="glass p-4 rounded-xl">
                      <div className="text-sm font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>{t('admin_recent_ops')}</div>
                      <div className="max-h-60 overflow-y-auto space-y-1">
                        {filtered.slice(0, 30).map(tx => {
                          const u = users.find(u => u.id === tx.user_id);
                          return (
                            <div key={tx.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-white/5">
                              <span className={tx.amount > 0 ? 'text-green-400' : 'text-red-400'}>{tx.amount > 0 ? '+' : ''}{tx.amount}</span>
                              <span className="text-white/50 flex-1">{u?.username || '?'}</span>
                              <span className="text-white/20">{tx.source}</span>
                              <span className="text-white/15">{new Date(tx.created_at).toLocaleDateString('ru-RU')}</span>
                            </div>
                          );
                        })}
                        {filtered.length === 0 && <p className="text-center text-white/20 py-4">{t('admin_no_ops')}</p>}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
