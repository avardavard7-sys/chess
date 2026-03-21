'use client';

import { useState, use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Header from '@/components/Header';
import ChessBoard from '@/components/ChessBoard';
import KidsBackground from '@/components/KidsBackground';
import GameOverModal from '@/components/GameOverModal';
import OnlineChat from '@/components/OnlineChat';
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

  const isKids = rawMode === 'kids';
  const diffInfo = difficultyLabels[rawMode] || difficultyLabels.medium;

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
        onPlayAgain={() => { setGameOverData(null); setGameKey((k) => k + 1); }}
      />
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
