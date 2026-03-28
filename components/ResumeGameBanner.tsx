'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function ResumeGameBanner() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeGame, setActiveGame] = useState<any>(null);
  const dismissedIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (pathname?.startsWith('/game/')) {
      setActiveGame(null);
      return;
    }

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const uid = session.user.id;
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

      // Автозакрытие партий старше 2 часов
      await supabase.from('live_games')
        .update({ status: 'finished', finished_at: new Date().toISOString() })
        .eq('status', 'active')
        .lt('started_at', twoHoursAgo);

      // Ищем активную партию
      const { data } = await supabase
        .from('live_games')
        .select('id, mode, white_name, black_name, fen, moves_json, started_at')
        .eq('status', 'active')
        .or(`white_id.eq.${uid},black_id.eq.${uid}`)
        .order('started_at', { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        // Показываем если это НЕ та партия которую уже закрыли
        if (dismissedIdRef.current !== data[0].id) {
          setActiveGame(data[0]);
        }
      } else {
        setActiveGame(null);
      }
    };

    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [pathname]);

  // Продолжить — переходим в игру с resume ID
  const handleContinue = () => {
    if (!activeGame) return;
    const mode = activeGame.mode || 'ai';
    router.push(`/game/${mode}?resume=${activeGame.id}`);
    setActiveGame(null);
  };

  // Сдаться — закрываем как проигрыш
  const handleResign = async () => {
    if (!activeGame) return;
    dismissedIdRef.current = activeGame.id;
    await supabase.from('live_games').update({
      status: 'finished', result: 'loss', finished_at: new Date().toISOString(),
    }).eq('id', activeGame.id);
    setActiveGame(null);
  };

  if (!activeGame || pathname?.startsWith('/game/')) return null;

  const modeLabels: Record<string, string> = {
    ai: 'Игра с ботом', local: 'Игра вдвоём',
    online: 'Онлайн игра', friend: 'Игра с другом',
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed top-16 left-0 right-0 z-40 px-4 py-2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <div className="max-w-xl mx-auto flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.5)', backdropFilter: 'blur(16px)' }}>
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
          <span className="text-sm text-white/80 flex-1">
            {modeLabels[activeGame.mode] || 'Партия'} не завершена
          </span>
          <motion.button onClick={handleContinue}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-black flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            Продолжить
          </motion.button>
          <motion.button onClick={handleResign}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 border border-red-400/40 text-red-400"
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            Сдаться
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
