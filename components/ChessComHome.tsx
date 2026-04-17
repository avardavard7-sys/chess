'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useTranslation } from '@/lib/i18n';
import { useUITheme } from '@/lib/uiTheme';
import { useBoardTheme } from '@/lib/boardThemes';
import { getAIMove, parseStockfishMove, DIFFICULTY_CONFIG } from '@/lib/stockfish';
import { playChessSound } from '@/lib/sounds';

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

const PLAY_OPTIONS = [
  { id: 'online', icon: '⚡', label: 'mode_online', desc: 'mode_online_desc', href: '/online', gradient: 'linear-gradient(135deg, #86b817, #629612)' },
  { id: 'ai', icon: '🤖', label: 'mode_ai', desc: 'mode_ai_desc', href: '/game/medium', gradient: 'linear-gradient(135deg, #4f9bd8, #3a7bb8)' },
  { id: 'train', icon: '🧠', label: 'sidebar_ai_trainer', desc: 'train_realtime', href: '/train', gradient: 'linear-gradient(135deg, #e8833a, #c96b2a)' },
  { id: 'friend', icon: '🤝', label: 'mode_friend', desc: 'mode_friend_desc', href: '/friends?invite=true', gradient: 'linear-gradient(135deg, #d4a017, #b8891a)' },
  { id: 'local', icon: '👥', label: 'mode_local', desc: 'mode_local_desc', href: '/game/medium?mode=local', gradient: 'linear-gradient(135deg, #9b59b6, #8e44ad)' },
  { id: 'tournaments', icon: '🏆', label: 'menu_tournaments', desc: 'compete_students', href: '/tournaments', gradient: 'linear-gradient(135deg, #c75050, #a83e3e)' },
];

export default function ChessComHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setUITheme } = useUITheme();
  const { theme: boardTheme } = useBoardTheme();
  const [profile, setProfile] = useState<any>(null);
  const [boardSize, setBoardSize] = useState(500);
  const boardContainerRef = useRef<HTMLDivElement>(null);
  const [activePath, setActivePath] = useState('/');
  const [moreOpen, setMoreOpen] = useState(false);
  const [showDifficultySelect, setShowDifficultySelect] = useState(false);

  // Game state — играем прямо на главной с ELO ~1600 (hard)
  const chessRef = useRef(new Chess());
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [aiThinking, setAiThinking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<string>('');

  // ИИ играет на 'hard' уровне (~ELO 2000)
  const HOMEPAGE_DIFFICULTY = 'hard';

  const makeAIMove = useCallback(async () => {
    if (chessRef.current.isGameOver()) return;
    setAiThinking(true);
    try {
      const moveStr = await getAIMove(chessRef.current.fen(), HOMEPAGE_DIFFICULTY);
      const { from, to, promotion } = parseStockfishMove(moveStr);
      const move = chessRef.current.move({ from, to, promotion: promotion as any || 'q' });
      if (move) {
        setFen(chessRef.current.fen());
        playChessSound(move);
        if (chessRef.current.isGameOver()) {
          setGameOver(true);
          setGameResult(chessRef.current.isCheckmate() ? 'Мат!' : 'Ничья');
        }
      }
    } catch (e) {
      console.error('AI move error:', e);
    } finally {
      setAiThinking(false);
    }
  }, []);

  const onPieceDrop = (sourceSquare: string, targetSquare: string): boolean => {
    if (aiThinking || gameOver || chessRef.current.turn() !== 'w') return false;
    try {
      const move = chessRef.current.move({
        from: sourceSquare as Square,
        to: targetSquare as Square,
        promotion: 'q',
      });
      if (!move) {
        setFen(chessRef.current.fen());
        return false;
      }
      setFen(chessRef.current.fen());
      playChessSound(move);
      if (chessRef.current.isGameOver()) {
        setGameOver(true);
        setGameResult(chessRef.current.isCheckmate() ? 'Мат! Победа!' : 'Ничья');
        return true;
      }
      // ИИ ход через небольшую задержку
      setTimeout(() => makeAIMove(), 300);
      return true;
    } catch {
      // Принудительно перерисовываем чтобы фигура вернулась
      setFen(chessRef.current.fen());
      return false;
    }
  };

  const resetGame = () => {
    chessRef.current = new Chess();
    setFen(chessRef.current.fen());
    setGameOver(false);
    setGameResult('');
    setAiThinking(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
          .then(({ data }) => setProfile(data));
      }
    });
  }, []);

  useEffect(() => {
    const updateSize = () => {
      const isMobile = window.innerWidth <= 900;
      if (isMobile) {
        // На мобильных — размер основан на ширине экрана
        const w = Math.min(window.innerWidth - 24, 480);
        setBoardSize(w);
      } else if (boardContainerRef.current) {
        const h = boardContainerRef.current.clientHeight;
        const w = boardContainerRef.current.clientWidth;
        setBoardSize(Math.min(h - 80, w - 40, 680));
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div className="chesscom-layout" style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: '#262421', color: '#e0ddd5', fontFamily: "'Segoe UI', system-ui, sans-serif",
    }}>

      {/* ===== LEFT SIDEBAR ===== */}
      <nav className="chesscom-sidebar" style={{
        width: 180, minWidth: 180, height: '100vh', background: '#1a1815',
        display: 'flex', flexDirection: 'column', borderRight: '1px solid #3d3a36',
        overflowY: 'auto',
      }}>
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 px-4 py-4 border-b border-white/5" style={{ textDecoration: 'none' }}>
          <span className="text-2xl">♞</span>
          <span className="font-bold text-sm" style={{ color: '#86b817' }}>{t('app_name')}</span>
        </Link>

        {/* Nav items */}
        <div className="flex-1 py-2">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-3 px-4 py-2.5 text-sm transition-all"
              style={{
                color: activePath === item.href ? '#fff' : '#9e9b93',
                background: activePath === item.href ? '#2f2c28' : 'transparent',
                textDecoration: 'none',
                borderLeft: activePath === item.href ? '3px solid #86b817' : '3px solid transparent',
              }}
              onMouseEnter={(e) => { if (activePath !== item.href) e.currentTarget.style.background = '#2a2723'; }}
              onMouseLeave={(e) => { if (activePath !== item.href) e.currentTarget.style.background = 'transparent'; }}
            >
              <span className="text-lg w-6 text-center">{item.icon}</span>
              <span>{t(item.label as any)}</span>
            </Link>
          ))}

          {/* More */}
          <button onClick={() => setMoreOpen(!moreOpen)}
            className="flex items-center gap-3 px-4 py-2.5 text-sm w-full text-left transition-all"
            style={{ color: '#9e9b93', background: 'transparent', border: 'none', borderLeft: '3px solid transparent' }}>
            <span className="text-lg w-6 text-center">•••</span>
            <span>{moreOpen ? '▾' : '▸'} {t('next')}</span>
          </button>

          {moreOpen && (
            <div style={{ background: '#1e1c18' }}>
              {[
                { href: '/chess960', icon: '🔀', label: 'menu_variants' },
                { href: '/leaderboard', icon: '🏅', label: 'menu_leaderboard' },
                { href: '/rating', icon: '📊', label: 'sidebar_internal_rating' },
                { href: '/daily', icon: '📬', label: 'sidebar_correspondence' },
                { href: '/profile', icon: '👤', label: 'profile_title' },
                { href: '/trainer', icon: '👨‍🏫', label: 'sidebar_trainer_cabinet' },
                { href: '/admin', icon: '🛡️', label: 'sidebar_admin' },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 px-6 py-2 text-xs transition-all"
                  style={{ color: '#7a7770', textDecoration: 'none' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#c4c1b9'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#7a7770'}
                >
                  <span>{item.icon}</span>
                  <span>{t(item.label as any)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Switch back to Ход Конём */}
        <button onClick={() => setUITheme('hodkonem')}
          className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b30' }}>
          ✨ {t('app_name')} стиль
        </button>

        {/* Profile */}
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

      {/* ===== MOBILE TOP BAR (visible only on mobile) ===== */}
      <div className="chesscom-mobile-bar" style={{
        display: 'none', width: '100%', padding: '8px 12px',
        background: '#1a1815', borderBottom: '1px solid #3d3a36',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">♞</span>
          <span className="font-bold text-sm" style={{ color: '#86b817' }}>{t('app_name')}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/profile" style={{ color: '#9e9b93', textDecoration: 'none', fontSize: '12px' }}>
            {profile?.username || t('player')}
          </Link>
          <button onClick={() => setUITheme('hodkonem')}
            style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b30', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 600 }}>
            ✨ {t('app_name')}
          </button>
        </div>
      </div>

      {/* ===== CENTER: BOARD ===== */}
      <div ref={boardContainerRef} className="cc-board-section flex-1 flex flex-col items-center justify-center" style={{ position: 'relative', padding: '20px 12px' }}>
        {/* Opponent label */}
        <div className="flex items-center gap-2 mb-3" style={{ alignSelf: 'flex-start', maxWidth: boardSize, marginLeft: 'auto', marginRight: 'auto', width: '100%' }}>
          <div className="w-7 h-7 rounded bg-white/10 flex items-center justify-center text-xs">👤</div>
          <span className="text-sm font-medium" style={{ color: '#9e9b93' }}>{t('player')}</span>
        </div>

        <Chessboard
          boardWidth={boardSize}
          position={fen}
          onPieceDrop={onPieceDrop}
          arePiecesDraggable={!aiThinking && !gameOver}
          customLightSquareStyle={{ backgroundColor: '#eeeed2' }}
          customDarkSquareStyle={{ backgroundColor: '#769656' }}
          animationDuration={200}
        />

        {/* AI thinking / Game over indicator */}
        {(aiThinking || gameOver) && (
          <div className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold"
            style={{
              background: gameOver ? '#86b81720' : '#3d3a3680',
              color: gameOver ? '#86b817' : '#9e9b93',
              border: `1px solid ${gameOver ? '#86b81750' : '#3d3a36'}`,
            }}>
            {gameOver ? `🏆 ${gameResult}` : `🤖 ${t('ai_thinking')}`}
          </div>
        )}

        {gameOver && (
          <button onClick={resetGame}
            className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold"
            style={{ background: '#86b817', color: '#1a1815', border: 'none', cursor: 'pointer' }}>
            🔄 {t('new_game')}
          </button>
        )}

        {/* Player label */}
        <div className="flex items-center gap-2 mt-3" style={{ alignSelf: 'flex-start', maxWidth: boardSize, marginLeft: 'auto', marginRight: 'auto', width: '100%' }}>
          <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold"
            style={{ background: '#86b817', color: '#1a1815' }}>
            {profile?.username?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="text-sm font-semibold text-white">{profile?.username || t('player')}</span>
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#86b81730', color: '#86b817' }}>
            {profile?.elo_rating || 1200}
          </span>
        </div>
      </div>

      {/* ===== RIGHT PANEL ===== */}
      <div style={{
        width: 340, minWidth: 340, height: '100vh', overflowY: 'auto',
        borderLeft: '1px solid #3d3a36', padding: '20px 16px',
      }}>
        {/* Title */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">♟</span>
          <h1 className="text-xl font-bold text-white">{t('menu_play')}</h1>
        </div>

        {/* Play options */}
        <div className="space-y-3">
          {PLAY_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => {
              if (opt.id === 'ai') {
                setShowDifficultySelect(true);
              } else {
                router.push(opt.href);
              }
            }}
              className="w-full rounded-xl p-4 flex items-center gap-4 text-left transition-all group"
              style={{ background: '#302e2b', border: '1px solid #3d3a36' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#86b817'; e.currentTarget.style.background = '#3a3835'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3d3a36'; e.currentTarget.style.background = '#302e2b'; }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                style={{ background: opt.gradient }}>
                {opt.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm">{t(opt.label as any)}</div>
                <div className="text-xs mt-0.5" style={{ color: '#9e9b93' }}>{t(opt.desc as any)}</div>
              </div>
              <span style={{ color: '#555' }} className="group-hover:translate-x-1 transition-transform">→</span>
            </button>
          ))}
        </div>

        {/* Quick links */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          {[
            { href: '/chess960', icon: '🔀', label: 'menu_variants' },
            { href: '/learn', icon: '📚', label: 'menu_learn' },
            { href: '/leaderboard', icon: '🏅', label: 'menu_leaderboard' },
            { href: '/daily', icon: '📬', label: 'sidebar_correspondence' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all"
              style={{ background: '#302e2b', color: '#9e9b93', textDecoration: 'none', border: '1px solid #3d3a36' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3d3a36'; e.currentTarget.style.color = '#9e9b93'; }}
            >
              <span>{item.icon}</span>
              <span className="truncate">{t(item.label as any)}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ===== DIFFICULTY SELECTOR MODAL ===== */}
      <AnimatePresence>
        {showDifficultySelect && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowDifficultySelect(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 200, padding: 20,
            }}>
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: '#262421', borderRadius: 16, padding: 24,
                maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto',
                border: '1px solid #3d3a36',
              }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">🤖 {t('difficulty_select')}</h2>
                <button onClick={() => setShowDifficultySelect(false)}
                  style={{ background: 'transparent', border: 'none', color: '#9e9b93', fontSize: 24, cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { id: 'kids', icon: '👶', label: 'diff_kids', elo: 100, color: '#ec4899' },
                  { id: 'beginner', icon: '🌱', label: 'diff_beginner_full', elo: 450, color: '#10b981' },
                  { id: 'medium', icon: '⚔️', label: 'diff_medium_full', elo: 1150, color: '#3b82f6' },
                  { id: 'hard', icon: '🔥', label: 'diff_hard_full', elo: 2000, color: '#f59e0b' },
                  { id: 'expert', icon: '👑', label: 'diff_expert_full', elo: 2600, color: '#ef4444' },
                ].map(d => (
                  <button key={d.id} onClick={() => {
                    setShowDifficultySelect(false);
                    router.push(`/game/${d.id}`);
                  }}
                    className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all"
                    style={{
                      background: '#302e2b', border: '1px solid #3d3a36',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = d.color; e.currentTarget.style.background = '#3a3835'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#3d3a36'; e.currentTarget.style.background = '#302e2b'; }}>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: `${d.color}20`, border: `1px solid ${d.color}50` }}>
                      {d.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm">{t(d.label as any)}</div>
                      <div className="text-xs mt-0.5" style={{ color: '#9e9b93' }}>ELO ~{d.elo}</div>
                    </div>
                    <span style={{ color: d.color }}>→</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile — stack layout with scroll */}
      <style jsx global>{`
        @media (max-width: 900px) {
          .chesscom-sidebar { display: none !important; }
          .chesscom-mobile-bar { display: flex !important; }
          .chesscom-layout {
            flex-direction: column !important;
            overflow-y: auto !important;
            height: auto !important;
            min-height: 100vh !important;
          }
          .cc-board-section {
            flex: none !important;
            padding: 16px 12px !important;
            min-height: auto !important;
          }
          .chesscom-layout > div:last-of-type {
            width: 100% !important;
            min-width: unset !important;
            border-left: none !important;
            border-top: 1px solid #3d3a36 !important;
            height: auto !important;
            padding: 16px 12px 24px 12px !important;
          }
        }
      `}</style>
    </div>
  );
}
