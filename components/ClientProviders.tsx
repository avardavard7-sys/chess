'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import NotificationSystem from './NotificationSystem';
import InstallPrompt from './InstallPrompt';
import ChessComSidebar from './ChessComSidebar';

export default function ClientProviders() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Включаем авто-обновление токена — НИКОГДА не выключаем
    supabase.auth.startAutoRefresh();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);

      // Авто-восстановление Lichess токена из Supabase в localStorage
      // (для случая когда юзер залогинился на новом устройстве)
      if (session?.user && typeof window !== 'undefined') {
        const localToken = localStorage.getItem('net_token');
        if (!localToken) {
          // Нет токена локально — пробуем взять из profiles
          supabase.from('profiles')
            .select('lichess_token')
            .eq('id', session.user.id)
            .maybeSingle()
            .then(({ data }) => {
              if (data?.lichess_token) {
                localStorage.setItem('net_token', data.lichess_token);
                localStorage.removeItem('net_user'); // Чистим кеш чтобы загрузился свежий профиль
              }
            });
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserId(null);
        // НЕ чистим net_token/net_user при SIGNED_OUT
        // iOS Safari шлёт ложные SIGNED_OUT при background —
        // Lichess токен живёт год, пусть лежит в localStorage
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        // При входе восстанавливаем Lichess токен если есть в profiles
        if (typeof window !== 'undefined') {
          const localToken = localStorage.getItem('net_token');
          if (!localToken) {
            supabase.from('profiles')
              .select('lichess_token')
              .eq('id', session.user.id)
              .maybeSingle()
              .then(({ data }) => {
                if (data?.lichess_token) {
                  localStorage.setItem('net_token', data.lichess_token);
                  localStorage.removeItem('net_user');
                }
              });
          }
        }
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
      <ChessComSidebar />
    </>
  );
}
