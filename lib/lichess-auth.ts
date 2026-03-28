import { supabase } from './supabase';

const LICHESS_HOST = 'https://lichess.org';

// ═══ OAuth ═══════════════════════════════════════════════════════════════════

export function getLichessAuthUrl(redirectUri: string) {
  const clientId = 'hodkonem-chess-school';
  const scope = 'board:play challenge:write';
  const state = Math.random().toString(36).slice(2);
  if (typeof window !== 'undefined') sessionStorage.setItem('lichess_state', state);
  return `${LICHESS_HOST}/oauth?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge_method=S256`;
}

export async function exchangeLichessToken(code: string, redirectUri: string): Promise<string | null> {
  try {
    const res = await fetch(`${LICHESS_HOST}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: 'hodkonem-chess-school',
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch { return null; }
}

export async function getLichessProfile(token: string) {
  try {
    const res = await fetch(`${LICHESS_HOST}/api/account`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

export async function saveLichessToken(userId: string, token: string) {
  const profile = await getLichessProfile(token);
  if (!profile) return null;
  const blitzRating = profile.perfs?.blitz?.rating || profile.perfs?.rapid?.rating || 1500;
  await supabase.from('profiles').update({
    lichess_username: profile.username,
    lichess_token: token,
    lichess_rating: blitzRating,
  }).eq('id', userId);
  return profile;
}

// ═══ Online status ═══════════════════════════════════════════════════════════

export async function setOnline(userId: string, online: boolean) {
  await supabase.from('profiles').update({
    is_online: online,
    last_seen: new Date().toISOString(),
  }).eq('id', userId);
}

export async function getOnlinePlayers() {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await supabase.from('profiles')
    .select('id, username, elo_rating, lichess_username, lichess_rating, is_online')
    .eq('is_online', true)
    .gte('last_seen', fiveMinAgo);
  return data || [];
}

// ═══ Live Games ══════════════════════════════════════════════════════════════

export async function createLiveGame(data: {
  white_id: string; black_id?: string;
  white_name: string; black_name: string;
  mode: string; tournament_id?: string; tournament_match_id?: string;
}) {
  const { data: game, error } = await supabase.from('live_games').insert({
    ...data, status: 'active',
  }).select().single();
  if (error) throw error;
  return game;
}

export async function updateLiveGame(gameId: string, fen: string, moves: object[]) {
  await supabase.from('live_games').update({
    fen, moves_json: moves,
  }).eq('id', gameId);
}

export async function finishLiveGame(gameId: string, result: string) {
  await supabase.from('live_games').update({
    status: 'finished', result, finished_at: new Date().toISOString(),
  }).eq('id', gameId);
}

export async function getActiveLiveGames() {
  const { data } = await supabase.from('live_games')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false });
  return data || [];
}

export async function getLiveGame(id: string) {
  const { data } = await supabase.from('live_games').select('*').eq('id', id).single();
  return data;
}

// ═══ Tournament Results ══════════════════════════════════════════════════════

export async function saveTournamentResult(data: {
  tournament_id: string; match_id: string; round_number: number;
  white_id: string; black_id: string;
  white_name: string; black_name: string;
  result: string; moves_json: object[]; final_fen: string;
}) {
  await supabase.from('tournament_results').insert(data);
}

export async function getTournamentResults(tournamentId: string) {
  const { data } = await supabase.from('tournament_results')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round_number', { ascending: true });
  return data || [];
}
