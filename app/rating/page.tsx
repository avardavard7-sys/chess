'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const RANKS = [
  { min: 0, name: 'Без разряда', short: 'Без', color: '#6b7280' },
  { min: 700, name: '5 разряд', short: '5р', color: '#CD7F32' },
  { min: 800, name: '4 разряд', short: '4р', color: '#3b82f6' },
  { min: 1000, name: '3 разряд', short: '3р', color: '#8b5cf6' },
  { min: 1200, name: '2 разряд', short: '2р', color: '#f59e0b' },
  { min: 1400, name: '1 разряд', short: '1р', color: '#ef4444' },
];
const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function getRank(rating: number) {
  let r = RANKS[0];
  for (let i = RANKS.length - 1; i >= 0; i--) if (rating >= RANKS[i].min) { r = RANKS[i]; break; }
  return r;
}
function getNextRank(rating: number) {
  for (const r of RANKS) if (rating < r.min) return r;
  return null;
}
function getProgress(rating: number) {
  const curr = getRank(rating); const next = getNextRank(rating);
  if (!next) return 100;
  return Math.min(100, Math.round(((rating - curr.min) / (next.min - curr.min)) * 100));
}

export default function RatingPage() {
  const { t } = useTranslation();
  const [students, setStudents] = useState<any[]>([]);
  const [trainers, setTrainers] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [awards, setAwards] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('is_admin, is_trainer').eq('id', session.user.id).maybeSingle();
        if (data && (data.is_admin || data.is_trainer)) setCanEdit(true);
      }
    });
  }, []);

  useEffect(() => {
    const load = async () => {
      const [sR, tR, atR, ntR, hwR, awR, scR] = await Promise.all([
        supabase.from('school_students').select('*').order('full_name', { ascending: true }),
        supabase.from('school_trainers').select('*'),
        supabase.from('trainer_attendance').select('*').order('date', { ascending: false }).limit(2000),
        supabase.from('trainer_notes').select('*').eq('is_private', false).order('created_at', { ascending: false }),
        supabase.from('trainer_homework').select('*').order('created_at', { ascending: false }),
        supabase.from('trainer_awards').select('*').order('created_at', { ascending: false }),
        supabase.from('trainer_schedule').select('*').order('day_of_week'),
      ]);
      setStudents(sR.data || []);
      setTrainers(tR.data || []);
      setAttendance(atR.data || []);
      setNotes(ntR.data || []);
      setHomework(hwR.data || []);
      setAwards(awR.data || []);
      setSchedule(scR.data || []);
      setLoading(false);
    };
    load();
  }, []);

  const getTrainerName = (id: string) => trainers.find(t => t.id === id)?.name || '';
  const getTrainerSchedule = (trainerId: string) => {
    const trainer = trainers.find(t => t.id === trainerId);
    if (!trainer?.profile_id) return [];
    return schedule.filter(s => s.trainer_id === trainer.profile_id);
  };
  const getAttendancePercent = (sid: string) => {
    const records = attendance.filter(a => a.student_id === sid);
    if (records.length === 0) return -1;
    return Math.round((records.filter(r => r.present).length / records.length) * 100);
  };
  const getStudentNotes = (sid: string) => notes.filter(n => n.student_id === sid).slice(0, 5);
  const getStudentHomework = (sid: string) => homework.filter(h => h.student_id === sid).slice(0, 5);
  const getStudentAwards = (sid: string) => awards.filter(a => a.student_id === sid);

  const filtered = search.trim()
    ? students.filter(s => s.full_name.toLowerCase().includes(search.toLowerCase()))
    : students;

  const updateRating = async (delta: number) => {
    if (!selected || saving) return;
    setSaving(true);
    const newRating = Math.max(0, selected.rating + delta);
    const history = [...(selected.rating_history || []), { date: new Date().toLocaleDateString('ru-RU'), rating: newRating }];
    await supabase.from('school_students').update({ rating: newRating, rating_history: history }).eq('id', selected.id);
    const { data } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
    setStudents(data || []);
    const updated = data?.find(s => s.id === selected.id);
    if (updated) {
      setSelected(updated);
      setEditValue(String(updated.rating));
    }
    setSaving(false);
  };

  const setExactRating = async () => {
    if (!selected || saving) return;
    const val = parseInt(editValue);
    if (isNaN(val) || val < 0) return;
    setSaving(true);
    const history = [...(selected.rating_history || []), { date: new Date().toLocaleDateString('ru-RU'), rating: val }];
    await supabase.from('school_students').update({ rating: val, rating_history: history }).eq('id', selected.id);
    const { data } = await supabase.from('school_students').select('*').order('full_name', { ascending: true });
    setStudents(data || []);
    const updated = data?.find(s => s.id === selected.id);
    if (updated) setSelected(updated);
    setSaving(false);
  };

  const selectStudent = (s: any) => {
    setSelected(s);
    setEditValue(String(s.rating));
    // Прокручиваем наверх к карточке выбранного ученика
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const medals = ['🥇', '🥈', '🥉'];

  if (loading) return <div className="min-h-screen flex items-center justify-center"><motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>♞</motion.div></div>;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-3xl mx-auto">
          <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{t('rating_title')}</h1>
            <p className="text-white/40">{t('app_subtitle')} «{t('app_name')}»</p>
          </motion.div>

          <div className="glass p-3 rounded-xl mb-6">
            <input type="text" placeholder={t('search_student')} value={search}
              onChange={e => {
                setSearch(e.target.value);
                // Сбрасываем выбранного при новом поиске + скроллим наверх
                if (selected) setSelected(null);
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-sm" />
          </div>

          {/* Карточка ученика */}
          <AnimatePresence>
            {selected && (
              <motion.div className="glass p-6 rounded-2xl mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>{selected.full_name}</h2>
                    {selected.birth_year && <span className="text-xs text-white/30">{selected.birth_year} г.р.</span>}
                  </div>
                  <button onClick={() => setSelected(null)} className="text-white/30 hover:text-white/70 text-xl">✕</button>
                </div>

                {selected.trainer_id && (
                  <div className="text-sm text-white/50 mb-4">{t("admin_trainer_filter")}: <span className="text-yellow-400">{getTrainerName(selected.trainer_id)}</span></div>
                )}

                {/* Баллы + Разряд + Посещаемость */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="glass p-3 rounded-xl text-center">
                    <div className="text-xs text-white/40 mb-1">{t('points_label')}</div>
                    <div className="text-2xl font-bold text-yellow-400" style={{ fontFamily: "'Playfair Display', serif" }}>{selected.rating}</div>
                  </div>
                  <div className="glass p-3 rounded-xl text-center">
                    <div className="text-xs text-white/40 mb-1">{t('internal_rating')}</div>
                    <div className="text-xl font-bold" style={{ color: getRank(selected.rating).color }}>{getRank(selected.rating).short}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: getRank(selected.rating).color }}>{getRank(selected.rating).name}</div>
                  </div>
                  <div className="glass p-3 rounded-xl text-center">
                    <div className="text-xs text-white/40 mb-1">{t('attendance_label')}</div>
                    {(() => {
                      const pct = getAttendancePercent(selected.id);
                      return pct >= 0 ? (
                        <div className="text-2xl font-bold" style={{ color: pct >= 80 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171' }}>{pct}%</div>
                      ) : <div className="text-sm text-white/20">—</div>;
                    })()}
                  </div>
                </div>

                {/* Прогресс-бар */}
                {getNextRank(selected.rating) && (
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-white/30 mb-1">
                      <span>{getRank(selected.rating).name}</span>
                      <span>{getNextRank(selected.rating)?.name} ({getNextRank(selected.rating)?.min})</span>
                    </div>
                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: `linear-gradient(90deg, ${getRank(selected.rating).color}, ${getNextRank(selected.rating)?.color})` }}
                        initial={{ width: 0 }} animate={{ width: `${getProgress(selected.rating)}%` }} transition={{ duration: 0.8 }} />
                    </div>
                    <div className="text-xs text-white/20 text-center mt-1">{getProgress(selected.rating)}% до следующего разряда</div>
                  </div>
                )}

                {/* Управление баллами (только для админа/тренера) */}
                {canEdit && (
                  <div className="mb-4 p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/20">
                    <div className="text-xs text-yellow-400/70 mb-2 font-semibold">✏️ Изменить баллы</div>
                    <div className="flex gap-2 mb-2">
                      <input type="number" value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm" />
                      <button onClick={setExactRating} disabled={saving}
                        className="px-4 py-2 rounded-lg text-xs font-semibold bg-yellow-400 text-black hover:bg-yellow-300 disabled:opacity-50">
                        {saving ? '...' : '💾 Сохранить'}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[1, 5, 10, 25, 50, 100].map(v => (
                        <button key={`+${v}`} onClick={() => updateRating(v)} disabled={saving}
                          className="px-2 py-1 rounded text-[11px] bg-green-500/15 text-green-400 hover:bg-green-500/25 disabled:opacity-50">+{v}</button>
                      ))}
                      <span className="text-white/10 mx-1">|</span>
                      {[1, 5, 10, 25, 50].map(v => (
                        <button key={`-${v}`} onClick={() => updateRating(-v)} disabled={saving}
                          className="px-2 py-1 rounded text-[11px] bg-red-500/15 text-red-400 hover:bg-red-500/25 disabled:opacity-50">-{v}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Награды от тренера */}
                {getStudentAwards(selected.id).length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-white/40 mb-2">{t('trainer_rewards')}</div>
                    <div className="flex flex-wrap gap-2">
                      {getStudentAwards(selected.id).map((a: any) => (
                        <span key={a.id} className="px-2 py-1 rounded-lg text-xs bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">{a.icon} {a.title}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Достижения */}
                {selected.achievements && selected.achievements.length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-white/40 mb-2">{t('achievements_label')}</div>
                    <div className="flex flex-wrap gap-2">
                      {selected.achievements.map((a: string, i: number) => (
                        <span key={i} className="px-2 py-1 rounded-lg text-xs bg-purple-400/10 text-purple-400 border border-purple-400/20">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Домашние задания */}
                {getStudentHomework(selected.id).length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-white/40 mb-2">{t('homework_assignments')}</div>
                    <div className="space-y-1">
                      {getStudentHomework(selected.id).map((h: any) => (
                        <div key={h.id} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg bg-white/5">
                          <span className={`w-2 h-2 rounded-full ${h.completed ? 'bg-green-400' : 'bg-yellow-400'}`} />
                          <span className="text-white/60 flex-1">{h.title}</span>
                          {h.completed ? <span className="text-green-400">{h.result_percent}% ✓</span> : <span className="text-yellow-400">{t('in_progress')}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Комментарии тренера (публичные) */}
                {getStudentNotes(selected.id).length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-white/40 mb-2">{t('trainer_comments_label')}</div>
                    <div className="space-y-1">
                      {getStudentNotes(selected.id).map((n: any) => (
                        <div key={n.id} className="text-xs px-2 py-1.5 rounded-lg bg-white/5 text-white/50">
                          {n.text}
                          <span className="text-white/15 ml-2">{new Date(n.created_at).toLocaleDateString('ru-RU')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Расписание занятий */}
                {selected.trainer_id && getTrainerSchedule(selected.trainer_id).length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-white/40 mb-2">{t('schedule_label')}</div>
                    <div className="flex flex-wrap gap-2">
                      {getTrainerSchedule(selected.trainer_id).map((s: any) => (
                        <div key={s.id} className="px-2 py-1.5 rounded-lg bg-blue-400/10 text-xs">
                          <span className="text-blue-400 font-semibold">{DAYS[s.day_of_week]}</span>
                          <span className="text-white/40 ml-1">{s.start_time}–{s.end_time || '?'}</span>
                          {s.topic && <span className="text-white/20 ml-1">· {s.topic}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* График */}
                {/* Журнал посещаемости */}
                {(() => {
                  const records = attendance.filter(a => a.student_id === selected.id);
                  if (records.length === 0) return null;
                  const present = records.filter(r => r.present).length;
                  return (
                    <div className="mb-4">
                      <div className="text-xs text-white/40 mb-2">{t('attendance_journal')} ({present}/{records.length})</div>
                      <div className="flex flex-wrap gap-1">
                        {records.slice(0, 30).map((a: any) => {
                          const d = new Date(a.date);
                          const dayStr = `${d.getDate()}.${d.getMonth() + 1}`;
                          return (
                            <div key={a.id} title={`${dayStr} — ${a.present ? 'Был' : 'Не был'}`}
                              className={`w-8 h-8 rounded-lg flex flex-col items-center justify-center text-[8px] leading-tight ${a.present ? 'bg-green-500/15 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                              <span>{dayStr}</span>
                              <span className="text-[10px]">{a.present ? '✓' : '✕'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* График рейтинга */}
                {selected.rating_history && selected.rating_history.length >= 2 && (
                  <div>
                    <div className="text-xs text-white/40 mb-2">{t('rating_chart')}</div>
                    <div style={{ height: 100 }}>
                      <svg viewBox="0 0 400 100" className="w-full h-full">
                        {(() => {
                          const hist = selected.rating_history;
                          const ratings = hist.map((h: any) => h.rating);
                          const minR = Math.min(...ratings) - 20; const maxR = Math.max(...ratings) + 20;
                          const range = maxR - minR || 1;
                          const points = ratings.map((r: number, i: number) => {
                            const x = (i / (ratings.length - 1)) * 380 + 10;
                            const y = 90 - ((r - minR) / range) * 80;
                            return `${x},${y}`;
                          });
                          const color = getRank(ratings[ratings.length - 1]).color;
                          return (
                            <>
                              <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
                              <polygon points={`10,90 ${points.join(' ')} 390,90`} fill="url(#rg)" />
                              <polyline points={points.join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                              <circle cx={390} cy={90 - ((ratings[ratings.length-1] - minR) / range) * 80} r="3" fill={color} />
                            </>
                          );
                        })()}
                      </svg>
                    </div>
                  </div>
                )}

                {selected.graduated && (
                  <div className="mt-4 p-3 rounded-xl bg-green-500/10 text-center text-sm text-green-400 font-semibold">✅ Переведён на официальный рейтинг</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Таблица */}
          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <span className="text-xs text-white/40 uppercase tracking-wider">{t('all_students')} ({filtered.length})</span>
            </div>
            {filtered.length === 0 ? (
              <div className="p-10 text-center text-white/30">{search ? 'Ученик не найден' : 'Пока нет учеников'}</div>
            ) : (
              <div>
                {filtered.map((s, i) => {
                  const rank = getRank(s.rating);
                  const attPct = getAttendancePercent(s.id);
                  return (
                    <motion.button key={s.id} onClick={() => selectStudent(s)}
                      className="w-full flex items-center gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/5 text-left transition-all"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      <span className="w-7 text-center text-sm font-bold" style={{ color: i < 3 ? '#f59e0b' : 'rgba(255,255,255,0.3)' }}>
                        {i < 3 ? medals[i] : i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-white/80 truncate block">{s.full_name}</span>
                        {s.trainer_id && <span className="text-[10px] text-white/30">{getTrainerName(s.trainer_id)}</span>}
                      </div>
                      {attPct >= 0 && <span className="text-[10px] text-white/20">{attPct}%</span>}
                      <span className="text-sm font-bold" style={{ color: rank.color }}>{s.rating}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${rank.color}15`, color: rank.color }}>{rank.short}</span>
                      <span className="text-white/20">→</span>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
