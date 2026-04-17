'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, signInWithGoogle } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Image from 'next/image';
import Link from 'next/link';
import PlayerSidebar from './PlayerSidebar';
import NicknameModal from './NicknameModal';
import { getUnreadCount } from '@/lib/friends';
import { useTranslation } from '@/lib/i18n';
import LanguageSwitcher from './LanguageSwitcher';
import { useUITheme } from '@/lib/uiTheme';

interface Profile {
  username: string;
  avatar_url: string;
  elo_rating: number;
  rank: string;
  is_admin?: boolean;
  is_trainer?: boolean;
  real_elo?: number;
}

export default function Header() {
  const { t } = useTranslation();
  const { setUITheme } = useUITheme();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNickname, setShowNickname] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Polling уведомлений каждые 15 сек
    let currentUid: string | null = null;
    let mounted = true;

    // Сразу подгружаем кешированный профиль из sessionStorage
    try {
      const cached = sessionStorage.getItem('cached_profile');
      if (cached) {
        const p = JSON.parse(cached);
        setProfile(p);
        if (p?.id) {
          setUser({ id: p.id } as any);
          setLoading(false);
        }
      }
    } catch {}

    // Загрузка сессии с retry — 3 попытки с интервалом 800мс
    const loadSession = async (attempt = 0) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) {
          currentUid = session.user.id;
          setUser(session.user);
          loadProfile(session.user.id);
          getUnreadCount(session.user.id).then(setUnreadCount).catch(() => {});
        } else if (attempt < 3) {
          // Сессия не найдена — пробуем ещё раз через 800мс
          setTimeout(() => loadSession(attempt + 1), 800);
          return;
        }
      } catch { /* ignore */ }
      if (mounted) setLoading(false);
    };

    loadSession();

    const unreadPoll = setInterval(() => {
      if (currentUid) getUnreadCount(currentUid).then(setUnreadCount).catch(() => {});
    }, 15000);

    // Слушаем изменения auth — игнорируем INITIAL_SESSION/TOKEN_REFRESHED/USER_UPDATED
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        // Защита от ложных SIGNED_OUT — проверяем сессию ещё раз через 1.5 сек
        // (iOS Safari иногда шлёт SIGNED_OUT при background, хотя сессия валидна)
        setTimeout(async () => {
          if (!mounted) return;
          const { data: { session: recheck } } = await supabase.auth.getSession();
          if (!recheck?.user) {
            // Реальный logout
            setUser(null);
            setProfile(null);
            setUnreadCount(0);
            currentUid = null;
            try { sessionStorage.removeItem('cached_profile'); } catch {}
          }
          // Если сессия восстановилась — игнорируем ложный SIGNED_OUT
        }, 1500);
      } else if (event === 'SIGNED_IN' && session?.user) {
        currentUid = session.user.id;
        setUser(session.user);
        loadProfile(session.user.id);
        getUnreadCount(session.user.id).then(setUnreadCount).catch(() => {});
      }
      // INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED — НЕ перезагружаем профиль
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(unreadPoll);
    };
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url, elo_rating, rank, is_admin, is_trainer, real_elo')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        const profileWithId = { ...data, id: userId };
        setProfile(profileWithId);
        try { sessionStorage.setItem('cached_profile', JSON.stringify(profileWithId)); } catch {}
        if (!data.username || data.username.includes('@') || data.username.length < 2) {
          setShowNickname(true);
        }
      }
    } catch {}
    setLoading(false);
  };

  const handleNicknameComplete = (nickname: string) => {
    setProfile((p) => p ? { ...p, username: nickname } : null);
    setShowNickname(false);
  };

  return (
    <>
      <motion.header
        className="fixed top-0 left-0 right-0 z-40 px-3 py-2"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div
          className="max-w-7xl mx-auto flex items-center justify-between rounded-2xl px-4 py-2.5"
          style={{
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(245, 158, 11, 0.2)',
            boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
          }}
        >
          {/* Left: Burger + Logo */}
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => setSidebarOpen(true)}
              className="relative flex flex-col gap-1 p-2 rounded-xl hover:bg-white/8 transition-colors"
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            >
              <span className="w-5 h-0.5 bg-white/60 rounded-full block" />
              <span className="w-5 h-0.5 bg-white/60 rounded-full block" />
              <span className="w-5 h-0.5 bg-white/60 rounded-full block" />
              {unreadCount > 0 && (
                <motion.div
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500 }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.div>
              )}
            </motion.button>

            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl select-none" style={{ filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.7))' }}>♞</span>
              <div className="hidden sm:block">
                <div className="text-base font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>{t('app_name')}</div>
                <div className="text-xs text-white/35 leading-tight">{t('app_subtitle')}</div>
              </div>
            </Link>
          </div>

          {/* Right */}
          <div className="flex items-center gap-2">
            {/* Profile or Login — only show after loading */}
            {!loading && (
              user && profile ? (
                <motion.button
                  onClick={() => setSidebarOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 hover:border-yellow-400/30 hover:bg-white/5 transition-all"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                >
                  <div className="w-7 h-7 rounded-full overflow-hidden border border-yellow-500/40 flex-shrink-0">
                    {profile.avatar_url ? (
                      <Image src={profile.avatar_url} alt={profile.username} width={28} height={28} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 text-xs font-bold">
                        {profile.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-white/90 leading-tight">{profile.username}</div>
                    <div className="text-xs text-yellow-400 font-bold leading-tight">ELO {profile.real_elo || profile.elo_rating}</div>
                  </div>
                </motion.button>
              ) : !user ? (
                <motion.button
                  onClick={signInWithGoogle}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl font-semibold text-sm border border-white/15 text-white/80 hover:bg-white/8 transition-all"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="hidden sm:inline">{t('sign_in')}</span>
                </motion.button>
              ) : null
            )}

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* UI Theme Switch */}
            <button
              onClick={() => setUITheme('chesscom')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium border border-white/10 hover:border-green-500/30 text-white/40 hover:text-green-400 transition-all"
              title="CC"
            >
              <span className="text-sm">🎨</span>
              <span className="hidden sm:inline">CC</span>
            </button>

            {/* WhatsApp */}
            <motion.a
              href={process.env.NEXT_PUBLIC_WHATSAPP_URL || 'https://wa.me/+77751405299'}
              target="_blank" rel="noopener noreferrer"
              className="pulse-gold flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs sm:text-sm text-black whitespace-nowrap flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
            >
              <span>📱</span>
              <span className="hidden md:inline">{t('free_lesson')}</span>
              <span className="md:hidden">{t('lesson_btn')}</span>
            </motion.a>
          </div>
        </div>
      </motion.header>

      <PlayerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <AnimatePresence>
        {showNickname && user && (
          <NicknameModal userId={user.id} onComplete={handleNicknameComplete} />
        )}
      </AnimatePresence>
    </>
  );
}
