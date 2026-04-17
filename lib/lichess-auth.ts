import { supabase } from './supabase';

const LICHESS_HOST = 'https://lichess.org';

// ═══ PKCE helpers ════════════════════════════════════════════════════════════

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

function base64UrlEncode(buffer: Uint8Array): string {
  let str = '';
  for (let i = 0; i < buffer.length; i++) str += String.fromCharCode(buffer[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

// ═══ OAuth ═══════════════════════════════════════════════════════════════════

export async function getLichessAuthUrl(redirectUri: string): Promise<string> {
  // Lichess не требует регистрации — clientId это просто URL нашего сайта
  const clientId = typeof window !== 'undefined' ? window.location.origin : 'https://chess-ashy-beta.vercel.app';
  const scope = 'board:play challenge:write';
  const state = Math.random().toString(36).slice(2);

  // PKCE — генерируем verifier и challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  if (typeof window !== 'undefined') {
    sessionStorage.setItem('lichess_state', state);
    sessionStorage.setItem('lichess_verifier', codeVerifier);
    // Дублируем в localStorage на случай если sessionStorage очистится
    localStorage.setItem('lichess_state', state);
    localStorage.setItem('lichess_verifier', codeVerifier);
  }

  return `${LICHESS_HOST}/oauth?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
}

export async function exchangeLichessToken(code: string, redirectUri: string): Promise<string | null> {
  try {
    // Достаём сохранённый code_verifier (сначала из session, потом из local)
    let codeVerifier: string | null = null;
    if (typeof window !== 'undefined') {
      codeVerifier = sessionStorage.getItem('lichess_verifier') || localStorage.getItem('lichess_verifier');
    }
    if (!codeVerifier) {
      console.error('Lichess: missing code_verifier');
      return null;
    }

    const clientId = typeof window !== 'undefined' ? window.location.origin : 'https://chess-ashy-beta.vercel.app';

    const res = await fetch(`${LICHESS_HOST}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: codeVerifier,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Lichess token exchange failed:', res.status, text);
      return null;
    }
    const data = await res.json();
    // Чистим verifier после успешного обмена
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('lichess_verifier');
      localStorage.removeItem('lichess_verifier');
    }
    return data.access_token || null;
  } catch (e) {
    console.error('Lichess exchange error:', e);
    return null;
  }
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

  // НЕ берём Lichess ELO — используем текущий ELO пользователя из нашей системы
  // Lichess подключается только для игры через их API, но ELO остаётся наш
  await supabase.from('profiles').update({
    lichess_username: profile.username,
    lichess_token: token,
    // lichess_rating НЕ перезаписываем — ELO остаётся прежним
  }).eq('id', userId);

  // КРИТИЧНО: сохраняем токен в localStorage для онлайн-режима
  // и очищаем старый кеш юзера (чтобы не показывало "Dark Horse")
  if (typeof window !== 'undefined') {
    localStorage.setItem('net_token', token);
    localStorage.removeItem('net_user');
  }
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
