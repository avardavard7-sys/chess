export function calculateEloChange(
  playerElo: number,
  opponentElo: number,
  result: 'win' | 'loss' | 'draw',
  gamesPlayed: number
): number {
  // Для расчётов используем минимум 800 — чтобы новички с ELO 0 тоже получали нормальные изменения
  // Иначе при player=0, opponent=1500 expected ≈ 0 → change округляется к 0
  const effectivePlayerElo = Math.max(playerElo, 800);
  const effectiveOpponentElo = Math.max(opponentElo, 800);

  const K = gamesPlayed < 30 ? 40 : gamesPlayed < 100 ? 20 : 10;
  const expected = 1 / (1 + Math.pow(10, (effectiveOpponentElo - effectivePlayerElo) / 400));
  const actual = result === 'win' ? 1 : result === 'draw' ? 0.5 : 0;
  const change = Math.round(K * (actual - expected));

  // Минимум ±1 при победе/поражении — чтобы ELO всегда двигался
  if (result === 'win' && change < 1) return 1;
  if (result === 'loss' && change > -1) return -1;
  return change;
}

export function getRank(elo: number): string {
  if (elo < 200) return '👶 Малыш';
  if (elo < 700) return '🌱 Новичок';
  if (elo < 1200) return '⚔️ Любитель';
  if (elo < 1600) return '🎯 Разрядник';
  if (elo < 2000) return '🔥 Кандидат в мастера';
  if (elo < 2400) return '🏆 Мастер';
  return '👑 Гроссмейстер';
}

export function getNextRankThreshold(elo: number): number {
  if (elo < 200) return 200;
  if (elo < 700) return 700;
  if (elo < 1200) return 1200;
  if (elo < 1600) return 1600;
  if (elo < 2000) return 2000;
  if (elo < 2400) return 2400;
  return 3000;
}

export function getPrevRankThreshold(elo: number): number {
  if (elo < 200) return 0;
  if (elo < 700) return 200;
  if (elo < 1200) return 700;
  if (elo < 1600) return 1200;
  if (elo < 2000) return 1600;
  if (elo < 2400) return 2000;
  return 2400;
}

export function getRankProgress(elo: number): number {
  const prev = getPrevRankThreshold(elo);
  const next = getNextRankThreshold(elo);
  return Math.round(((elo - prev) / (next - prev)) * 100);
}
