'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { exchangeLichessToken, saveLichessToken } from '@/lib/lichess-auth';

function LichessCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState('Подключаем Lichess...');

  useEffect(() => {
    const handle = async () => {
      const code = searchParams.get('code');
      if (!code) { setStatus('Ошибка: нет кода авторизации'); return; }

      const redirectUri = `${window.location.origin}/auth/lichess`;
      const token = await exchangeLichessToken(code, redirectUri);
      if (!token) { setStatus('Ошибка: не удалось получить токен'); return; }

      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
      if (!user) { setStatus('Ошибка: не авторизован'); return; }

      const profile = await saveLichessToken(user.id, token);
      if (profile) {
        setStatus(`Lichess подключён! Аккаунт: ${profile.username}`);
        setTimeout(() => router.push('/profile'), 2000);
      } else {
        setStatus('Ошибка привязки аккаунта');
      }
    };
    handle();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass p-10 rounded-2xl text-center max-w-md">
        <div className="text-5xl mb-4">{'♞'}</div>
        <p className="text-white/70">{status}</p>
      </div>
    </div>
  );
}

export default function LichessCallbackPage() {
  return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-white/40">Загрузка...</div></div>}>
    <LichessCallbackInner />
  </Suspense>;
}
