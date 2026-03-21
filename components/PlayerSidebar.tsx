'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { supabase, signInWithGoogle } from '@/lib/supabase';
import { getRankProgress, getNextRankThreshold } from '@/lib/elo';

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  elo_rating: number;
  rank: string;
  games_played: number;
  games_won: number;
  games_lost: number;
  games_draw: number;
}

interface PlayerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PlayerSidebar({ isOpen, onClose }: PlayerSidebarProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          setLoggedIn(true);
          const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
          if (mounted && data) setProfile(data);
        }
      } catch {}
      if (mounted) setLoading(false);
    };

    load();

    // Fallback — если что-то зависло, через 3 сек убираем загрузку
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (!mounted) return;
      if (session?.user) {
        setLoggedIn(true);
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (mounted && data) setProfile(data);
      } else {
        setLoggedIn(false);
        setProfile(null);
      }
      if (mounted) setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const winRate = profile && profile.games_played > 0
    ? Math.round((profile.games_won / profile.games_played) * 100) : 0;
  const rankProgress = profile ? getRankProgress(profile.elo_rating) : 0;
  const nextThreshold = profile ? getNextRankThreshold(profile.elo_rating) : 1200;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div className="fixed left-0 top-0 bottom-0 z-50 w-80 flex flex-col overflow-y-auto"
            style={{ background: 'rgba(10,15,30,0.98)', backdropFilter: 'blur(20px)', borderRight: '1px solid rgba(245,158,11,0.2)' }}
            initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}>

            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-2xl" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.6))' }}>♞</span>
                <span className="font-bold text-yellow-400" style={{ fontFamily: "'Playfair Display', serif" }}>Ход Конём</span>
              </div>
              <button onClick={onClose} className="text-white/30 hover:text-white/70 transition-colors text-xl">✕</button>
            </div>

            {loading ? (
              <div className="flex-1 flex items-center justify-center">
                <motion.div className="text-3xl" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>♞</motion.div>
              </div>
            ) : !loggedIn ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="text-5xl mb-4">👤</div>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Войдите в аккаунт</h3>
                <p className="text-white/40 text-sm mb-6">Для сохранения рейтинга и статистики</p>
                <motion.button onClick={signInWithGoogle}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-black"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                  Войти через Google
                </motion.button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col">
                <div className="p-5 border-b border-white/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-yellow-500/50 flex-shrink-0">
                      {profile?.avatar_url ? (
                        <Image src={profile.avatar_url} alt={profile.username} width={56} height={56} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-yellow-500/20 flex items-center justify-center text-2xl font-bold text-yellow-400">
                          {profile?.username?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-white text-lg leading-tight">{profile?.username || 'Игрок'}</div>
                      <div className="text-xs text-white/40">{profile?.rank}</div>
                      <div className="text-yellow-400 font-bold text-sm mt-0.5">ELO {profile?.elo_rating}</div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-white/35">
                      <span>До следующего ранга</span>
                      <span>{profile ? nextThreshold - profile.elo_rating : 0} ELO</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #f59e0b, #7c3aed)' }}
                        initial={{ width: 0 }} animate={{ width: `${rankProgress}%` }} transition={{ duration: 1 }} />
                    </div>
                  </div>
                </div>

                <div className="p-5 border-b border-white/10">
                  <div className="text-xs text-white/35 uppercase tracking-wider mb-3">Статистика</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Партий', value: profile?.games_played || 0, color: '#94a3b8', icon: '♟' },
                      { label: 'Побед', value: profile?.games_won || 0, color: '#4ade80', icon: '🏆' },
                      { label: 'Поражений', value: profile?.games_lost || 0, color: '#f87171', icon: '😔' },
                      { label: 'Ничьих', value: profile?.games_draw || 0, color: '#94a3b8', icon: '🤝' },
                    ].map((stat) => (
                      <div key={stat.label} className="p-3 rounded-xl text-center"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div className="text-lg mb-0.5">{stat.icon}</div>
                        <div className="text-xl font-bold" style={{ color: stat.color, fontFamily: "'Playfair Display', serif" }}>{stat.value}</div>
                        <div className="text-xs text-white/35">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  {(profile?.games_played || 0) > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-white/35 mb-1">
                        <span>Процент побед</span>
                        <span className="text-green-400 font-semibold">{winRate}%</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div className="h-full rounded-full bg-green-400"
                          initial={{ width: 0 }} animate={{ width: `${winRate}%` }} transition={{ duration: 1 }} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-1">
                  <Link href="/" onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 hover:text-white transition-all">
                    <span className="text-xl">🏠</span><span className="text-sm font-medium">Главная</span>
                  </Link>
                  <Link href="/profile" onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 hover:text-white transition-all">
                    <span className="text-xl">👤</span><span className="text-sm font-medium">Мой профиль</span>
                  </Link>
                  <Link href="/friends" onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 hover:text-white transition-all">
                    <span className="text-xl">👥</span><span className="text-sm font-medium">Друзья</span>
                  </Link>
                  <Link href="/online" onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/5 hover:text-white transition-all">
                    <span className="text-xl">🌐</span><span className="text-sm font-medium">Играть онлайн</span>
                  </Link>
                  <button onClick={() => { supabase.auth.signOut(); onClose(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-all">
                    <span className="text-xl">🚪</span><span className="text-sm font-medium">Выйти</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
