'use client';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { getInviteByCode, acceptGameInvite } from '@/lib/friends';

function InviteContent({ code }: { code: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'joining' | 'error' | 'expired'>('loading');
  const [invite, setInvite] = useState<{ id: string; host_id: string; host: { username: string; avatar_url: string; elo_rating: number } } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setStatus('error');
        return;
      }
      setUserId(user.id);

      const inv = await getInviteByCode(code);
      if (!inv) {
        setStatus('expired');
        return;
      }
      if (inv.host_id === user.id) {
        router.push(`/game/medium?mode=friend&session=${inv.id}&color=white`);
        return;
      }
      setInvite(inv as typeof invite);
      setStatus('ready');
    };
    load();
  }, [code, router]);

  const handleAccept = async () => {
    if (!invite || !userId) return;
    setStatus('joining');
    await acceptGameInvite(invite.id, userId);

    const channel = supabase.channel(`invite:${invite.id}`);
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'ACCEPTED', payload: { guest_id: userId } });
          resolve();
        }
      });
    });
    setTimeout(() => channel.unsubscribe(), 1000);

    router.push(`/game/medium?mode=friend&session=${invite.id}&color=black`);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>♞</motion.div>
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div className="glass p-10 rounded-2xl text-center max-w-md w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-6xl mb-4">⏰</div>
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: '#f87171' }}>Приглашение истекло</h2>
          <p className="text-white/50 mb-6">Эта ссылка больше не действительна</p>
          <motion.button onClick={() => router.push('/')}
            className="px-6 py-3 rounded-xl font-semibold text-black"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            На главную
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <motion.div className="glass p-10 rounded-2xl text-center max-w-md w-full" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-6xl mb-4">👤</div>
          <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Войдите в аккаунт</h2>
          <p className="text-white/50 mb-6">Для принятия приглашения нужно войти</p>
          <motion.button
            onClick={() => import('@/lib/supabase').then((m) => m.signInWithGoogle())}
            className="w-full px-6 py-4 rounded-xl font-semibold text-black"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            Войти через Google
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div className="glass p-10 rounded-2xl text-center max-w-md w-full" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <div className="text-6xl mb-4">♞</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
          Приглашение в игру
        </h2>
        {invite?.host && (
          <div className="flex items-center justify-center gap-3 mb-6 mt-4">
            <div className="w-12 h-12 rounded-full overflow-hidden bg-yellow-500/20 flex items-center justify-center text-xl font-bold text-yellow-400 border-2 border-yellow-500/30">
              {invite.host.avatar_url ? (
                <img src={invite.host.avatar_url} alt={invite.host.username} className="w-full h-full object-cover" />
              ) : invite.host.username[0]?.toUpperCase()}
            </div>
            <div className="text-left">
              <div className="font-bold text-lg">{invite.host.username}</div>
              <div className="text-xs text-yellow-400">ELO {invite.host.elo_rating}</div>
            </div>
          </div>
        )}
        <p className="text-white/50 mb-6">приглашает вас на шахматную партию</p>
        <motion.button
          onClick={handleAccept}
          disabled={status === 'joining'}
          className="w-full py-4 rounded-xl font-bold text-lg text-black"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #7c3aed)' }}
          whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
        >
          {status === 'joining' ? 'Подключаемся...' : 'Принять приглашение'}
        </motion.button>
        <motion.button
          onClick={() => router.push('/')}
          className="w-full mt-3 py-3 rounded-xl border border-white/15 text-white/50 hover:text-white/80 transition-colors text-sm"
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        >
          Отклонить
        </motion.button>
      </motion.div>
    </div>
  );
}

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setCode(p.code));
  }, [params]);

  if (!code) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-5xl animate-spin">♞</div>
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-5xl animate-spin">♞</div></div>}>
      <InviteContent code={code} />
    </Suspense>
  );
}
