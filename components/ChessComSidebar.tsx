'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/lib/i18n';
import { useUITheme } from '@/lib/uiTheme';

const NAV_ITEMS = [
  { href: '/', icon: '♟', label: 'menu_play' },
  { href: '/learn', icon: '📕', label: 'menu_learn' },
  { href: '/train', icon: '🎯', label: 'menu_train' },
  { href: '/analysis', icon: '🔬', label: 'menu_analysis' },
  { href: '/watch', icon: '👁', label: 'menu_watch' },
  { href: '/tournaments', icon: '🏆', label: 'menu_tournaments' },
  { href: '/friends', icon: '👥', label: 'menu_friends' },
  { href: '/shop', icon: '🛍', label: 'menu_shop' },
];

const MORE_ITEMS = [
  { href: '/chess960', icon: '🔀', label: 'menu_variants' },
  { href: '/leaderboard', icon: '🏅', label: 'menu_leaderboard' },
  { href: '/rating', icon: '📊', label: 'sidebar_internal_rating' },
  { href: '/daily', icon: '📬', label: 'sidebar_correspondence' },
  { href: '/profile', icon: '👤', label: 'profile_title' },
  { href: '/trainer', icon: '👨‍🏫', label: 'sidebar_trainer_cabinet' },
  { href: '/admin', icon: '🛡️', label: 'sidebar_admin' },
];

export default function ChessComSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation();
  const { uiTheme, setUITheme } = useUITheme();
  const [profile, setProfile] = useState<any>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
          .then(({ data }) => setProfile(data));
      }
    });
  }, []);

  // Apply body padding when in chesscom mode
  useEffect(() => {
    if (uiTheme === 'chesscom') {
      document.body.classList.add('cc-mode');
    } else {
      document.body.classList.remove('cc-mode');
    }
    return () => document.body.classList.remove('cc-mode');
  }, [uiTheme]);

  if (uiTheme !== 'chesscom') return null;
  // Don't show on home page (ChessComHome has its own layout)
  if (pathname === '/') return null;

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <>
      {/* Mobile top bar */}
      <div className="cc-mobile-bar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 50,
        background: '#1a1815', borderBottom: '1px solid #3d3a36',
        display: 'none', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 12px', zIndex: 100,
      }}>
        <button onClick={() => setMobileOpen(!mobileOpen)}
          style={{ background: 'transparent', border: 'none', color: '#86b817', fontSize: 24, cursor: 'pointer' }}>
          ☰
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">♞</span>
          <span className="font-bold text-sm" style={{ color: '#86b817' }}>{t('app_name')}</span>
        </div>
        <button onClick={() => setUITheme('hodkonem')}
          style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b30', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}>
          ✨
        </button>
      </div>

      {/* Sidebar */}
      <nav className="cc-sidebar" style={{
        position: 'fixed', top: 0, left: 0, width: 180, height: '100vh',
        background: '#1a1815', borderRight: '1px solid #3d3a36',
        display: 'flex', flexDirection: 'column', overflowY: 'auto',
        zIndex: 99, fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}>
        <Link href="/" className="flex items-center gap-2 px-4 py-4 border-b border-white/5" style={{ textDecoration: 'none' }}>
          <span className="text-2xl">♞</span>
          <span className="font-bold text-sm" style={{ color: '#86b817' }}>{t('app_name')}</span>
        </Link>

        <div className="flex-1 py-2">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-all"
              style={{
                color: isActive(item.href) ? '#fff' : '#9e9b93',
                background: isActive(item.href) ? '#2f2c28' : 'transparent',
                textDecoration: 'none',
                borderLeft: isActive(item.href) ? '3px solid #86b817' : '3px solid transparent',
              }}
              onMouseEnter={(e) => { if (!isActive(item.href)) e.currentTarget.style.background = '#2a2723'; }}
              onMouseLeave={(e) => { if (!isActive(item.href)) e.currentTarget.style.background = 'transparent'; }}
            >
              <span className="text-lg w-6 text-center">{item.icon}</span>
              <span>{t(item.label as any)}</span>
            </Link>
          ))}

          <button onClick={() => setMoreOpen(!moreOpen)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left"
            style={{ color: '#9e9b93', background: 'transparent', border: 'none', borderLeft: '3px solid transparent', cursor: 'pointer' }}>
            <span className="text-lg w-6 text-center">•••</span>
            <span>{moreOpen ? '▾' : '▸'} {t('next')}</span>
          </button>

          {moreOpen && (
            <div style={{ background: '#1e1c18' }}>
              {MORE_ITEMS.map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 px-6 py-2 text-xs transition-all"
                  style={{
                    color: isActive(item.href) ? '#86b817' : '#7a7770',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => { if (!isActive(item.href)) e.currentTarget.style.color = '#c4c1b9'; }}
                  onMouseLeave={(e) => { if (!isActive(item.href)) e.currentTarget.style.color = '#7a7770'; }}
                >
                  <span>{item.icon}</span>
                  <span>{t(item.label as any)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <button onClick={() => setUITheme('hodkonem')}
          className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b30', cursor: 'pointer' }}>
          ✨ {t('app_name')}
        </button>

        <Link href="/profile" className="flex items-center gap-2 px-4 py-3 border-t border-white/5"
          style={{ textDecoration: 'none', color: '#9e9b93' }}>
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold"
            style={{ color: '#86b817' }}>
            {profile?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white/80 truncate">{profile?.username || t('player')}</div>
            <div className="text-[10px]" style={{ color: '#86b817' }}>ELO {profile?.elo_rating || 1200}</div>
          </div>
        </Link>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 199,
        }}>
          <nav onClick={(e) => e.stopPropagation()} style={{
            position: 'fixed', top: 0, left: 0, width: 260, height: '100vh',
            maxHeight: '100vh',
            background: '#1a1815',
            overflowY: 'scroll',
            WebkitOverflowScrolling: 'touch',
            display: 'flex', flexDirection: 'column',
          }}>
            <div className="flex items-center gap-2 px-4 py-4 border-b border-white/5 flex-shrink-0">
              <span className="text-2xl">♞</span>
              <span className="font-bold text-sm" style={{ color: '#86b817' }}>{t('app_name')}</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {NAV_ITEMS.concat(MORE_ITEMS).map(item => (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm"
                  style={{ color: '#9e9b93', textDecoration: 'none', borderBottom: '1px solid #2a2723' }}>
                  <span className="text-lg w-6 text-center">{item.icon}</span>
                  <span>{t(item.label as any)}</span>
                </Link>
              ))}
              <button onClick={() => { setUITheme('hodkonem'); setMobileOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm border-t border-white/5"
                style={{ background: 'transparent', color: '#f59e0b', border: 'none', borderTop: '1px solid #2a2723', textAlign: 'left', cursor: 'pointer' }}>
                <span className="text-lg w-6 text-center">✨</span>
                <span>{t('app_name')} стиль</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Global styles */}
      <style jsx global>{`
        body.cc-mode {
          background: #262421 !important;
          color: #e0ddd5 !important;
        }
        body.cc-mode .chess-bg {
          display: none !important;
        }
        body.cc-mode > div.relative {
          padding-left: 180px;
          min-height: 100vh;
        }
        body.cc-mode header {
          display: none !important;
        }
        @media (max-width: 900px) {
          .cc-sidebar { display: none !important; }
          .cc-mobile-bar { display: flex !important; }
          body.cc-mode > div.relative {
            padding-left: 0 !important;
            padding-top: 50px !important;
          }
        }
      `}</style>
    </>
  );
}
