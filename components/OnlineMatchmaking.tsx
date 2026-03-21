'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  hasToken, getToken, startOAuth, getNetworkUser,
  createSeek, type NetworkUser, type SeekResult,
} from '@/lib/lichess';
import { supabase } from '@/lib/supabase';
import { addToMatchmakingQueue, removeFromMatchmakingQueue, findMatch, createGameSession, getProfile } from '@/lib/supabase';
import LichessGame from './LichessGame';
import GameOverModal from './GameOverModal';
import { calculateEloChange } from '@/lib/elo';
import { updateElo } from '@/lib/supabase';

type MatchmakingState = 'idle' | 'connecting' | 'searching' | 'found' | 'playing';

export default function OnlineMatchmaking() {
  const router = useRouter();
  const [state, setState] = useState<MatchmakingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [netUser, setNetUser] = useState<NetworkUser | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [myColor, setMyColor] = useState<'white' | 'black'>('white');
  const [opponentName, setOpponentName] = useState('Соперник');
  const [opponentRating, setOpponentRating] = useState<number | undefined>();
  const [gameResult, setGameResult] = useState<{ result: 'win' | 'loss' | 'draw'; eloChange: number } | null>(null);
  const [localUser, setLocalUser] = useState<{ id: string } | null>(null);
  const [localElo, setLocalElo] = useState(0);
  const [localGames, setLocalGames] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const networkConnected = hasToken();

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setLocalUser(session.user);
          setIsLoggedIn(true);
          const { data } = await getProfile(session.user.id);
          if (data) {
            setLocalElo(data.elo_rating);
            setLocalGames(data.games_played || 0);
          }
        }
      } catch {}
      setIsLoading(false);

      // Load network user if token exists
      const token = getToken();
      if (token) {
        const cached = localStorage.getItem('net_user');
        if (cached) {
          try { setNetUser(JSON.parse(cached)); } catch {}
        } else {
          getNetworkUser(token).then((u) => {
            setNetUser(u);
            localStorage.setItem('net_user', JSON.stringify(u));
          }).catch(() => {});
        }
      }
    };
    load();

    return () => { stopSearch(); };
  }, []);

  const startNetworkSearch = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setState('searching');
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    abortRef.current = new AbortController();

    // createSeek blocks until a game is found — returns game info directly
    createSeek(token, abortRef.current.signal).then((result: SeekResult | null) => {
      if (result && !abortRef.current?.signal.aborted) {
        clearTimers();
        setGameId(result.gameId);
        setMyColor(result.color);
        setState('found');
        setTimeout(() => setState('playing'), 1000);
      }
    });
  }, []);

  const startLocalSearch = useCallback(async () => {
    if (!localUser) return;
    setState('searching');
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    await addToMatchmakingQueue(localUser.id, localElo);

    const searchInterval = setInterval(async () => {
      const match = await findMatch(localUser.id, localElo);
      if (match) {
        clearInterval(searchInterval);
        await removeFromMatchmakingQueue(match.user_id);
        await removeFromMatchmakingQueue(localUser.id);

        const isWhite = Math.random() > 0.5;
        const { data: session } = await createGameSession(
          isWhite ? localUser.id : match.user_id,
          isWhite ? match.user_id : localUser.id,
          'online'
        );

        if (session) {
          clearTimers();
          router.push(`/game/online?session=${session.id}&color=${isWhite ? 'white' : 'black'}`);
        }
      }
    }, 2000);

    // Cleanup
    abortRef.current = new AbortController();
    abortRef.current.signal.addEventListener('abort', () => {
      clearInterval(searchInterval);
    });
  }, [localUser, localElo, router]);

  const handleStartSearch = () => {
    if (networkConnected && netUser) {
      startNetworkSearch();
    } else {
      startLocalSearch();
    }
  };

  const stopSearch = useCallback(() => {
    clearTimers();
    setState('idle');
    abortRef.current?.abort();
    if (localUser) {
      removeFromMatchmakingQueue(localUser.id).catch(() => {});
    }
  }, [localUser]);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleGameEnd = async (result: 'win' | 'loss' | 'draw', opponentNameArg?: string, oppRating?: number) => {
    abortRef.current?.abort();
    const opponentElo = oppRating || opponentRating || 1500;
    const change = calculateEloChange(localElo, opponentElo, result, localGames);

    if (localUser) {
      const newElo = localElo + change;
      await updateElo(localUser.id, newElo, result);

      // Save game history
      await supabase.from('game_history').insert({
        user_id: localUser.id,
        result,
        elo_before: localElo,
        elo_after: newElo,
        elo_change: change,
      });

      // Update local state
      setLocalElo(newElo);
      setLocalGames((g) => g + 1);
    }

    setGameResult({ result, eloChange: change });
    setState('idle');
    setGameId(null);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div className="text-5xl" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>♞</motion.div>
      </div>
    );
  }

  // Playing state — full game UI
  if (state === 'playing' && gameId) {
    return (
      <div className="min-h-screen pt-24 pb-12 px-4">
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
            🌐 Онлайн матч
          </h1>
        </motion.div>
        <div className="flex justify-center">
          <LichessGame
            gameId={gameId}
            myColor={myColor}
            opponentName={opponentName}
            opponentRating={opponentRating}
            myName={netUser?.username || 'Вы'}
            myRating={netUser?.rating || localElo}
            onGameEnd={handleGameEnd}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 pt-20">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">

          {/* Game found! */}
          {state === 'found' && (
            <motion.div key="found" className="glass p-10 rounded-2xl text-center"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <motion.div className="text-6xl mb-4"
                animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.5 }}>
                🎯
              </motion.div>
              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#4ade80' }}>
                Соперник найден!
              </h2>
              <p className="text-white/60">Начинаем партию...</p>
              <div className="mt-4 flex justify-center gap-2">
                <div className={`w-5 h-5 rounded-full border-2 border-white/20 ${myColor === 'white' ? 'bg-white' : 'bg-gray-900'}`} />
                <span className="text-sm text-white/60">Вы играете {myColor === 'white' ? 'белыми' : 'чёрными'}</span>
              </div>
            </motion.div>
          )}

          {/* Searching */}
          {state === 'searching' && (
            <motion.div key="searching" className="glass p-10 rounded-2xl text-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              <motion.div className="text-7xl mb-5 block"
                animate={{
                  scale: [1, 1.12, 1],
                  filter: [
                    'drop-shadow(0 0 0px rgba(245,158,11,0.3))',
                    'drop-shadow(0 0 25px rgba(245,158,11,0.9))',
                    'drop-shadow(0 0 0px rgba(245,158,11,0.3))',
                  ],
                }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
                ♞
              </motion.div>

              <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                Ищем соперника...
              </h2>

              <div className="flex justify-center gap-1.5 mb-4">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="w-2 h-2 bg-yellow-400 rounded-full"
                    animate={{ y: [0, -8, 0], opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.22 }} />
                ))}
              </div>

              {/* Network status */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg mb-4"
                style={{ background: networkConnected ? 'rgba(74,222,128,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${networkConnected ? 'rgba(74,222,128,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                <div className={`w-2 h-2 rounded-full ${networkConnected ? 'bg-green-400' : 'bg-yellow-400'}`}
                  style={{ boxShadow: networkConnected ? '0 0 6px #4ade80' : '0 0 6px #f59e0b' }} />
                <span className="text-xs" style={{ color: networkConnected ? '#4ade80' : '#fbbf24' }}>
                  {networkConnected ? `Сеть: тысячи игроков онлайн` : `Локальный поиск · ELO ${localElo}`}
                </span>
              </div>

              <div className="text-3xl font-mono font-bold mb-6"
                style={{ color: elapsed > 30 ? '#f87171' : '#f59e0b' }}>
                {formatTime(elapsed)}
              </div>

              {elapsed > 20 && networkConnected && (
                <motion.p className="text-white/35 text-xs mb-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  Расширяем диапазон рейтинга...
                </motion.p>
              )}

              <motion.button onClick={stopSearch}
                className="w-full py-3 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-medium"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
                ✕ Отмена
              </motion.button>
            </motion.div>
          )}

          {/* Idle — main screen */}
          {state === 'idle' && (
            <motion.div key="idle" className="glass p-8 rounded-2xl text-center"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>

              <div className="text-6xl mb-5">🌐</div>
              <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
                Играть онлайн
              </h2>
              <p className="text-white/55 mb-6 text-sm">
                Сыграйте с реальным соперником прямо сейчас
              </p>

              {/* Network connection status */}
              <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-white/50">Сеть игроков</span>
                  {networkConnected ? (
                    <div className="flex items-center gap-1.5">
                      <motion.div className="w-2.5 h-2.5 rounded-full bg-green-400"
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{ boxShadow: '0 0 8px #4ade80' }} />
                      <span className="text-xs text-green-400 font-semibold">Подключено</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                      <span className="text-xs text-white/30">Не подключено</span>
                    </div>
                  )}
                </div>

                {networkConnected && netUser ? (
                  <div className="text-left">
                    <div className="text-xs text-white/40 mb-1">Ваш игровой аккаунт</div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white/80">{netUser.username}</span>
                      <span className="text-xs text-yellow-400">Рейтинг {netUser.rating}</span>
                    </div>
                    <div className="text-xs text-green-400 mt-1">✓ Доступны тысячи игроков по всему миру</div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-white/40 mb-3 text-left">
                      Подключите игровой аккаунт для доступа к глобальной сети игроков
                    </p>
                    <motion.button
                      onClick={startOAuth}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold text-white/85 border border-white/15 hover:bg-white/8 hover:border-white/25 transition-all"
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    >
                      🔗 Подключить глобальную сеть
                    </motion.button>
                  </div>
                )}
              </div>

              {/* ELO info for local */}
              {!networkConnected && isLoggedIn && (
                <div className="flex items-center justify-center gap-2 mb-5">
                  <span className="text-xs text-white/40">Локальный рейтинг:</span>
                  <span className="text-yellow-400 font-bold text-sm">ELO {localElo}</span>
                </div>
              )}

              {/* Login prompt if not logged in */}
              {!isLoggedIn && !networkConnected && (
                <div className="mb-5">
                  <p className="text-white/40 text-sm mb-3">Войдите для сохранения рейтинга</p>
                  <motion.button
                    onClick={() => import('@/lib/supabase').then((m) => m.signInWithGoogle())}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-white/15 text-white/70 hover:bg-white/5 transition-all text-sm"
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Войти через Google
                  </motion.button>
                </div>
              )}

              {/* Play button */}
              <motion.button
                onClick={handleStartSearch}
                className="w-full py-4 px-6 rounded-xl font-bold text-lg text-black"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #7c3aed)' }}
                whileHover={{ scale: 1.03, boxShadow: '0 10px 40px rgba(245,158,11,0.4)' }}
                whileTap={{ scale: 0.97 }}
              >
                {networkConnected ? '⚡ Найти соперника' : '🔍 Искать соперника'}
              </motion.button>

              {networkConnected && (
                <p className="text-white/25 text-xs mt-3">
                  Обычно находим соперника за 5–30 секунд
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Game over modal */}
      <GameOverModal
        isOpen={!!gameResult}
        result={gameResult?.result ?? null}
        eloChange={gameResult?.eloChange ?? null}
        onPlayAgain={() => setGameResult(null)}
      />
    </div>
  );
}
