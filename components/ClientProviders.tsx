'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import NotificationSystem from './NotificationSystem';
import InstallPrompt from './InstallPrompt';

export default function ClientProviders() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Включаем авто-обновление токена — НИКОГДА не выключаем
    supabase.auth.startAutoRefresh();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserId(null);
      } else if (session?.user) {
        setUserId(session.user.id);
      }
      // INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED — не сбрасываем!
    });

    // Heartbeat — каждые 5 минут проверяем сессию и обновляем если нужно
    const heartbeat = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserId(session.user.id);
        }
      } catch { /* ignore */ }
    }, 5 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(heartbeat);
      // НЕ вызываем stopAutoRefresh — пусть работает всегда
    };
  }, []);

  return (
    <>
      <NotificationSystem userId={userId} />
      <InstallPrompt />
    </>
  );
}
