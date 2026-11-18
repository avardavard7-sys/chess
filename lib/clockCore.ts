// Часы партии — чистая логика (без React), чтобы её можно было проверить тестами.
// Время в секундах. В игре по сети каждый игрок — «хозяин» своих часов: вместе с ходом он
// сообщает, сколько у него осталось, и соперник выставляет его часы по этому значению.
// Так задержка сети не накапливается и оба телефона показывают одно и то же время.

export type ClockColor = 'white' | 'black';
export interface ClockTimes {
  white: number;
  black: number;
}

export const other = (c: ClockColor): ClockColor => (c === 'white' ? 'black' : 'white');

export function initialTimes(minutes: number): ClockTimes {
  return { white: minutes * 60, black: minutes * 60 };
}

/** Списать прошедшее время с того, чей ход. flagged — у кого время вышло. */
export function tick(t: ClockTimes, turn: ClockColor, deltaSec: number): { times: ClockTimes; flagged: ClockColor | null } {
  if (!(deltaSec > 0)) return { times: t, flagged: null };
  const next = Math.max(0, t[turn] - deltaSec);
  return { times: { ...t, [turn]: next }, flagged: next <= 0 ? turn : null };
}

/** Мой ход сделан: добавка за ход. Возвращает новое время и то, что надо сообщить сопернику. */
export function afterLocalMove(t: ClockTimes, mover: ClockColor, increment: number): { times: ClockTimes; report: number } {
  const report = t[mover] + Math.max(0, increment);
  return { times: { ...t, [mover]: report }, report };
}

/**
 * Ход соперника пришёл. Если он сообщил своё время — берём его как есть (он хозяин своих часов);
 * если нет (старая версия приложения или сайта) — считаем как раньше: локальное время + добавка.
 */
export function afterRemoteMove(t: ClockTimes, mover: ClockColor, increment: number, reported?: number | null): ClockTimes {
  const ok = typeof reported === 'number' && Number.isFinite(reported) && reported >= 0 && reported <= 24 * 3600;
  return { ...t, [mover]: ok ? (reported as number) : t[mover] + Math.max(0, increment) };
}

export function formatClock(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Сколько ждём ход или сигнал соперника, когда на НАШЕМ экране его время вышло (сеть могла задержать ход) */
export const OPP_FLAG_GRACE_MS = 3000;
