'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import NotificationSystem from './NotificationSystem';
import InstallPrompt from './InstallPrompt';
import ChessComSidebar from './ChessComSidebar';

export default function ClientProviders() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.startAutoRefresh();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);

      if (session?.user && typeof window !== 'undefined') {
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
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUserId(null);
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
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
    });

    const heartbeat = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUserId(session.user.id);
        }
      } catch {  }
    }, 5 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(heartbeat);
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
