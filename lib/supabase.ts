import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { data, error };
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return { data, error };
}

export async function updateElo(userId: string, newElo: number, result: 'win' | 'loss' | 'draw') {
  const { data: profile } = await getProfile(userId);
  if (!profile) return;
  const { getRank } = await import('./elo');
  const updates: Record<string, number | string> = {
    elo_rating: newElo,
    rank: getRank(newElo),
    games_played: (profile.games_played || 0) + 1,
  };
  if (result === 'win') updates.games_won = (profile.games_won || 0) + 1;
  else if (result === 'loss') updates.games_lost = (profile.games_lost || 0) + 1;
  else updates.games_draw = (profile.games_draw || 0) + 1;
  return supabase.from('profiles').update(updates).eq('id', userId);
}

export async function addToMatchmakingQueue(userId: string, eloRating: number) {
  return supabase.from('matchmaking_queue').upsert(
    { user_id: userId, elo_rating: eloRating, joined_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  );
}

export async function removeFromMatchmakingQueue(userId: string) {
  return supabase.from('matchmaking_queue').delete().eq('user_id', userId);
}

export async function findMatch(userId: string, userElo: number) {
  const { data } = await supabase
    .from('matchmaking_queue')
    .select('*')
    .neq('user_id', userId)
    .gte('elo_rating', userElo - 200)
    .lte('elo_rating', userElo + 200)
    .order('joined_at', { ascending: true })
    .limit(1);
  if (data && data.length > 0) return data[0];
  const { data: anyPlayer } = await supabase
    .from('matchmaking_queue')
    .select('*')
    .neq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1);
  return anyPlayer && anyPlayer.length > 0 ? anyPlayer[0] : null;
}

export async function createGameSession(playerWhite: string, playerBlack: string, mode: string) {
  const { data, error } = await supabase
    .from('game_sessions')
    .insert({ player_white: playerWhite, player_black: playerBlack, mode, status: 'active' })
    .select()
    .single();
  return { data, error };
}

export async function getGameHistory(userId: string, limit = 10) {
  const { data, error } = await supabase
    .from('game_history')
    .select('*, opponent:profiles!game_history_opponent_id_fkey(username, avatar_url, elo_rating)')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(limit);
  return { data, error };
}
