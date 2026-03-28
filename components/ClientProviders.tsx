'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import NotificationSystem from './NotificationSystem';
import InstallPrompt from './InstallPrompt';

export default function ClientProviders() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // КРИТИЧЕСКИ ВАЖНО: включаем авто-обновление токена
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
    });

    return () => {
      subscription.unsubscribe();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  return (
    <>
      <NotificationSystem userId={userId} />
      <InstallPrompt />
    </>
  );
}
