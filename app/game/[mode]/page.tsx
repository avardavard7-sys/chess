'use client';

import { useState, use, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import ChessBoard from '@/components/ChessBoard';
import KidsBackground from '@/components/KidsBackground';
import GameOverModal from '@/components/GameOverModal';
import OnlineChat from '@/components/OnlineChat';
import { supabase } from '@/lib/supabase';
import type { Difficulty } from '@/store/gameStore';

interface GamePageProps {
  params: Promise<{ mode: string }>;
}

const difficultyLabels: Record<string, { label: string; icon: string }> = {
  kids: { label: 'Детский', icon: '👶' },
  beginner: { label: 'Начинающий', icon: '🌱' },
  medium: { label: 'Средний', icon: '⚔️' },
  hard: { label: 'Сложный', icon: '🔥' },
  expert: { label: 'Эксперт', icon: '👑' },
  online: { label: 'Онлайн', icon: '🌐' },
};

function GameContent({ rawMode }: { rawMode: string }) {
  const searchParams = useSearchParams();
  const gameMode = searchParams.get('mode') === 'local'
    ? 'local'
    : searchParams.get('mode') === 'friend'
    ? 'friend'
    : rawMode === 'online'
    ? 'online'
    : 'ai';
  const sessionId = searchParams.get('session') || undefined;
  const playerColor = (searchParams.get('color') || 'white') as 'white' | 'black';

  const [gameOverData, setGameOverData] = useState<{
    result: 'win' | 'loss' | 'draw';
    eloChange: number;
  } | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [rematchRequest, setRematchRequest] = useState(false);
  const [rematchWaiting, setRematchWaiting] = useState(false);
  const rematchChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isKids = rawMode === 'kids';
  const diffInfo = difficultyLabels[rawMode] || difficultyLabels.medium;

  useEffect(() => {
    if (gameMode !== 'friend' || !sessionId) return;
    const ch = supabase.channel(`rematch:${sessionId}`);
    rematchChannelRef.current = ch;
    ch.on('broadcast', { event: 'REMATCH_REQ' }, () => {
      setRematchRequest(true);
    }).on('broadcast', { event: 'REMATCH_OK' }, () => {
      setRematchWaiting(false);
      setGameOverData(null);
      setGameKey((k) => k + 1);
    }).subscribe();
    return () => { ch.unsubscribe(); };
  }, [gameMode, sessionId]);

  const handlePlayAgain = () => {
    if (gameMode === 'friend' && sessionId && rematchChannelRef.current) {
      setRematchWaiting(true);
      rematchChannelRef.current.send({ type: 'broadcast', event: 'REMATCH_REQ', payload: {} });
    } else {
      setGameOverData(null);
      setGameKey((k) => k + 1);
    }
  };

  const handleAcceptRematch = () => {
    setRematchRequest(false);
    setGameOverData(null);
    setGameKey((k) => k + 1);
    rematchChannelRef.current?.send({ type: 'broadcast', event: 'REMATCH_OK', payload: {} });
  };

  return (
    <div className="relative min-h-screen">
      {isKids && <KidsBackground />}
      <Header />
      <main className="relative z-10 pt-24 pb-12 px-4">
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-xl">{diffInfo.icon}</span>
            <h1
              className="text-xl font-bold"
              style={{
                fontFamily: "'Playfair Display', serif",
                color: isKids ? '#7c3aed' : '#f59e0b',
              }}
            >
              {gameMode === 'online'
                ? 'Онлайн матч'
                : gameMode === 'local'
                ? 'Игра вдвоём'
                : gameMode === 'friend'
                ? 'Игра с другом'
                : `Уровень: ${diffInfo.label}`}
            </h1>
          </div>
          <p className="text-xs" style={{ color: isKids ? '#6d28d9' : 'rgba(255,255,255,0.4)' }}>
            {gameMode === 'ai' && 'Вы играете против Hod Konem AI'}
            {gameMode === 'local' && 'Два игрока на одном экране'}
            {gameMode === 'online' && `Вы играете ${playerColor === 'white' ? 'белыми' : 'чёрными'}`}
            {gameMode === 'friend' && `Вы играете ${playerColor === 'white' ? 'белыми' : 'чёрными'}`}
          </p>
        </motion.div>

        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <ChessBoard
            key={gameKey}
            difficulty={(rawMode === 'online' ? 'medium' : rawMode) as Difficulty}
            mode={gameMode as 'ai' | 'local' | 'online'}
            isKidsMode={isKids}
            sessionId={sessionId}
            playerColor={playerColor}
            onGameOver={(result, eloChange) => setGameOverData({ result, eloChange })}
          />
        </motion.div>
      </main>

      {(gameMode === 'online' || gameMode === 'friend') && sessionId && (
        <OnlineChat sessionId={sessionId} playerColor={playerColor} />
      )}

      <GameOverModal
        isOpen={!!gameOverData}
        result={gameOverData?.result ?? null}
        eloChange={gameOverData?.eloChange ?? null}
        onPlayAgain={handlePlayAgain}
      />

      {/* Rematch waiting */}
      <AnimatePresence>
        {rematchWaiting && (
          <motion.div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 glass px-6 py-3 rounded-xl text-sm text-yellow-400"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
            Ожидание ответа соперника...
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rematch request from opponent */}
      <AnimatePresence>
        {rematchRequest && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="glass p-8 rounded-2xl text-center max-w-sm mx-4"
              style={{ border: '1px solid rgba(245,158,11,0.3)' }}
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}>
              <div className="text-5xl mb-4">♞</div>
              <h3 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>Реванш!</h3>
              <p className="text-white/50 text-sm mb-6">Соперник предлагает сыграть ещё раз</p>
              <div className="flex gap-3">
                <motion.button onClick={handleAcceptRematch}
                  className="flex-1 py-3 rounded-xl font-semibold text-black"
                  style={{ background: 'linear-gradient(135deg, #4ade80, #22c55e)' }}
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  Принять
                </motion.button>
                <motion.button onClick={() => setRematchRequest(false)}
                  className="flex-1 py-3 rounded-xl border border-white/15 text-white/60"
                  whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  Отклонить
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function GamePage({ params }: GamePageProps) {
  const { mode: rawMode } = use(params);

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-6xl animate-spin">♞</div>
      </div>
    }>
      <GameContent rawMode={rawMode} />
    </Suspense>
  );
}
