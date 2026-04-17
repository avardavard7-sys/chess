import { supabase } from './supabase';

export interface Tournament {
  id: string; name: string; description: string; status: string;
  format: string; time_control: string; max_participants: number;
  current_round: number; total_rounds: number;
  start_time: string; end_time: string; duration_hours: number;
  created_by: string; winner_id: string | null; second_id: string | null; third_id: string | null;
  created_at: string;
}

export interface TournamentParticipant {
  id: string; tournament_id: string; user_id: string; status: string;
  seed: number; wins: number; losses: number; draws: number; points: number;
  tournament_rating: number; joined_at: string; streak: number;
  buchholz: number; sonneborn: number;
  profiles?: { username: string; avatar_url: string; elo_rating: number; puzzle_rating: number };
}

export interface TournamentMatch {
  id: string; tournament_id: string; round_id: string; round_number: number;
  white_id: string | null; black_id: string | null; winner_id: string | null;
  result: string; status: string; start_time: string;
}

// ═══ Auth helper ═════════════════════════════════════════════════════════════

async function getAuthUser() {
  for (let i = 0; i < 3; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session.user;
    await new Promise(r => setTimeout(r, 500));
  }
  return null;
}

// ═══ CRUD ════════════════════════════════════════════════════════════════════

export async function createTournament(data: {
  name: string; description: string; format: string;
  time_control: string; max_participants: number;
  duration_hours: number; start_time: string;
}) {
  const user = await getAuthUser();
  if (!user) throw new Error('Не авторизован');
  const endTime = new Date(new Date(data.start_time).getTime() + data.duration_hours * 60 * 60 * 1000);
  const totalRounds = data.format === 'knockout' || data.format === 'double_elimination'
    ? Math.ceil(Math.log2(data.max_participants))
    : data.format === 'round_robin'
    ? data.max_participants - 1
    : Math.min(data.max_participants - 1, 9);
  const { data: tournament, error } = await supabase.from('tournaments').insert({
    ...data, end_time: endTime.toISOString(), total_rounds: totalRounds, created_by: user.id,
  }).select().single();
  if (error) throw error;
  return tournament;
}

export async function joinTournament(tournamentId: string) {
  const user = await getAuthUser();
  if (!user) throw new Error('Не авторизован');
  const { data: existing } = await supabase.from('tournament_participants')
    .select('id').eq('tournament_id', tournamentId).eq('user_id', user.id);
  if (existing && existing.length > 0) return;
  const { data: profile } = await supabase.from('profiles').select('elo_rating').eq('id', user.id).single();
  const { error } = await supabase.from('tournament_participants').insert({
    tournament_id: tournamentId, user_id: user.id, tournament_rating: profile?.elo_rating || 1200,
  }).select().single();
  if (error) throw new Error(error.message);
}

export async function leaveTournament(tournamentId: string) {
  const user = await getAuthUser();
  if (!user) return;
  await supabase.from('tournament_participants').delete()
    .eq('tournament_id', tournamentId).eq('user_id', user.id);
}

// ═══ Knockout Bracket ════════════════════════════════════════════════════════

export async function generateKnockoutBracket(tournamentId: string) {
  const participants = await getTournamentParticipants(tournamentId);
  const registered = participants.filter(p => p.status === 'registered');
  if (registered.length < 2) throw new Error('Минимум 2 участника');
  const sorted = [...registered].sort((a, b) => (b.tournament_rating || 0) - (a.tournament_rating || 0));
  for (let i = 0; i < sorted.length; i++) {
    await supabase.from('tournament_participants').update({ seed: i + 1, status: 'active' }).eq('id', sorted[i].id);
  }
  const { data: round } = await supabase.from('tournament_rounds').insert({
    tournament_id: tournamentId, round_number: 1, status: 'upcoming',
  }).select().single();
  if (!round) throw new Error('Failed to create round');
  const matches = [];
  const n = sorted.length;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    matches.push({
      tournament_id: tournamentId, round_id: round.id, round_number: 1,
      white_id: sorted[i].user_id, black_id: sorted[n - 1 - i].user_id,
      result: 'pending', status: 'pending',
    });
  }
  if (n % 2 === 1) {
    matches.push({
      tournament_id: tournamentId, round_id: round.id, round_number: 1,
      white_id: sorted[Math.floor(n / 2)].user_id, black_id: null,
      result: 'bye', status: 'finished',
    });
  }
  await supabase.from('tournament_matches').insert(matches);
  await supabase.from('tournaments').update({ status: 'active', current_round: 1 }).eq('id', tournamentId);
  return { round, matchCount: matches.length };
}

// ═══ Swiss Pairing ══════════════════════════════════════════════════════════

export async function generateSwissRound(tournamentId: string) {
  const participants = await getTournamentParticipants(tournamentId);
  const active = participants.filter(p => p.status === 'active' || p.status === 'registered');
  if (active.length < 2) throw new Error('Минимум 2 участника');

  const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
  if (!tournament) throw new Error('Турнир не найден');

  const nextRound = (tournament.current_round || 0) + 1;

  // Сортируем по очкам, потом по рейтингу
  const sorted = [...active].sort((a, b) => b.points - a.points || (b.tournament_rating || 0) - (a.tournament_rating || 0));

  // Делаем всех active
  for (const p of sorted) {
    if (p.status === 'registered') {
      await supabase.from('tournament_participants').update({ status: 'active' }).eq('id', p.id);
    }
  }

  const { data: round } = await supabase.from('tournament_rounds').insert({
    tournament_id: tournamentId, round_number: nextRound, status: 'upcoming',
  }).select().single();

  // Получаем предыдущие матчи чтобы избежать повторных встреч
  const prevMatches = await getTournamentMatches(tournamentId);
  const played = new Set<string>();
  prevMatches.forEach(m => {
    if (m.white_id && m.black_id) {
      played.add(`${m.white_id}-${m.black_id}`);
      played.add(`${m.black_id}-${m.white_id}`);
    }
  });

  // Dutch system: верхняя половина группы очков vs нижняя
  const matches = [];
  const paired = new Set<string>();

  for (let i = 0; i < sorted.length; i++) {
    if (paired.has(sorted[i].user_id)) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      if (paired.has(sorted[j].user_id)) continue;
      const key = `${sorted[i].user_id}-${sorted[j].user_id}`;
      if (!played.has(key)) {
        matches.push({
          tournament_id: tournamentId, round_id: round!.id, round_number: nextRound,
          white_id: sorted[i].user_id, black_id: sorted[j].user_id,
          result: 'pending', status: 'pending',
        });
        paired.add(sorted[i].user_id);
        paired.add(sorted[j].user_id);
        break;
      }
    }
  }

  // BYE для оставшихся
  sorted.forEach(p => {
    if (!paired.has(p.user_id)) {
      matches.push({
        tournament_id: tournamentId, round_id: round!.id, round_number: nextRound,
        white_id: p.user_id, black_id: null, result: 'bye', status: 'finished',
      });
    }
  });

  await supabase.from('tournament_matches').insert(matches);
  await supabase.from('tournaments').update({
    status: 'active', current_round: nextRound,
  }).eq('id', tournamentId);

  return { round, matchCount: matches.length };
}

// ═══ Round Robin ═════════════════════════════════════════════════════════════

export async function generateRoundRobinRound(tournamentId: string) {
  return generateSwissRound(tournamentId); // Same pairing logic works
}

// ═══ Advance Round (knockout) ════════════════════════════════════════════════

export async function advanceToNextRound(tournamentId: string) {
  const { data: tournament } = await supabase.from('tournaments').select('*').eq('id', tournamentId).single();
  if (!tournament) throw new Error('Tournament not found');
  const currentRound = tournament.current_round;
  const { data: matches } = await supabase.from('tournament_matches')
    .select('*').eq('tournament_id', tournamentId).eq('round_number', currentRound);
  if (!matches) return;
  const pending = matches.filter(m => m.status !== 'finished');
  if (pending.length > 0) throw new Error(`Ещё ${pending.length} незавершённых матчей`);
  const winners = matches.filter(m => m.winner_id).map(m => m.winner_id!);
  const losers = matches.filter(m => m.winner_id && m.result !== 'bye')
    .map(m => m.white_id === m.winner_id ? m.black_id : m.white_id);
  for (const loserId of losers) {
    if (loserId) await supabase.from('tournament_participants').update({ status: 'eliminated' })
      .eq('tournament_id', tournamentId).eq('user_id', loserId);
  }
  if (winners.length <= 1) {
    await supabase.from('tournaments').update({ status: 'finished', winner_id: winners[0] || null }).eq('id', tournamentId);
    // Автоматическое начисление баллов после турнира
    await awardTournamentPoints(tournamentId);
    return { finished: true };
  }
  const nextRound = currentRound + 1;
  const { data: round } = await supabase.from('tournament_rounds').insert({
    tournament_id: tournamentId, round_number: nextRound, status: 'upcoming',
  }).select().single();
  const newMatches = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (i + 1 < winners.length) {
      newMatches.push({
        tournament_id: tournamentId, round_id: round!.id, round_number: nextRound,
        white_id: winners[i], black_id: winners[i + 1], result: 'pending', status: 'pending',
      });
    } else {
      newMatches.push({
        tournament_id: tournamentId, round_id: round!.id, round_number: nextRound,
        white_id: winners[i], black_id: null, result: 'bye', status: 'finished',
      });
    }
  }
  await supabase.from('tournament_matches').insert(newMatches);
  await supabase.from('tournaments').update({ current_round: nextRound }).eq('id', tournamentId);
  return { finished: false, nextRound };
}

// ═══ Report Match + Update Stats ═════════════════════════════════════════════

export async function reportMatchResult(matchId: string, result: 'white' | 'black' | 'draw') {
  const { data: match } = await supabase.from('tournament_matches').select('*').eq('id', matchId).single();
  if (!match) throw new Error('Match not found');
  const winnerId = result === 'white' ? match.white_id : result === 'black' ? match.black_id : null;
  await supabase.from('tournament_matches').update({
    result, winner_id: winnerId, status: 'finished', end_time: new Date().toISOString(),
  }).eq('id', matchId);

  // Обновляем статистику участников
  const tid = match.tournament_id;
  if (match.white_id) {
    const whiteResult = result === 'white' ? 'win' : result === 'draw' ? 'draw' : 'loss';
    await updateParticipantStats(tid, match.white_id, whiteResult);
  }
  if (match.black_id) {
    const blackResult = result === 'black' ? 'win' : result === 'draw' ? 'draw' : 'loss';
    await updateParticipantStats(tid, match.black_id, blackResult);
  }

  // Пересчитываем тайбрейки
  await recalculateTiebreakers(tid);
}

async function updateParticipantStats(tournamentId: string, userId: string, result: 'win' | 'loss' | 'draw') {
  const { data: p } = await supabase.from('tournament_participants')
    .select('*').eq('tournament_id', tournamentId).eq('user_id', userId).single();
  if (!p) return;

  const wins = (p.wins || 0) + (result === 'win' ? 1 : 0);
  const losses = (p.losses || 0) + (result === 'loss' ? 1 : 0);
  const draws = (p.draws || 0) + (result === 'draw' ? 1 : 0);
  const streak = result === 'win' ? (p.streak || 0) + 1 : 0;

  // Streak bonus: 1й win = 1pt, 2й подряд = 1.5pt, 3+ подряд = 2pt
  let pointsForGame = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  if (result === 'win' && streak >= 3) pointsForGame = 2;
  else if (result === 'win' && streak >= 2) pointsForGame = 1.5;

  const points = (p.points || 0) + pointsForGame;

  await supabase.from('tournament_participants').update({
    wins, losses, draws, points, streak,
  }).eq('id', p.id);
}

// ═══ Tiebreakers ═════════════════════════════════════════════════════════════

export async function recalculateTiebreakers(tournamentId: string) {
  const participants = await getTournamentParticipants(tournamentId);
  const matches = await getTournamentMatches(tournamentId);

  const pointsMap = new Map(participants.map(p => [p.user_id, p.points || 0]));

  for (const p of participants) {
    // Buchholz — сумма очков всех соперников
    let buchholz = 0;
    let sonneborn = 0;
    const opponentIds: string[] = [];

    matches.forEach(m => {
      let opponentId: string | null = null;
      let myResult: string | null = null;
      if (m.white_id === p.user_id && m.black_id) {
        opponentId = m.black_id;
        myResult = m.result === 'white' ? 'win' : m.result === 'draw' ? 'draw' : 'loss';
      } else if (m.black_id === p.user_id && m.white_id) {
        opponentId = m.white_id;
        myResult = m.result === 'black' ? 'win' : m.result === 'draw' ? 'draw' : 'loss';
      }
      if (opponentId && m.status === 'finished') {
        const oppPoints = pointsMap.get(opponentId) || 0;
        buchholz += oppPoints;
        opponentIds.push(opponentId);
        // Sonneborn-Berger: сумма очков побеждённых + половина очков ничейных
        if (myResult === 'win') sonneborn += oppPoints;
        else if (myResult === 'draw') sonneborn += oppPoints * 0.5;
      }
    });

    // Buchholz Cut-1: убираем минимального соперника
    if (opponentIds.length > 1) {
      const oppScores = opponentIds.map(id => pointsMap.get(id) || 0).sort((a, b) => a - b);
      const buchholzCut1 = oppScores.slice(1).reduce((s, v) => s + v, 0);
      buchholz = buchholzCut1;
    }

    await supabase.from('tournament_participants').update({
      buchholz: Math.round(buchholz * 100) / 100,
      sonneborn: Math.round(sonneborn * 100) / 100,
    }).eq('id', p.id);
  }
}

// ═══ Getters ═════════════════════════════════════════════════════════════════

export async function getTournaments() {
  const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false });
  return data || [];
}

export async function getTournament(id: string) {
  const { data } = await supabase.from('tournaments').select('*').eq('id', id).single();
  return data;
}

export async function getTournamentParticipants(tournamentId: string) {
  const { data, error } = await supabase.from('tournament_participants')
    .select('*').eq('tournament_id', tournamentId)
    .order('points', { ascending: false });
  if (error || !data || data.length === 0) return [];
  const userIds = data.map(p => p.user_id);
  const { data: profiles } = await supabase.from('profiles')
    .select('id, username, avatar_url, elo_rating, puzzle_rating').in('id', userIds);
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  return data.map(p => ({
    ...p,
    profiles: profileMap.get(p.user_id) || { username: 'Игрок', avatar_url: '', elo_rating: 0, puzzle_rating: 1200 },
  }));
}

export async function getTournamentMatches(tournamentId: string) {
  const { data } = await supabase.from('tournament_matches')
    .select('*').eq('tournament_id', tournamentId).order('round_number', { ascending: true });
  return data || [];
}

export async function isAdmin(): Promise<boolean> {
  const user = await getAuthUser();
  if (!user) return false;
  const { data } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  return data?.is_admin === true;
}

// ═══ Standings (сортировка с тайбрейками) ════════════════════════════════════

export function sortStandings(participants: TournamentParticipant[]): TournamentParticipant[] {
  return [...participants].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if ((b.buchholz || 0) !== (a.buchholz || 0)) return (b.buchholz || 0) - (a.buchholz || 0);
    if ((b.sonneborn || 0) !== (a.sonneborn || 0)) return (b.sonneborn || 0) - (a.sonneborn || 0);
    if (b.wins !== a.wins) return b.wins - a.wins;
    return (b.profiles?.elo_rating || 0) - (a.profiles?.elo_rating || 0);
  });
}

// ═══ Автоматические баллы после турнира ═══════════════════════════════════════

async function awardTournamentPoints(tournamentId: string) {
  try {
    // Получаем участников с результатами
    const { data: participants } = await supabase.from('tournament_participants')
      .select('user_id, wins, losses, draws, points')
      .eq('tournament_id', tournamentId);
    if (!participants || participants.length === 0) return;

    // Сортируем по очкам для определения мест
    const sorted = [...participants].sort((a, b) => b.points - a.points);

    // Получаем всех учеников школы
    const { data: students } = await supabase.from('school_students').select('*');
    if (!students || students.length === 0) return;

    // Получаем профили участников для связки по имени
    const userIds = participants.map(p => p.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds);
    if (!profiles) return;

    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      const profile = profiles.find(pr => pr.id === p.user_id);
      if (!profile) continue;

      // Ищем ученика по profile_id или по имени
      let student = students.find(s => s.profile_id === p.user_id);
      if (!student) student = students.find(s => s.full_name.toLowerCase() === profile.username.toLowerCase());
      if (!student) continue;

      // Считаем баллы
      let points = 0;
      // За место
      if (i === 0) points += 50;      // 1 место
      else if (i === 1) points += 35;  // 2 место
      else if (i === 2) points += 25;  // 3 место
      else points += 5;                // участие

      // За результаты
      points += (p.wins || 0) * 10;    // +10 за победу
      points += (p.draws || 0) * 5;    // +5 за ничью
      points += (p.losses || 0) * 2;   // +2 за поражение (участие)

      // Обновляем рейтинг ученика
      const newRating = student.rating + points;
      const history = [...(student.rating_history || []), { date: new Date().toLocaleDateString('ru-RU'), rating: newRating }];
      await supabase.from('school_students').update({ rating: newRating, rating_history: history }).eq('id', student.id);
    }
  } catch (e) {
    console.error('Award tournament points error:', e);
  }
}
