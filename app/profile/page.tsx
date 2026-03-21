'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import ProfileCard from '@/components/ProfileCard';
import { supabase, getProfile, getGameHistory, signOut } from '@/lib/supabase';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<null | {
    id: string;
    username: string;
    avatar_url: string;
    elo_rating: number;
    rank: string;
    games_played: number;
    games_won: number;
    games_lost: number;
    games_draw: number;
  }>(null);
  const [gameHistory, setGameHistory] = useState<Array<{
    id: string;
    result: string;
    elo_change: number;
    elo_before: number;
    elo_after: number;
    played_at: string;
    opponent: { username: string; avatar_url: string; elo_rating: number } | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setNotLoggedIn(true);
        setLoading(false);
        return;
      }
      let { data: prof } = await getProfile(user.id);
      if (!prof) {
        const meta = user.user_metadata || {};
        const username = meta.name || meta.full_name || user.email?.split('@')[0] || 'Player';
        const avatar_url = meta.avatar_url || meta.picture || '';
        await supabase.from('profiles').upsert({
          id: user.id,
          username,
          avatar_url,
          elo_rating: 1200,
          rank: '\u{1F331} \u041d\u043e\u0432\u0438\u0447\u043e\u043a',
          games_played: 0,
          games_won: 0,
          games_lost: 0,
          games_draw: 0,
        }, { onConflict: 'id' });
        const { data: newProf } = await getProfile(user.id);
        prof = newProf;
      }
      if (prof) setProfile(prof);
      const { data: history } = await getGameHistory(user.id, 10);
      if (history) setGameHistory(history as typeof gameHistory);
      setLoading(false);
    };
    load();
  }, []);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>♞</motion.div>
      </div>
    );
  }

  if (notLoggedIn) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="flex items-center justify-center min-h-screen pt-24 px-4">
          <motion.div className="glass p-10 rounded-2xl text-center max-w-md w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-6xl mb-5">👤</div>
            <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Профиль</h2>
            <p className="text-white/60 mb-8">Войдите для доступа к профилю</p>
            <motion.button
              onClick={() => import('@/lib/supabase').then((m) => m.signInWithGoogle())}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-black"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              Войти через Google
            </motion.button>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div className="flex items-center justify-between mb-8" initial={{ opacity: 0, y: -15 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Мой профиль</h1>
            <motion.button onClick={handleSignOut}
              className="px-4 py-2 rounded-xl text-sm border border-white/15 text-white/50 hover:text-white/80 hover:border-white/30 transition-all"
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              Выйти
            </motion.button>
          </motion.div>
          {profile && <ProfileCard profile={profile} gameHistory={gameHistory} />}
          {!profile && (
            <div className="glass p-8 rounded-2xl text-center">
              <p className="text-white/50">Профиль не найден. Попробуйте войти снова.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
