// Internal chess network integration — no external branding exposed in UI

const ENGINE_BASE = 'https://lichess.org';
const CLIENT_ID = 'hod-konem-chess';

// ─── PKCE helpers ─────────────────────────────────────────────────────────────

function generateVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

async function generateChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function getRedirectUri(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/auth/network`;
}

export async function startOAuth(): Promise<void> {
  const verifier = generateVerifier();
  const challenge = await generateChallenge(verifier);

  sessionStorage.setItem('net_verifier', verifier);
  sessionStorage.setItem('net_return', window.location.href);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: 'board:play',
  });

  window.location.href = `${ENGINE_BASE}/oauth?${params}`;
}

export async function exchangeCode(code: string): Promise<string> {
  const verifier = sessionStorage.getItem('net_verifier');
  if (!verifier) throw new Error('Missing verifier');

  const res = await fetch(`${ENGINE_BASE}/api/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: getRedirectUri(),
      client_id: CLIENT_ID,
    }),
  });

  if (!res.ok) throw new Error('Token exchange failed');
  const data = await res.json();
  sessionStorage.removeItem('net_verifier');
  return data.access_token;
}

export function saveToken(token: string): void {
  localStorage.setItem('net_token', token);
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  // First check admin global token from env (set by site owner)
  const adminToken = process.env.NEXT_PUBLIC_NETWORK_TOKEN;
  if (adminToken) return adminToken;
  // Fallback to user's own token
  return localStorage.getItem('net_token');
}

export function hasAdminToken(): boolean {
  return !!process.env.NEXT_PUBLIC_NETWORK_TOKEN;
}

export function clearToken(): void {
  localStorage.removeItem('net_token');
  localStorage.removeItem('net_user');
}

export function hasToken(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(process.env.NEXT_PUBLIC_NETWORK_TOKEN || localStorage.getItem('net_token'));
}

// ─── Account ──────────────────────────────────────────────────────────────────

export interface NetworkUser {
  id: string;
  username: string;
  rating: number;
}

export async function getNetworkUser(token: string): Promise<NetworkUser> {
  const res = await fetch(`${ENGINE_BASE}/api/account`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to get user');
  const data = await res.json();
  return {
    id: data.id,
    username: data.username,
    rating: data.perfs?.rapid?.rating || data.perfs?.blitz?.rating || 1500,
  };
}

// ─── Game seek ────────────────────────────────────────────────────────────────

export async function createSeek(token: string, signal?: AbortSignal): Promise<void> {
  try {
    const res = await fetch(`${ENGINE_BASE}/api/board/seek`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        rated: 'false',
        time: '10',
        increment: '5',
        color: 'random',
      }),
      signal,
    });

    if (!res.ok) {
      console.error('Seek failed:', res.status);
      return;
    }

    // Keep reading to hold the connection open (seek is active while connected)
    if (res.body) {
      const reader = res.body.getReader();
      while (true) {
        const { done } = await reader.read();
        if (done || signal?.aborted) break;
      }
    }
  } catch (err: unknown) {
    if ((err as Error)?.name !== 'AbortError') {
      console.error('Seek error:', err);
    }
  }
}

export async function cancelSeek(token: string): Promise<void> {
  // Seeking is cancelled by closing the seek stream or just not responding
  // We abort by sending a new seek request or by letting the stream timeout
  // In practice, closing the event stream connection is enough
}

// ─── Event stream ─────────────────────────────────────────────────────────────

export type NetworkEvent =
  | { type: 'gameStart'; game: { gameId: string; color: string; compat: { board: boolean } } }
  | { type: 'gameFinish'; game: { gameId: string } }
  | { type: 'challenge'; challenge: { id: string } }
  | { type: 'ping' };

export function streamEvents(
  token: string,
  onEvent: (event: NetworkEvent) => void,
  signal: AbortSignal
): void {
  (async () => {
    try {
      const res = await fetch(`${ENGINE_BASE}/api/stream/event`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done || signal.aborted) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          try {
            const event = JSON.parse(line) as NetworkEvent;
            onEvent(event);
          } catch {}
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('Event stream error:', err);
      }
    }
  })();
}

// ─── Game stream ──────────────────────────────────────────────────────────────

export interface GameFull {
  type: 'gameFull';
  id: string;
  white: { id: string; name: string; rating?: number };
  black: { id: string; name: string; rating?: number };
  state: GameState;
  clock?: { initial: number; increment: number };
}

export interface GameState {
  type: 'gameState';
  moves: string; // space-separated UCI moves e.g. "e2e4 e7e5 g1f3"
  wtime: number;
  btime: number;
  winc: number;
  binc: number;
  status: string;
  winner?: string;
}

export type GameEvent = GameFull | GameState | { type: 'opponentGone'; gone: boolean; claimWinInSeconds?: number };

export function streamGame(
  token: string,
  gameId: string,
  onEvent: (event: GameEvent) => void,
  signal: AbortSignal
): void {
  (async () => {
    try {
      const res = await fetch(`${ENGINE_BASE}/api/board/game/stream/${gameId}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });

      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done || signal.aborted) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          try {
            const event = JSON.parse(line) as GameEvent;
            onEvent(event);
          } catch {}
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        console.error('Game stream error:', err);
      }
    }
  })();
}

// ─── Moves ────────────────────────────────────────────────────────────────────

export async function sendMove(token: string, gameId: string, uciMove: string): Promise<boolean> {
  try {
    const res = await fetch(`${ENGINE_BASE}/api/board/game/${gameId}/move/${uciMove}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function resignGame(token: string, gameId: string): Promise<void> {
  await fetch(`${ENGINE_BASE}/api/board/game/${gameId}/resign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function sendDrawOffer(token: string, gameId: string, accept: boolean): Promise<void> {
  const action = accept ? 'yes' : 'no';
  await fetch(`${ENGINE_BASE}/api/board/game/${gameId}/draw/${action}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── FEN from moves ───────────────────────────────────────────────────────────

export function parseMoves(movesStr: string): string[] {
  if (!movesStr.trim()) return [];
  return movesStr.trim().split(' ').filter(Boolean);
}

export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
