'use client';
import { useTranslation } from '@/lib/i18n';

import { Suspense } from 'react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { exchangeCode, saveToken, getNetworkUser } from '@/lib/lichess';

function NetworkAuthContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      return;
    }

    exchangeCode(code)
      .then(async (token) => {
        saveToken(token);
        const user = await getNetworkUser(token);
        localStorage.setItem('net_user', JSON.stringify(user));
        sessionStorage.removeItem('net_return');
        router.push('/online');
      })
      .catch(() => {
        setStatus('error');
      });
  }, [searchParams, router]);

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-8 rounded-2xl text-center max-w-sm">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-white/60 mb-4">{t('auth_error')}</p>
          <button onClick={() => router.push('/online')}
            className="px-6 py-2 rounded-xl bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors">
            Попробовать снова
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <motion.div
          className="text-6xl mb-6 block"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        >
          ♞
        </motion.div>
        <p className="text-white/60">{t('connecting_network')}</p>
      </div>
    </div>
  );
}

export default function NetworkAuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-6xl animate-spin">♞</div>
      </div>
    }>
      <NetworkAuthContent />
    </Suspense>
  );
}
