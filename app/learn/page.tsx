'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { useTranslation } from '@/lib/i18n';
import { ALL_COURSES } from '@/lib/puzzles';
import { supabase } from '@/lib/supabase';

type Tab = 'tactics' | 'openings' | 'endgame' | 'beginner';
const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'tactics', label: 'Тактика', icon: '⚔️' },
  { id: 'openings', label: 'Дебюты', icon: '📖' },
  { id: 'endgame', label: 'Эндшпиль', icon: '♔' },
  { id: 'beginner', label: 'Для начинающих', icon: '🌱' },
];
const diffColors: Record<string, { bg: string; text: string; label: string }> = {
  easy: { bg: 'rgba(74,222,128,0.15)', text: '#4ade80', label: 'Лёгкий' },
  medium: { bg: 'rgba(251,191,36,0.15)', text: '#fbbf24', label: 'Средний' },
  hard: { bg: 'rgba(248,113,113,0.15)', text: '#f87171', label: 'Сложный' },
};

export default function LearnPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('tactics');
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => { const user = session?.user;
      if (!user) return;
      const { data } = await supabase.from('learn_progress').select('course_id, solved_count').eq('user_id', user.id);
      if (data) {
        const map: Record<string, number> = {};
        data.forEach((r: { course_id: string; solved_count: number }) => { map[r.course_id] = r.solved_count; });
        setProgress(map);
      }
    });
  }, []);

  const filtered = ALL_COURSES.filter(c => c.category === tab);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
              Обучение
            </h1>
            <p className="text-white/50">{t('train_tactics')}</p>
            <p className="text-white/30 text-xs mt-1">1000 задач в каждом разделе</p>
          </motion.div>

          <div className="flex gap-1 mb-8 p-1 rounded-xl max-w-2xl mx-auto" style={{ background: 'rgba(255,255,255,0.04)' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-1 py-3 px-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 ${tab === t.id ? 'bg-yellow-500/20 text-yellow-400 shadow-lg' : 'text-white/40 hover:text-white/60'}`}>
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          <motion.div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" key={tab}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {filtered.map((course, i) => {
              const solved = progress[course.id] || 0;
              const total = course.puzzleCount;
              const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
              const diff = diffColors[course.difficulty];
              return (
                <motion.button key={course.id} onClick={() => router.push(`/learn/${course.id}`)}
                  className="glass p-5 rounded-xl text-left hover:border-yellow-400/30 transition-all group"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  whileHover={{ scale: 1.02, y: -3 }}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">{course.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white group-hover:text-yellow-400 transition-colors truncate">{course.title}</h3>
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{course.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: diff.bg, color: diff.text }}>{diff.label}</span>
                    <span className="text-xs text-white/30">{solved > 0 ? `${solved}/${total}` : `${total} задач`}</span>
                  </div>
                  {solved > 0 && (
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full"
                        style={{ background: pct === 100 ? '#4ade80' : 'linear-gradient(90deg, #f59e0b, #7c3aed)' }}
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: i * 0.04 }} />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
