'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCourseByTheme } from '@/lib/puzzles';

const DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const THEMES: Record<string, string> = { mateIn1: 'Мат в 1', mateIn2: 'Мат в 2', fork: 'Вилка', pin: 'Связка', skewer: 'Сквозной удар', sacrifice: 'Жертва', backRankMate: 'Мат по задней', discoveredAttack: 'Вскрытая атака', deflection: 'Отвлечение', hangingPiece: 'Висячая фигура', advantage: 'Преимущество', endgame: 'Эндшпиль', rookEndgame: 'Ладейный', pawnEndgame: 'Пешечный', queenEndgame: 'Ферзевой', kingsideAttack: 'Атака на короля', trappedPiece: 'Ловушка', opening: 'Дебют', short: 'Короткая', oneMove: 'Один ход', attackingF2F7: 'Атака f2/f7' };

export default function TrainerSection({ userId }: { userId: string }) {
  const router = useRouter();
  const [student, setStudent] = useState<any>(null);
  const [trainer, setTrainer] = useState<any>(null);
  const [trainerProfile, setTrainerProfile] = useState<any>(null);
  const [homework, setHomework] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [awards, setAwards] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: st } = await supabase.from('school_students').select('*').eq('profile_id', userId).maybeSingle();
      if (!st || !st.trainer_id) { setLoading(false); return; }
      setStudent(st);

      const { data: tr } = await supabase.from('school_trainers').select('*').eq('id', st.trainer_id).maybeSingle();
      if (tr) {
        setTrainer(tr);
        if (tr.profile_id) {
          const { data: tp } = await supabase.from('profiles').select('id, username, avatar_url').eq('id', tr.profile_id).maybeSingle();
          setTrainerProfile(tp);
          const [hwR, ntR, awR, glR, scR, atR] = await Promise.all([
            supabase.from('trainer_homework').select('*').eq('student_id', st.id).order('created_at', { ascending: false }),
            supabase.from('trainer_notes').select('*').eq('student_id', st.id).eq('is_private', false).order('created_at', { ascending: false }),
            supabase.from('trainer_awards').select('*').eq('student_id', st.id).order('created_at', { ascending: false }),
            supabase.from('trainer_goals').select('*').eq('student_id', st.id).eq('completed', false).order('created_at', { ascending: false }),
            supabase.from('trainer_schedule').select('*').eq('trainer_id', tr.profile_id).order('day_of_week'),
            supabase.from('trainer_attendance').select('*').eq('student_id', st.id).order('date', { ascending: false }).limit(30),
          ]);
          setHomework(hwR.data || []);
          setNotes(ntR.data || []);
          setAwards(awR.data || []);
          setGoals(glR.data || []);
          setSchedule(scR.data || []);
          setAttendance(atR.data || []);
        }
      }
      setLoading(false);
    };
    load();
  }, [userId]);

  if (loading || !student || !trainer) return null;

  const pendingHw = homework.filter(h => !h.completed);
  const completedHw = homework.filter(h => h.completed);
  const attPresent = attendance.filter(a => a.present).length;
  const attTotal = attendance.length;
  const attPct = attTotal > 0 ? Math.round((attPresent / attTotal) * 100) : -1;
  const hwDone = homework.filter(h => h.completed).length;
  const hwTotal = homework.length;

  return (
    <motion.div className="glass p-5 rounded-2xl mb-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>📚 От тренера</h2>
        {trainerProfile && (
          <button onClick={() => { window.location.href = `/friends?chat=${trainerProfile.id}`; }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10">
            💬 Написать тренеру
          </button>
        )}
      </div>

      {/* Тренер */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-white/5">
        <span className="text-2xl">👨‍🏫</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-white/80">{trainer.name}</div>
          <div className="text-xs text-white/30">Ваш тренер</div>
        </div>
      </div>

      {/* Быстрая статистика */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="p-2 rounded-lg bg-white/5 text-center">
          <div className="text-lg font-bold text-yellow-400">{student.rating}</div>
          <div className="text-[10px] text-white/30">Баллы</div>
        </div>
        <div className="p-2 rounded-lg bg-white/5 text-center">
          <div className="text-lg font-bold" style={{ color: attPct >= 80 ? '#4ade80' : attPct >= 50 ? '#fbbf24' : attPct >= 0 ? '#f87171' : '#6b7280' }}>
            {attPct >= 0 ? `${attPct}%` : '—'}
          </div>
          <div className="text-[10px] text-white/30">Посещаемость</div>
        </div>
        <div className="p-2 rounded-lg bg-white/5 text-center">
          <div className="text-lg font-bold text-blue-400">{hwDone}/{hwTotal}</div>
          <div className="text-[10px] text-white/30">Домашки</div>
        </div>
      </div>

      {/* Домашние задания */}
      {pendingHw.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">📝 Домашнее задание ({pendingHw.length})</div>
          {pendingHw.map(h => {
            const course = getCourseByTheme(h.puzzle_theme);
            return (
              <motion.div key={h.id} className="p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/10 mb-2"
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-sm font-semibold text-white/80">{h.title}</span>
                </div>
                {h.description && <p className="text-xs text-white/40 mb-2 ml-4">{h.description}</p>}
                <div className="flex items-center gap-3 ml-4 text-xs">
                  <span className="text-purple-400">{THEMES[h.puzzle_theme] || h.puzzle_theme}</span>
                  <span className="text-white/30">{h.puzzle_count} задач</span>
                  {h.video_url && <a href={h.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">🎬 Видео</a>}
                </div>
                <motion.button onClick={() => router.push(`/learn/${course?.id || 'mate-in-1'}`)}
                  className="mt-2 ml-4 px-4 py-1.5 rounded-lg text-xs font-semibold text-black"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  whileTap={{ scale: 0.95 }}>
                  ▶ Решать задачи
                </motion.button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Выполненные */}
      {completedHw.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-white/20 mb-1">Выполнено ({completedHw.length})</div>
          {completedHw.slice(0, 3).map(h => (
            <div key={h.id} className="flex items-center gap-2 text-xs px-3 py-1 text-white/30">
              <span className="text-green-400">✓</span>
              <span className="flex-1">{h.title}</span>
              {h.result_percent !== null && <span className="text-green-400">{h.result_percent}%</span>}
            </div>
          ))}
        </div>
      )}

      {/* Журнал посещаемости по дням */}
      {attendance.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">📅 Журнал посещаемости ({attPresent}/{attTotal})</div>
          <div className="flex flex-wrap gap-1">
            {attendance.slice(0, 30).map(a => {
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
      )}

      {/* Цели */}
      {goals.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">🎯 Цели</div>
          {goals.map(g => {
            const progress = g.target_rating ? Math.min(100, Math.round((student.rating / g.target_rating) * 100)) : 0;
            return (
              <div key={g.id} className="flex items-center gap-2 text-xs mb-2">
                <span className="text-white/60 flex-1">{g.title}</span>
                <div className="w-24 h-2 bg-white/10 rounded-full"><div className="h-full rounded-full bg-yellow-400" style={{ width: `${progress}%` }} /></div>
                <span className="text-white/30 w-8 text-right">{progress}%</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Награды */}
      {awards.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">🏆 Награды</div>
          <div className="flex flex-wrap gap-2">
            {awards.map(a => <span key={a.id} className="px-2 py-1 rounded-lg text-xs bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">{a.icon} {a.title}</span>)}
          </div>
        </div>
      )}

      {/* Комментарии */}
      {notes.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">💬 Комментарии тренера</div>
          {notes.slice(0, 5).map(n => (
            <div key={n.id} className="text-xs px-3 py-2 rounded-lg bg-white/5 text-white/60 mb-1">
              {n.text}
              <span className="text-white/15 ml-2">{new Date(n.created_at).toLocaleDateString('ru-RU')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Расписание */}
      {schedule.length > 0 && (
        <div>
          <div className="text-xs text-white/40 mb-2 uppercase tracking-wider">🕐 Расписание</div>
          <div className="flex flex-wrap gap-2">
            {schedule.map(s => (
              <div key={s.id} className="px-3 py-1.5 rounded-lg bg-blue-400/10 text-xs">
                <span className="text-blue-400 font-semibold">{DAYS[s.day_of_week]}</span>
                <span className="text-white/40 ml-1">{s.start_time}–{s.end_time || '?'}</span>
                {s.topic && <span className="text-white/20 ml-1">· {s.topic}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
