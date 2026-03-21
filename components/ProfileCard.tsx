'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { getRankProgress, getNextRankThreshold, getPrevRankThreshold } from '@/lib/elo';

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  elo_rating: number;
  rank: string;
  games_played: number;
  games_won: number;
  games_lost: number;
  games_draw: number;
}

interface GameHistoryItem {
  id: string;
  result: string;
  elo_change: number;
  elo_before: number;
  elo_after: number;
  played_at: string;
  opponent: {
    username: string;
    avatar_url: string;
    elo_rating: number;
  } | null;
}

interface ProfileCardProps {
  profile: Profile;
  gameHistory: GameHistoryItem[];
}

export default function ProfileCard({ profile, gameHistory }: ProfileCardProps) {
  const winRate = profile.games_played > 0
    ? Math.round((profile.games_won / profile.games_played) * 100)
    : 0;

  const rankProgress = getRankProgress(profile.elo_rating);
  const nextThreshold = getNextRankThreshold(profile.elo_rating);
  const prevThreshold = getPrevRankThreshold(profile.elo_rating);

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (winRate / 100) * circumference;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Main profile card */}
      <motion.div
        className="glass p-8 rounded-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Avatar */}
          <motion.div
            className="relative flex-shrink-0"
            whileHover={{ scale: 1.05 }}
          >
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-yellow-500/50 shadow-lg shadow-yellow-500/20">
              {profile.avatar_url ? (
                <Image
                  src={profile.avatar_url}
                  alt={profile.username}
                  width={112}
                  height={112}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-yellow-500/20 flex items-center justify-center text-4xl font-bold text-yellow-400">
                  {profile.username?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            {/* Online dot */}
            <div className="absolute bottom-1 right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-900" />
          </motion.div>

          {/* Info */}
          <div className="flex-1 text-center md:text-left">
            <h1
              className="text-3xl font-bold mb-1"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {profile.username}
            </h1>
            <p className="text-white/50 mb-4 text-sm">{profile.rank}</p>

            {/* ELO */}
            <div className="inline-flex items-center gap-3 mb-6">
              <span
                className="text-5xl font-bold"
                style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}
              >
                {profile.elo_rating}
              </span>
              <div>
                <div className="text-xs text-white/40 uppercase tracking-wider">ELO рейтинг</div>
                <div className="text-sm text-white/60">{profile.rank}</div>
              </div>
            </div>

            {/* Rank progress bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-white/40">
                <span>{prevThreshold}</span>
                <span>До следующего ранга: {nextThreshold - profile.elo_rating} ELO</span>
                <span>{nextThreshold}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #f59e0b, #7c3aed)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${rankProgress}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                />
              </div>
            </div>
          </div>

          {/* Win rate ring */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <svg width="100" height="100" className="rotate-[-90deg]">
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <motion.circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.2, delay: 0.4, ease: 'easeOut' }}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>
              </defs>
            </svg>
            <div className="mt-[-70px] text-center z-10 relative">
              <div className="text-2xl font-bold text-yellow-400">{winRate}%</div>
              <div className="text-xs text-white/40 mt-1">Побед</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <motion.div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        {[
          { label: 'Партий', value: profile.games_played, color: '#94a3b8', icon: '♟' },
          { label: 'Побед', value: profile.games_won, color: '#4ade80', icon: '🏆' },
          { label: 'Поражений', value: profile.games_lost, color: '#f87171', icon: '😔' },
          { label: 'Ничьих', value: profile.games_draw, color: '#94a3b8', icon: '🤝' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className="glass p-5 rounded-xl text-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <div className="text-2xl mb-1">{stat.icon}</div>
            <motion.div
              className="text-3xl font-bold mb-1"
              style={{ color: stat.color, fontFamily: "'Playfair Display', serif" }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
            >
              {stat.value}
            </motion.div>
            <div className="text-xs text-white/40 uppercase tracking-wider">{stat.label}</div>
          </motion.div>
        ))}
      </motion.div>

      {/* Game history table */}
      <motion.div
        className="glass rounded-2xl overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="p-5 border-b border-white/10">
          <h2 className="text-lg font-bold playfair">Последние партии</h2>
        </div>

        {gameHistory.length === 0 ? (
          <div className="p-8 text-center text-white/40">
            <div className="text-4xl mb-3">♟</div>
            <p>Партий пока нет. Сыграйте первую!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-5 py-3 text-xs text-white/40 uppercase tracking-wider">Соперник</th>
                  <th className="text-center px-5 py-3 text-xs text-white/40 uppercase tracking-wider">Результат</th>
                  <th className="text-center px-5 py-3 text-xs text-white/40 uppercase tracking-wider">ELO</th>
                  <th className="text-right px-5 py-3 text-xs text-white/40 uppercase tracking-wider">Дата</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.map((game, i) => (
                  <motion.tr
                    key={game.id}
                    className="border-b border-white/5 hover:bg-white/3 transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 flex items-center justify-center text-sm">
                          {game.opponent?.avatar_url ? (
                            <Image
                              src={game.opponent.avatar_url}
                              alt={game.opponent.username || 'AI'}
                              width={32}
                              height={32}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span>🤖</span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{game.opponent?.username || 'Компьютер'}</div>
                          {game.opponent && (
                            <div className="text-xs text-white/40">ELO {game.opponent.elo_rating}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: game.result === 'win'
                            ? 'rgba(74,222,128,0.15)'
                            : game.result === 'loss'
                            ? 'rgba(248,113,113,0.15)'
                            : 'rgba(148,163,184,0.15)',
                          color: game.result === 'win' ? '#4ade80' : game.result === 'loss' ? '#f87171' : '#94a3b8',
                        }}
                      >
                        {game.result === 'win' ? '🏆 Победа' : game.result === 'loss' ? '😔 Поражение' : '🤝 Ничья'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className="font-bold text-sm"
                        style={{ color: game.elo_change >= 0 ? '#4ade80' : '#f87171' }}
                      >
                        {game.elo_change >= 0 ? '+' : ''}{game.elo_change}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-xs text-white/40">
                      {new Date(game.played_at).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}
