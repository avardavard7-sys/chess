'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Header from '@/components/Header';
import FriendChat from '@/components/FriendChat';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/lib/i18n';

type Tab = 'students' | 'groups' | 'schedule' | 'attendance' | 'homework' | 'stats' | 'internal';

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const DAYS_FULL = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const RANKS = [
  { min: 0, name: 'Без разряда', short: 'Без', color: '#6b7280' },
  { min: 700, short: '5р', color: '#CD7F32', name: '5 разряд' },
  { min: 800, short: '4р', color: '#3b82f6', name: '4 разряд' },
  { min: 1000, short: '3р', color: '#8b5cf6', name: '3 разряд' },
  { min: 1200, short: '2р', color: '#f59e0b', name: '2 разряд' },
  { min: 1400, short: '1р', color: '#ef4444', name: '1 разряд' },
];
const getRank = (r: number) => { let rank = RANKS[0]; for (let i = RANKS.length - 1; i >= 0; i--) if (r >= RANKS[i].min) { rank = RANKS[i]; break; } return rank; };
const THEMES: Record<string, string> = { mateIn1: 'Мат в 1', mateIn2: 'Мат в 2', fork: 'Вилка', pin: 'Связка', skewer: 'Сквозной удар', sacrifice: 'Жертва', backRankMate: 'Мат по задней', discoveredAttack: 'Вскрытая атака', deflection: 'Отвлечение', hangingPiece: 'Висячая фигура', advantage: 'Преимущество', endgame: 'Эндшпиль', rookEndgame: 'Ладейный', pawnEndgame: 'Пешечный', queenEndgame: 'Ферзевой', kingsideAttack: 'Атака на короля', trappedPiece: 'Ловушка', opening: 'Дебют', short: 'Короткая', oneMove: 'Один ход', attackingF2F7: 'Атака f2/f7' };

export default function TrainerPage() {
  const { t } = useTranslation();
  const [userId, setUserId] = useState<string | null>(null);
  const [isTrainer, setIsTrainer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('students');
  const [msg, setMsg] = useState('');

  const [students, setStudents] = useState<any[]>([]);
  const [internalStudents, setInternalStudents] = useState<any[]>([]);
  const [internalSearch, setInternalSearch] = useState('');
  const [selectedInternal, setSelectedInternal] = useState<any>(null);
  const [groups, setGroups] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [awards, setAwards] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [chatStudent, setChatStudent] = useState<any>(null);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

  // Group form
  const [newGroupName, setNewGroupName] = useState('');
  const [groupStudentIds, setGroupStudentIds] = useState<Set<string>>(new Set());
  const [showGroupSelect, setShowGroupSelect] = useState(false);

  // Schedule form
  const [schedForm, setSchedForm] = useState({ day: 1, time: '15:00', end: '16:00', topic: '', group_id: '' });

  // Homework form
  const [hwForm, setHwForm] = useState({ title: '', theme: 'mateIn1', count: 5, video: '', student_ids: new Set<string>(), group_id: '', desc: '' });
  const [showHwStudents, setShowHwStudents] = useState(false);

  // Notes
  const [noteText, setNoteText] = useState('');
  const [notePrivate, setNotePrivate] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState(500);
  const [awardTitle, setAwardTitle] = useState('');
  const [awardIcon, setAwardIcon] = useState('⭐');

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const loadAll = useCallback(async (uid: string) => {
    // Ищем запись тренера: сначала по profile_id, потом fallback по имени
    let trainerEntry = (await supabase.from('school_trainers').select('id, name, profile_id').eq('profile_id', uid).maybeSingle()).data;

    // Если не нашли по profile_id — ищем по имени из profiles
    if (!trainerEntry) {
      const myProfile = (await supabase.from('profiles').select('username, full_name').eq('id', uid).maybeSingle()).data;
      if (myProfile) {
        const allTrainers = (await supabase.from('school_trainers').select('id, name, profile_id')).data || [];
        // Поиск по точному совпадению или вхождению
        trainerEntry = allTrainers.find((tr: any) =>
          tr.name === myProfile.username ||
          tr.name === myProfile.full_name ||
          (myProfile.full_name && tr.name && tr.name.toLowerCase().includes(myProfile.full_name.toLowerCase())) ||
          (myProfile.username && tr.name && tr.name.toLowerCase().includes(myProfile.username.toLowerCase()))
        ) || null;

        // Если нашли — авто-привязка profile_id для будущих заходов
        if (trainerEntry && !trainerEntry.profile_id) {
          await supabase.from('school_trainers').update({ profile_id: uid }).eq('id', trainerEntry.id);
        }
      }
    }

    console.log('[Trainer Cabinet]', { uid, trainerEntry });

    const [stR, grR, scR, atR, hwR, ntR, glR, awR, prR] = await Promise.all([
      supabase.from('school_students').select('*').order('full_name', { ascending: true }),
      supabase.from('trainer_groups').select('*').eq('trainer_id', uid).order('name'),
      supabase.from('trainer_schedule').select('*').eq('trainer_id', uid).order('day_of_week'),
      supabase.from('trainer_attendance').select('*').eq('trainer_id', uid).order('date', { ascending: false }).limit(500),
      supabase.from('trainer_homework').select('*').eq('trainer_id', uid).order('created_at', { ascending: false }),
      supabase.from('trainer_notes').select('*').eq('trainer_id', uid).order('created_at', { ascending: false }),
      supabase.from('trainer_goals').select('*').eq('trainer_id', uid).order('created_at', { ascending: false }),
      supabase.from('trainer_awards').select('*').eq('trainer_id', uid).order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, username, avatar_url, elo_rating, trainer_id').order('username'),
    ]);
    // students = зарегистрированные пользователи (для основных функций)
    const registeredProfileIds = new Set(
      (prR.data || []).filter((p: any) => p.trainer_id === uid).map((p: any) => p.id)
    );
    const myStudents = (stR.data || []).filter(
      (s: any) => s.profile_id && registeredProfileIds.has(s.profile_id)
    );
    setStudents(myStudents);

    // internalStudents = вручную добавленные ученики (для внутреннего рейтинга)
    // Привязаны через school_students.trainer_id = school_trainers.id
    if (trainerEntry?.id) {
      const internal = (stR.data || []).filter(
        (s: any) => !s.profile_id && s.trainer_id === trainerEntry.id
      );
      setInternalStudents(internal);
    }

    setGroups(grR.data || []);
    setSchedule(scR.data || []);
    setAttendance(atR.data || []);
    setHomework(hwR.data || []);
    setNotes(ntR.data || []);
    setGoals(glR.data || []);
    setAwards(awR.data || []);
    setProfiles(prR.data || []);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        supabase.from('profiles').select('is_trainer').eq('id', session.user.id).single().then(({ data }) => {
          if (data?.is_trainer) { setIsTrainer(true); loadAll(session.user.id); }
          setLoading(false);
        });
      } else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((ev, session) => {
      if (ev === 'SIGNED_OUT') { setUserId(null); setIsTrainer(false); }
    });
    return () => subscription.unsubscribe();
  }, [loadAll]);

  const reload = () => { if (userId) loadAll(userId); };
  const getProfile = (s: any) => profiles.find(p => p.id === s.profile_id);
  const getAttPct = (sid: string) => { const r = attendance.filter(a => a.student_id === sid); return r.length === 0 ? -1 : Math.round((r.filter(a => a.present).length / r.length) * 100); };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>♞</motion.div></div>;
  if (!isTrainer) return <div className="min-h-screen"><Header /><div className="flex items-center justify-center min-h-screen pt-24 px-4"><div className="glass p-10 rounded-2xl text-center max-w-md"><div className="text-5xl mb-4">🔒</div><h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>{t('trainer_access_only')}</h2><p className="text-white/40 text-sm">{t('trainer_contact_admin')}</p></div></div></div>;

  // Chat
  if (chatStudent) {
    const prof = getProfile(chatStudent);
    if (prof) return <div className="min-h-screen"><Header /><main className="pt-24 pb-12 px-4"><div className="max-w-2xl mx-auto"><div className="glass rounded-2xl overflow-hidden" style={{ height: 'calc(100vh - 140px)' }}><FriendChat userId={userId!} friend={prof} onClose={() => setChatStudent(null)} onInvite={() => {}} /></div></div></main></div>;
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-6" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{t('trainer_title')}</h1>
            <p className="text-white/40 text-sm">{students.length} учеников · {groups.length} групп</p>
          </motion.div>

          <AnimatePresence>{msg && <motion.div className="mb-4 p-3 rounded-xl text-center text-sm font-semibold" style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{msg}</motion.div>}</AnimatePresence>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
            {([['students', `📋 ${t('trainer_students')}`], ['internal', `🎓 Внутренний рейтинг`], ['groups', `👥 ${t('trainer_groups')}`], ['schedule', `📅 ${t('trainer_schedule')}`], ['attendance', `✅ ${t('trainer_attendance')}`], ['homework', `📝 ${t('trainer_homework')}`], ['stats', `📊 ${t('trainer_stats')}`]] as [Tab, string][]).map(([id, label]) => (
              <motion.button key={id} onClick={() => setTab(id)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${tab === id ? 'text-black' : 'text-white/50 border border-white/10 hover:bg-white/5'}`}
                style={tab === id ? { background: 'linear-gradient(135deg, #f59e0b, #d97706)' } : {}}
                whileTap={{ scale: 0.95 }}>{label}</motion.button>
            ))}
          </div>

          {/* ═══ УЧЕНИКИ ═══ */}
          {tab === 'students' && (
            <div className="space-y-3">
              {students.length === 0 ? (
                <div className="glass p-10 rounded-2xl text-center"><div className="text-4xl mb-3">📋</div><p className="text-white/40">{t('trainer_no_students')}</p></div>
              ) : students.map(s => {
                const rank = getRank(s.rating);
                const prof = getProfile(s);
                const isOpen = selectedStudent?.id === s.id;
                const sGoals = goals.filter(g => g.student_id === s.id && !g.completed);
                const sAwards = awards.filter(a => a.student_id === s.id);
                const sNotes = notes.filter(n => n.student_id === s.id);
                const group = groups.find(g => g.id === s.group_id);
                return (
                  <motion.div key={s.id} className={`glass rounded-2xl overflow-hidden ${isOpen ? 'ring-1 ring-yellow-400/30' : ''}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => setSelectedStudent(isOpen ? null : s)}>
                      <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-lg font-bold text-yellow-400 overflow-hidden flex-shrink-0">
                        {prof?.avatar_url ? <Image src={prof.avatar_url} alt="" width={40} height={40} className="w-full h-full object-cover" /> : s.full_name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-white/90 truncate">{s.full_name}</div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-yellow-400">{s.rating} б.</span>
                          <span style={{ color: rank.color }}>{rank.short}</span>
                          {group && <span className="text-white/20">· {group.name}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {[1, 5, 10].map(v => (
                          <button key={v} onClick={async (e) => { e.stopPropagation();
                            const nr = s.rating + v;
                            const hist = [...(s.rating_history || []), { date: new Date().toLocaleDateString('ru-RU'), rating: nr }];
                            await supabase.from('school_students').update({ rating: nr, rating_history: hist }).eq('id', s.id);
                            reload(); notify(`+${v} баллов`);
                          }} className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/10 text-green-400 hover:bg-green-500/20">+{v}</button>
                        ))}
                      </div>
                      {/* Коины */}
                      {prof && (
                        <div className="flex gap-1 flex-shrink-0">
                          {[1, 5, 10].map(v => (
                            <button key={`c${v}`} onClick={async (e) => { e.stopPropagation();
                              // Добавляем коины в профиль
                              const { data: p } = await supabase.from('profiles').select('coins').eq('id', prof.id).single();
                              const newCoins = (p?.coins || 0) + v;
                              await supabase.from('profiles').update({ coins: newCoins }).eq('id', prof.id);
                              // Записываем транзакцию
                              await supabase.from('coin_transactions').insert({
                                user_id: prof.id, amount: v, source: 'trainer',
                                description: `Тренер: ${userId}`,
                              });
                              notify(`+${v} 🪙`);
                            }} className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20">+{v}🪙</button>
                          ))}
                        </div>
                      )}
                      {prof && <button onClick={(e) => { e.stopPropagation(); setChatStudent(s); }} className="px-2 py-1 rounded-lg text-[10px] border border-white/10 text-white/40 hover:text-white/70 flex-shrink-0">💬 Написать</button>}
                      <span className="text-white/20">{isOpen ? '▲' : '▼'}</span>
                    </div>

                    <AnimatePresence>
                      {isOpen && (
                        <motion.div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                          {/* Group assign */}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-white/30">{t('trainer_group')}:</span>
                            <select value={s.group_id || ''} onChange={async (e) => { await supabase.from('school_students').update({ group_id: e.target.value || null }).eq('id', s.id); reload(); }}
                              className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-xs">
                              <option value="">{t('trainer_not_assigned')}</option>
                              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                            </select>
                          </div>
                          {/* Goals */}
                          <div>
                            <div className="text-[10px] text-white/30 mb-1">{t('trainer_goals')}</div>
                            {sGoals.map(g => (
                              <div key={g.id} className="flex items-center gap-2 text-xs mb-1">
                                <span className="text-white/50 flex-1">{g.title} ({g.target_rating}б.)</span>
                                <div className="w-20 h-1.5 bg-white/10 rounded-full"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${Math.min(100, Math.round((s.rating / (g.target_rating || 1)) * 100))}%` }} /></div>
                                <button onClick={async () => { await supabase.from('trainer_goals').update({ completed: true }).eq('id', g.id); reload(); }} className="text-green-400 text-[10px]">✓</button>
                              </div>
                            ))}
                            <div className="flex gap-1 mt-1">
                              <input value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="Цель" className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-[10px] placeholder-white/20" />
                              <input type="number" value={goalTarget} onChange={e => setGoalTarget(+e.target.value)} className="w-16 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-[10px]" />
                              <button onClick={async () => { if (!goalTitle) return; await supabase.from('trainer_goals').insert({ trainer_id: userId, student_id: s.id, title: goalTitle, target_rating: goalTarget }); setGoalTitle(''); reload(); notify('Цель добавлена'); }} className="px-2 py-1 rounded text-[10px] bg-yellow-400/10 text-yellow-400">+</button>
                            </div>
                          </div>
                          {/* Awards */}
                          <div>
                            <div className="text-[10px] text-white/30 mb-1">{t('trainer_rewards')}</div>
                            <div className="flex flex-wrap gap-1 mb-1">{sAwards.map(a => <span key={a.id} className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-400/10 text-yellow-400">{a.icon} {a.title}</span>)}</div>
                            <div className="flex gap-1">
                              <select value={awardIcon} onChange={e => setAwardIcon(e.target.value)} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-[10px]">
                                {['⭐', '🏆', '🥇', '🥈', '🥉', '🔥', '💎', '👑', '🎯', '💪'].map(i => <option key={i} value={i}>{i}</option>)}
                              </select>
                              <input value={awardTitle} onChange={e => setAwardTitle(e.target.value)} placeholder="Награда" className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-[10px] placeholder-white/20" />
                              <button onClick={async () => { if (!awardTitle) return; await supabase.from('trainer_awards').insert({ trainer_id: userId, student_id: s.id, title: awardTitle, icon: awardIcon }); setAwardTitle(''); reload(); notify('Награда!'); }} className="px-2 py-1 rounded text-[10px] bg-purple-400/10 text-purple-400">+</button>
                            </div>
                          </div>
                          {/* Notes */}
                          <div>
                            <div className="text-[10px] text-white/30 mb-1">{t('trainer_comments')}</div>
                            {sNotes.slice(0, 3).map(n => (
                              <div key={n.id} className={`text-xs px-2 py-1 rounded mb-1 ${n.is_private ? 'bg-red-500/5 text-white/40' : 'bg-white/5 text-white/60'}`}>
                                {n.is_private && <span className="text-red-400 text-[10px] mr-1">🔒</span>}{n.text}
                              </div>
                            ))}
                            <div className="flex gap-1 mt-1">
                              <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Комментарий..." className="flex-1 px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-[10px] placeholder-white/20" />
                              <button onClick={() => setNotePrivate(!notePrivate)} className={`px-2 py-1 rounded text-[10px] ${notePrivate ? 'bg-red-500/10 text-red-400' : 'bg-white/5 text-white/30'}`}>{notePrivate ? '🔒' : '👁'}</button>
                              <button onClick={async () => { if (!noteText) return; await supabase.from('trainer_notes').insert({ trainer_id: userId, student_id: s.id, text: noteText, is_private: notePrivate }); setNoteText(''); reload(); notify('Комментарий добавлен'); }} className="px-2 py-1 rounded text-[10px] bg-blue-400/10 text-blue-400">+</button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ═══ ВНУТРЕННИЙ РЕЙТИНГ (вручную добавленные ученики) ═══ */}
          {tab === 'internal' && (
            <div className="space-y-4">
              {internalStudents.length === 0 && (
                <div className="glass p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5">
                  <div className="text-sm text-yellow-400 font-semibold mb-2">⚠️ Учеников пока нет</div>
                  <div className="text-xs text-white/60 leading-relaxed">
                    Возможные причины:
                    <br/>• Администратор ещё не назначил тебя тренером для учеников
                    <br/>• В таблице school_trainers твой profile_id не привязан к записи тренера
                    <br/>
                    <br/>Попроси администратора:
                    <br/>1) Зайти в админ панель → Тренеры
                    <br/>2) Найти запись с твоим именем
                    <br/>3) Привязать profile_id к твоему аккаунту (или создать новую запись)
                    <br/>4) Затем в Рейтинг → выбрать тренера для учеников
                  </div>
                </div>
              )}
              <div className="glass p-4 rounded-xl">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">🎓 Мои ученики ({internalStudents.length})</div>
                <input
                  type="text"
                  placeholder="🔍 Поиск по ФИО или ID..."
                  value={internalSearch}
                  onChange={(e) => setInternalSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 mb-3"
                />
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {internalStudents
                    .filter(s => {
                      if (!internalSearch.trim()) return true;
                      const q = internalSearch.toLowerCase();
                      return s.full_name.toLowerCase().includes(q) ||
                             (s.student_code && s.student_code.toLowerCase().includes(q));
                    })
                    .map(s => {
                      const rank = getRank(s.rating);
                      const isSelected = selectedInternal?.id === s.id;
                      return (
                        <div
                          key={s.id}
                          onClick={() => setSelectedInternal(isSelected ? null : s)}
                          className={`p-3 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-yellow-500/15 border border-yellow-500/40' : 'bg-white/5 hover:bg-white/10 border border-transparent'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-white/90 truncate">{s.full_name}</div>
                              <div className="flex items-center gap-2 text-[10px] text-white/40">
                                {s.birth_year && <span>{s.birth_year} г.р.</span>}
                                {s.student_code && <span className="px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300">ID: {s.student_code}</span>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-yellow-400">{s.rating}</div>
                              <div className="text-[10px]" style={{ color: rank.color }}>{rank.name}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Карточка ученика — посещаемость, успехи, советы */}
              {selectedInternal && (
                <div className="glass p-4 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-base font-bold text-white/90">{selectedInternal.full_name}</div>
                      <div className="text-xs text-white/40">Карточка ученика</div>
                    </div>
                    <button onClick={() => setSelectedInternal(null)} className="text-white/30 hover:text-white/60">✕</button>
                  </div>

                  {/* Посещаемость */}
                  <div>
                    <div className="text-xs text-white/50 uppercase mb-2">📅 Посещаемость</div>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="date"
                        id={`att-date-${selectedInternal.id}`}
                        defaultValue={new Date().toISOString().slice(0, 10)}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
                      />
                      <button
                        onClick={async () => {
                          const dateInput = document.getElementById(`att-date-${selectedInternal.id}`) as HTMLInputElement;
                          const date = dateInput?.value;
                          if (!date || !userId) return;
                          await supabase.from('trainer_attendance').insert({
                            trainer_id: userId,
                            student_id: selectedInternal.id,
                            date,
                            present: true,
                          });
                          notify('✅ Посещение отмечено');
                          loadAll(userId);
                        }}
                        className="px-3 py-2 rounded-lg bg-green-500/15 text-green-400 text-xs border border-green-500/30"
                      >
                        ✓ Был
                      </button>
                      <button
                        onClick={async () => {
                          const dateInput = document.getElementById(`att-date-${selectedInternal.id}`) as HTMLInputElement;
                          const date = dateInput?.value;
                          if (!date || !userId) return;
                          await supabase.from('trainer_attendance').insert({
                            trainer_id: userId,
                            student_id: selectedInternal.id,
                            date,
                            present: false,
                          });
                          notify('❌ Пропуск отмечен');
                          loadAll(userId);
                        }}
                        className="px-3 py-2 rounded-lg bg-red-500/15 text-red-400 text-xs border border-red-500/30"
                      >
                        ✗ Не был
                      </button>
                    </div>
                    <div className="text-[10px] text-white/40">
                      Посещений: {attendance.filter(a => a.student_id === selectedInternal.id && a.present).length} •
                      Пропусков: {attendance.filter(a => a.student_id === selectedInternal.id && !a.present).length}
                    </div>
                  </div>

                  {/* Успехи */}
                  <div>
                    <div className="text-xs text-white/50 uppercase mb-2">🏆 Успехи</div>
                    <textarea
                      id={`success-${selectedInternal.id}`}
                      placeholder="Опишите успехи ученика..."
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 min-h-[60px] resize-y"
                    />
                    <button
                      onClick={async () => {
                        const ta = document.getElementById(`success-${selectedInternal.id}`) as HTMLTextAreaElement;
                        const text = ta?.value.trim();
                        if (!text || !userId) return;
                        await supabase.from('trainer_notes').insert({
                          trainer_id: userId,
                          student_id: selectedInternal.id,
                          text,
                          note_type: 'success',
                          is_private: false,
                        });
                        ta.value = '';
                        notify('✅ Успех добавлен');
                        loadAll(userId);
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-yellow-500/15 text-yellow-400 text-xs border border-yellow-500/30"
                    >
                      Добавить
                    </button>
                  </div>

                  {/* Комментарии для родителей */}
                  <div>
                    <div className="text-xs text-white/50 uppercase mb-2">💬 Комментарии для родителей</div>
                    <textarea
                      id={`comment-${selectedInternal.id}`}
                      placeholder="Сообщение родителям..."
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 min-h-[60px] resize-y"
                    />
                    <button
                      onClick={async () => {
                        const ta = document.getElementById(`comment-${selectedInternal.id}`) as HTMLTextAreaElement;
                        const text = ta?.value.trim();
                        if (!text || !userId) return;
                        await supabase.from('trainer_notes').insert({
                          trainer_id: userId,
                          student_id: selectedInternal.id,
                          text,
                          note_type: 'parent_comment',
                          is_private: false,
                        });
                        ta.value = '';
                        notify('✅ Комментарий добавлен');
                        loadAll(userId);
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 text-xs border border-blue-500/30"
                    >
                      Добавить
                    </button>
                  </div>

                  {/* Советы */}
                  <div>
                    <div className="text-xs text-white/50 uppercase mb-2">💡 Советы и рекомендации</div>
                    <textarea
                      id={`advice-${selectedInternal.id}`}
                      placeholder="Что можно улучшить..."
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 min-h-[60px] resize-y"
                    />
                    <button
                      onClick={async () => {
                        const ta = document.getElementById(`advice-${selectedInternal.id}`) as HTMLTextAreaElement;
                        const text = ta?.value.trim();
                        if (!text || !userId) return;
                        await supabase.from('trainer_notes').insert({
                          trainer_id: userId,
                          student_id: selectedInternal.id,
                          text,
                          note_type: 'advice',
                          is_private: false,
                        });
                        ta.value = '';
                        notify('✅ Совет добавлен');
                        loadAll(userId);
                      }}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-purple-500/15 text-purple-400 text-xs border border-purple-500/30"
                    >
                      Добавить
                    </button>
                  </div>

                  {/* История заметок */}
                  {notes.filter(n => n.student_id === selectedInternal.id).length > 0 && (
                    <div>
                      <div className="text-xs text-white/50 uppercase mb-2">📋 История</div>
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {notes.filter(n => n.student_id === selectedInternal.id).map(n => {
                          const typeLabel: Record<string, string> = { success: '🏆', parent_comment: '💬', advice: '💡' };
                          return (
                            <div key={n.id} className="text-xs p-2 rounded bg-white/5">
                              <span className="mr-1">{typeLabel[n.note_type] || '📝'}</span>
                              <span className="text-white/70">{n.text}</span>
                              <div className="text-[10px] text-white/30 mt-0.5">{new Date(n.created_at).toLocaleDateString('ru-RU')}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ═══ ГРУППЫ ═══ */}
          {tab === 'groups' && (
            <div className="space-y-4">
              <div className="glass p-4 rounded-xl">
                <div className="flex gap-2 mb-3">
                  <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Название группы"
                    className="flex-1 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30" />
                  <motion.button onClick={() => setShowGroupSelect(!showGroupSelect)}
                    className="px-4 py-2 rounded-xl text-sm border border-white/10 text-white/50 hover:text-white/80"
                    whileTap={{ scale: 0.95 }}>👥 Выбрать учеников</motion.button>
                </div>

                {/* Выбор учеников */}
                <AnimatePresence>
                  {showGroupSelect && (
                    <motion.div className="mb-3 p-3 rounded-xl bg-white/5 space-y-1 max-h-48 overflow-y-auto"
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                      <div className="text-xs text-white/30 mb-2">{t('select_students')}:</div>
                      {students.map(s => (
                        <label key={s.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer">
                          <input type="checkbox" checked={groupStudentIds.has(s.id)}
                            onChange={e => {
                              const newSet = new Set(groupStudentIds);
                              if (e.target.checked) newSet.add(s.id); else newSet.delete(s.id);
                              setGroupStudentIds(newSet);
                            }}
                            className="rounded" />
                          <span className="text-sm text-white/70 flex-1">{s.full_name}</span>
                          <span className="text-xs text-yellow-400">{s.rating} б.</span>
                        </label>
                      ))}
                      <div className="text-xs text-white/20 mt-1">{t('selected_count')}: {groupStudentIds.size}</div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button onClick={async () => {
                  if (!newGroupName.trim()) return;
                  const { data: g } = await supabase.from('trainer_groups').insert({ trainer_id: userId, name: newGroupName.trim() }).select().single();
                  if (g && groupStudentIds.size > 0) {
                    for (const sid of groupStudentIds) {
                      await supabase.from('school_students').update({ group_id: g.id }).eq('id', sid);
                    }
                  }
                  setNewGroupName(''); setGroupStudentIds(new Set()); setShowGroupSelect(false);
                  reload(); notify(`Группа создана (${groupStudentIds.size} учеников)`);
                }} className="w-full py-2 rounded-xl text-sm font-semibold text-black"
                  style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }} whileTap={{ scale: 0.95 }}>
                  Создать группу {groupStudentIds.size > 0 && `(${groupStudentIds.size} учеников)`}
                </motion.button>
              </div>

              {groups.map(g => {
                const gs = students.filter(s => s.group_id === g.id);
                return (
                  <div key={g.id} className="glass p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-yellow-400">{g.name} <span className="text-white/30 font-normal">({gs.length})</span></span>
                      <button onClick={async () => { if (confirm(`Удалить "${g.name}"?`)) { await supabase.from('trainer_groups').delete().eq('id', g.id); reload(); } }} className="text-xs text-red-400/50 hover:text-red-400">✕</button>
                    </div>
                    {gs.sort((a, b) => b.rating - a.rating).map((s, i) => (
                      <div key={s.id} className="flex items-center gap-2 px-2 py-1 text-xs">
                        <span className="w-5 text-right text-white/20">{i + 1}.</span>
                        <span className="flex-1 text-white/70">{s.full_name}</span>
                        <span className="text-yellow-400 font-bold">{s.rating}</span>
                        <span style={{ color: getRank(s.rating).color }} className="text-[10px]">{getRank(s.rating).short}</span>
                      </div>
                    ))}
                    {gs.length === 0 && <p className="text-xs text-white/20 text-center py-2">{t('no_students_group')}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ РАСПИСАНИЕ ═══ */}
          {tab === 'schedule' && (
            <div className="space-y-4">
              <div className="glass p-4 rounded-xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <select value={schedForm.day} onChange={e => setSchedForm({ ...schedForm, day: +e.target.value })} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                    {DAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <input type="time" value={schedForm.time} onChange={e => setSchedForm({ ...schedForm, time: e.target.value })} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm" />
                  <input type="time" value={schedForm.end} onChange={e => setSchedForm({ ...schedForm, end: e.target.value })} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm" />
                  <select value={schedForm.group_id} onChange={e => setSchedForm({ ...schedForm, group_id: e.target.value })} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                    <option value="">{t('all_filter')}</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
                <input value={schedForm.topic} onChange={e => setSchedForm({ ...schedForm, topic: e.target.value })} placeholder="Тема урока" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 mb-2" />
                <motion.button onClick={async () => {
                  await supabase.from('trainer_schedule').insert({ trainer_id: userId, day_of_week: schedForm.day, start_time: schedForm.time, end_time: schedForm.end, topic: schedForm.topic || null, group_id: schedForm.group_id || null });
                  reload(); notify('Добавлено');
                }} className="w-full py-2 rounded-xl text-sm font-semibold text-black" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} whileTap={{ scale: 0.97 }}>Добавить</motion.button>
              </div>
              {[1,2,3,4,5,6,0].map(day => {
                const ds = schedule.filter(s => s.day_of_week === day);
                if (ds.length === 0) return null;
                return <div key={day} className="glass p-4 rounded-xl"><div className="text-sm font-bold text-yellow-400 mb-2">{DAYS_FULL[day]}</div>
                  {ds.map(s => <div key={s.id} className="flex items-center gap-3 px-2 py-1.5 text-sm"><span className="text-white/80 font-mono">{s.start_time}–{s.end_time||'?'}</span><span className="text-white/50 flex-1">{s.topic||'Занятие'}</span>
                    {s.group_id && <span className="text-xs text-purple-400">{groups.find(g=>g.id===s.group_id)?.name}</span>}
                    <button onClick={async()=>{await supabase.from('trainer_schedule').delete().eq('id',s.id);reload();}} className="text-xs text-red-400/50 hover:text-red-400">✕</button>
                  </div>)}</div>;
              })}
            </div>
          )}

          {/* ═══ ПОСЕЩАЕМОСТЬ ═══ */}
          {tab === 'attendance' && (
            <div className="glass p-4 rounded-xl">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-bold">{t('date_label')}:</span>
                <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm" />
              </div>
              {students.map(s => {
                const rec = attendance.find(a => a.student_id === s.id && a.date === attendanceDate);
                return (
                  <div key={s.id} className="flex items-center gap-3 px-2 py-2 border-b border-white/5">
                    <button onClick={async () => {
                      if (rec) { await supabase.from('trainer_attendance').update({ present: !rec.present }).eq('id', rec.id); }
                      else { await supabase.from('trainer_attendance').insert({ trainer_id: userId, student_id: s.id, date: attendanceDate, present: true }); }
                      reload();
                    }} className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg ${rec?.present ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/20'}`}>
                      {rec?.present ? '✓' : '○'}
                    </button>
                    <span className="text-sm text-white/70 flex-1">{s.full_name}</span>
                    <span className="text-xs text-white/20">{getAttPct(s.id) >= 0 ? `${getAttPct(s.id)}%` : '—'}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══ ДОМАШНЕЕ ЗАДАНИЕ ═══ */}
          {tab === 'homework' && (
            <div className="space-y-4">
              <div className="glass p-4 rounded-xl">
                <div className="text-sm font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif" }}>{t('assign_task')}</div>
                <input value={hwForm.title} onChange={e => setHwForm({ ...hwForm, title: e.target.value })} placeholder="Название (напр: Тренировка вилок)"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 mb-2" />
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <select value={hwForm.theme} onChange={e => setHwForm({ ...hwForm, theme: e.target.value })} className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                    {Object.entries(THEMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/30">{t('tasks_label')}:</span>
                    <input type="number" value={hwForm.count} onChange={e => setHwForm({ ...hwForm, count: +e.target.value })} min={1} max={50} className="flex-1 px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm" />
                  </div>
                </div>
                <input value={hwForm.video} onChange={e => setHwForm({ ...hwForm, video: e.target.value })} placeholder="YouTube ссылка (необязательно)" className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 mb-2" />
                <textarea value={hwForm.desc} onChange={e => setHwForm({ ...hwForm, desc: e.target.value })} placeholder="Описание задания (необязательно)" rows={2} className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 mb-2 resize-none" />

                {/* Кому назначить */}
                <div className="mb-2">
                  <div className="flex gap-2 mb-2">
                    <select value={hwForm.group_id} onChange={e => setHwForm({ ...hwForm, group_id: e.target.value })} className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm">
                      <option value="">{t('select_group')}</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({students.filter(s=>s.group_id===g.id).length})</option>)}
                    </select>
                    <button onClick={() => setShowHwStudents(!showHwStudents)} className="px-3 py-2 rounded-xl text-xs border border-white/10 text-white/50 hover:text-white/80">
                      👤 Выбрать учеников ({hwForm.student_ids.size})
                    </button>
                  </div>

                  <AnimatePresence>
                    {showHwStudents && (
                      <motion.div className="p-3 rounded-xl bg-white/5 space-y-1 max-h-40 overflow-y-auto mb-2"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                        {students.map(s => (
                          <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer text-xs">
                            <input type="checkbox" checked={hwForm.student_ids.has(s.id)}
                              onChange={e => {
                                const ns = new Set(hwForm.student_ids);
                                if (e.target.checked) ns.add(s.id); else ns.delete(s.id);
                                setHwForm({ ...hwForm, student_ids: ns });
                              }} />
                            <span className="text-white/70 flex-1">{s.full_name}</span>
                          </label>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <motion.button onClick={async () => {
                  if (!hwForm.title) { notify('Введите название'); return; }
                  let targetIds: string[] = [];
                  if (hwForm.group_id) {
                    targetIds = students.filter(s => s.group_id === hwForm.group_id).map(s => s.id);
                  }
                  if (hwForm.student_ids.size > 0) {
                    targetIds = [...new Set([...targetIds, ...hwForm.student_ids])];
                  }
                  if (targetIds.length === 0) { notify('Выберите учеников или группу'); return; }

                  for (const sid of targetIds) {
                    await supabase.from('trainer_homework').insert({
                      trainer_id: userId, student_id: sid, title: hwForm.title,
                      description: hwForm.desc || null, puzzle_theme: hwForm.theme,
                      puzzle_count: hwForm.count, video_url: hwForm.video || null,
                      group_id: hwForm.group_id || null,
                    });
                  }
                  notify(`Задание отправлено ${targetIds.length} ученикам!`);
                  setHwForm({ title: '', theme: 'mateIn1', count: 5, video: '', student_ids: new Set(), group_id: '', desc: '' });
                  setShowHwStudents(false); reload();
                }} className="w-full py-2.5 rounded-xl text-sm font-semibold text-black"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} whileTap={{ scale: 0.97 }}>
                  📝 Отправить задание
                </motion.button>
              </div>

              {/* Список заданий */}
              <div className="glass rounded-xl p-3">
                <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">{t('sent_label')} ({homework.length})</div>
                {homework.slice(0, 20).map(h => {
                  const st = students.find(s => s.id === h.student_id);
                  return (
                    <div key={h.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-xs border-b border-white/5">
                      <span className={`w-2 h-2 rounded-full ${h.completed ? 'bg-green-400' : 'bg-yellow-400'}`} />
                      <span className="text-white/60 flex-1 truncate">{h.title}</span>
                      <span className="text-white/30">{st?.full_name}</span>
                      <span className="text-purple-400">{THEMES[h.puzzle_theme]}</span>
                      <span className="text-white/20">{h.puzzle_count} зад.</span>
                      {h.completed && <span className="text-green-400">{h.result_percent}%</span>}
                      <button onClick={async () => { await supabase.from('trainer_homework').delete().eq('id', h.id); reload(); }} className="text-red-400/30 hover:text-red-400">✕</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ СТАТИСТИКА ═══ */}
          {tab === 'stats' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  [students.length, 'Учеников', 'text-yellow-400'],
                  [groups.length, 'Групп', 'text-green-400'],
                  [students.length > 0 ? Math.round(students.reduce((a, s) => a + s.rating, 0) / students.length) : 0, 'Средний рейтинг', 'text-purple-400'],
                  [`${homework.filter(h => h.completed).length}/${homework.length}`, 'Домашки', 'text-blue-400'],
                ].map(([val, label, color], i) => (
                  <div key={i} className="glass p-4 rounded-xl text-center">
                    <div className={`text-2xl font-bold ${color}`} style={{ fontFamily: "'Playfair Display', serif" }}>{val}</div>
                    <div className="text-xs text-white/40">{label as string}</div>
                  </div>
                ))}
              </div>
              <div className="glass p-4 rounded-xl">
                <div className="text-sm font-bold mb-3">{t('student_rating')}</div>
                {students.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                    <span className="w-6 text-right font-bold" style={{ color: i < 3 ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}>{i < 3 ? ['🥇','🥈','🥉'][i] : i+1}</span>
                    <span className="flex-1 text-white/70">{s.full_name}</span>
                    <span className="font-bold text-yellow-400">{s.rating}</span>
                    <span style={{ color: getRank(s.rating).color }} className="text-xs">{getRank(s.rating).short}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
