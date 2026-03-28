'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import SplashScreen from '@/components/SplashScreen';
import MainMenu from '@/components/MainMenu';
import GameModeSelector from '@/components/GameModeSelector';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import type { Difficulty } from '@/store/gameStore';

type Screen = 'splash' | 'menu' | 'modeSelect';

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('splash_shown')) {
      return 'menu';
    }
    return 'splash';
  });
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('medium');

  useEffect(() => {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const user = session.user;
        const username = user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Игрок';
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || '';
        const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).single();
        if (!existing) {
          await supabase.from('profiles').insert({
            id: user.id, username, avatar_url: avatarUrl,
            elo_rating: 0, rank: '👶 Малыш',
            games_played: 0, games_won: 0, games_lost: 0, games_draw: 0,
          });
        }
      }
    });
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem('splash_shown', '1');
    setScreen('menu');
  };

  if (screen === 'splash') {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
      <Header />
      <AnimatePresence mode="wait">
        {screen === 'menu' && (
          <motion.div key="menu" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.35 }}>
            <MainMenu onSelectDifficulty={(d) => { setSelectedDifficulty(d); setScreen('modeSelect'); }} />
          </motion.div>
        )}
        {screen === 'modeSelect' && (
          <motion.div key="modeSelect" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} transition={{ duration: 0.35 }}>
            <GameModeSelector difficulty={selectedDifficulty} onBack={() => setScreen('menu')} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
