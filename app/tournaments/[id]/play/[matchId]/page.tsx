'use client';

import { useState, useEffect, useRef, use } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import ChessBoard from '@/components/ChessBoard';
import { supabase } from '@/lib/supabase';
import type { Difficulty } from '@/store/gameStore';

export default function TournamentPlayPage({ params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { id: tournamentId, matchId } = use(params);
  const router = useRouter();
  const [match, setMatch] = useState<any>(null);
  const [tournament, setTournament] = useState<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [opponentName, setOpponentName] = useState('Соперник');
  const [myName, setMyName] = useState('Игрок');
  const [opponentReady, setOpponentReady] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { router.push('/tournaments/' + tournamentId); return; }
      const uid = session.user.id;
      setUserId(uid);

      // Загружаем матч
      const { data: m } = await supabase.from('tournament_matches').select('*').eq('id', matchId).single();
      if (!m) { router.push('/tournaments/' + tournamentId); return; }
      setMatch(m);

      // Загружаем турнир
      const { data: t } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
      setTournament(t);

      // Определяем цвет
      if (m.white_id === uid) setPlayerColor('white');
      else if (m.black_id === uid) setPlayerColor('black');
      else { router.push('/tournaments/' + tournamentId); return; }

      // Загружаем имена
      const opponentId = m.white_id === uid ? m.black_id : m.white_id;
      const { data: myProfile } = await supabase.from('profiles').select('username').eq('id', uid).single();
      if (myProfile) setMyName(myProfile.username);
      if (opponentId) {
        const { data: oppProfile } = await supabase.from('profiles').select('username').eq('id', opponentId).single();
        if (oppProfile) setOpponentName(oppProfile.username);
      }

      // Обновляем матч как active
      await supabase.from('tournament_matches').update({ status: 'active' }).eq('id', matchId);

      // Realtime — ждём соперника
      const channel = supabase.channel(`tournament-match-${matchId}`)
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const players = Object.keys(state).length;
          if (players >= 2) {
            setOpponentReady(true);
            setWaiting(false);
            setGameStarted(true);
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({ user_id: uid, color: m.white_id === uid ? 'white' : 'black' });
          }
        });

      channelRef.current = channel;
    };
    load();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [matchId, tournamentId, router]);

  // Обработка завершения партии
  const handleGameOver = async (result: 'win' | 'loss' | 'draw', eloChange: number) => {
    setGameOver(true);

    // Определяем результат для турнира
    const tournamentResult = result === 'win'
      ? (playerColor === 'white' ? 'white' : 'black')
      : result === 'loss'
      ? (playerColor === 'white' ? 'black' : 'white')
      : 'draw';

    const winnerId = tournamentResult === 'white' ? match.white_id
      : tournamentResult === 'black' ? match.black_id
      : null;

    // Сохраняем результат матча
    await supabase.from('tournament_matches').update({
      result: tournamentResult,
      winner_id: winnerId,
      status: 'finished',
      end_time: new Date().toISOString(),
    }).eq('id', matchId);

    // Обновляем статистику участников
    if (match.white_id) {
      const wField = tournamentResult === 'white' ? 'wins' : tournamentResult === 'draw' ? 'draws' : 'losses';
      const wPoints = tournamentResult === 'white' ? 1 : tournamentResult === 'draw' ? 0.5 : 0;
      const { data: wp } = await supabase.from('tournament_participants')
        .select('wins, losses, draws, points')
        .eq('tournament_id', tournamentId).eq('user_id', match.white_id).single();
      if (wp) {
        await supabase.from('tournament_participants').update({
          [wField]: (wp[wField as keyof typeof wp] as number || 0) + 1,
          points: (wp.points || 0) + wPoints,
        }).eq('tournament_id', tournamentId).eq('user_id', match.white_id);
      }
    }

    if (match.black_id) {
      const bField = tournamentResult === 'black' ? 'wins' : tournamentResult === 'draw' ? 'draws' : 'losses';
      const bPoints = tournamentResult === 'black' ? 1 : tournamentResult === 'draw' ? 0.5 : 0;
      const { data: bp } = await supabase.from('tournament_participants')
        .select('wins, losses, draws, points')
        .eq('tournament_id', tournamentId).eq('user_id', match.black_id).single();
      if (bp) {
        await supabase.from('tournament_participants').update({
          [bField]: (bp[bField as keyof typeof bp] as number || 0) + 1,
          points: (bp.points || 0) + bPoints,
        }).eq('tournament_id', tournamentId).eq('user_id', match.black_id);
      }
    }

    // Проверяем все ли матчи раунда завершены → авто-переход
    await checkAndAdvanceRound();

    // Через 5 сек возвращаемся к турниру
    setTimeout(() => router.push('/tournaments/' + tournamentId), 5000);
  };

  // Автоматический переход к следующему раунду
  const checkAndAdvanceRound = async () => {
    const { data: allMatches } = await supabase.from('tournament_matches')
      .select('*').eq('tournament_id', tournamentId).eq('round_number', match.round_number);

    if (!allMatches) return;

    const pending = allMatches.filter(m => m.status !== 'finished');
    if (pending.length > 0) return; // Ещё есть незавершённые матчи

    // Все матчи раунда завершены — определяем победителей
    const winners = allMatches.filter(m => m.winner_id).map(m => m.winner_id!);
    const losers = allMatches
      .filter(m => m.winner_id && m.result !== 'bye')
      .map(m => m.white_id === m.winner_id ? m.black_id : m.white_id);

    // Помечаем проигравших
    for (const loserId of losers) {
      if (loserId) {
        await supabase.from('tournament_participants')
          .update({ status: 'eliminated' })
          .eq('tournament_id', tournamentId).eq('user_id', loserId);
      }
    }

    // Если остался 1 — турнир завершён
    if (winners.length <= 1) {
      await supabase.from('tournaments').update({
        status: 'finished', winner_id: winners[0] || null,
      }).eq('id', tournamentId);
      return;
    }

    // Создаём следующий раунд
    const { data: tournament } = await supabase.from('tournaments')
      .select('current_round').eq('id', tournamentId).single();
    const nextRound = (tournament?.current_round || 0) + 1;

    const { data: round } = await supabase.from('tournament_rounds').insert({
      tournament_id: tournamentId, round_number: nextRound, status: 'upcoming',
    }).select().single();

    if (!round) return;

    // Создаём пары
    const newMatches = [];
    for (let i = 0; i < winners.length; i += 2) {
      if (i + 1 < winners.length) {
        newMatches.push({
          tournament_id: tournamentId, round_id: round.id, round_number: nextRound,
          white_id: winners[i], black_id: winners[i + 1], result: 'pending', status: 'pending',
        });
      } else {
        newMatches.push({
          tournament_id: tournamentId, round_id: round.id, round_number: nextRound,
          white_id: winners[i], black_id: null, result: 'bye', status: 'finished',
        });
        // Автоматически засчитываем BYE победу
        const { data: byeP } = await supabase.from('tournament_participants')
          .select('wins, points').eq('tournament_id', tournamentId).eq('user_id', winners[i]).single();
        if (byeP) {
          await supabase.from('tournament_participants').update({
            wins: (byeP.wins || 0) + 1, points: (byeP.points || 0) + 1,
          }).eq('tournament_id', tournamentId).eq('user_id', winners[i]);
        }
      }
    }

    await supabase.from('tournament_matches').insert(newMatches);
    await supabase.from('tournaments').update({ current_round: nextRound }).eq('id', tournamentId);
  };

  // Парсим тайминг турнира
  const getTimeControl = () => {
    if (!tournament?.time_control) return null;
    const parts = tournament.time_control.split('|');
    const minutes = parseInt(parts[0]) || 10;
    const increment = parseInt(parts[1]) || 0;
    return { minutes, increment };
  };

  if (!match || !userId) return (
    <div className="min-h-screen"><Header />
      <div className="flex items-center justify-center min-h-screen">
        <motion.div className="text-3xl" animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>{'♞'}</motion.div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Tournament info bar */}
          <motion.div className="glass p-4 rounded-xl mb-4 flex items-center gap-4"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <span className="text-2xl">{'🏆'}</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-yellow-400">{tournament?.name || 'Турнир'}</div>
              <div className="text-xs text-white/30">Раунд {match.round_number} | {tournament?.time_control}</div>
            </div>
            <div className="text-sm text-white/50">
              <span className="text-white font-semibold">{myName}</span>
              <span className="text-white/20 mx-2">vs</span>
              <span className="text-white font-semibold">{opponentName}</span>
            </div>
          </motion.div>

          {/* Waiting for opponent */}
          {waiting && !gameStarted && (
            <motion.div className="glass p-10 rounded-2xl text-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.div className="text-5xl mb-4" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                {'⏳'}
              </motion.div>
              <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#f59e0b' }}>
                Ожидание соперника...
              </h2>
              <p className="text-white/40 text-sm mb-4">
                Вы играете {playerColor === 'white' ? 'белыми ♔' : 'чёрными ♚'} против <strong>{opponentName}</strong>
              </p>
              <p className="text-white/20 text-xs">Партия начнётся автоматически когда оба игрока подключатся</p>
            </motion.div>
          )}

          {/* Game */}
          {gameStarted && !gameOver && (
            <motion.div className="flex justify-center"
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <ChessBoard
                difficulty={'medium' as Difficulty}
                mode="online"
                sessionId={`tournament-${matchId}`}
                playerColor={playerColor}
                timeControl={getTimeControl() || undefined}
                onGameOver={handleGameOver}
              />
            </motion.div>
          )}

          {/* Game Over */}
          {gameOver && (
            <motion.div className="glass p-10 rounded-2xl text-center"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-5xl mb-4">{'🏆'}</div>
              <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                Партия завершена!
              </h2>
              <p className="text-white/40 text-sm mb-4">Результат записан в турнирную таблицу</p>
              <p className="text-white/20 text-xs">Возврат к турниру через 5 секунд...</p>
              <motion.button onClick={() => router.push('/tournaments/' + tournamentId)}
                className="mt-4 px-6 py-2 rounded-xl text-sm font-semibold text-black"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                whileHover={{ scale: 1.05 }}>
                Вернуться к турниру
              </motion.button>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
