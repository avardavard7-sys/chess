import { supabase } from './supabase';

// Glicko-подобная система: K-фактор зависит от количества решённых задач
function getKFactor(games: number): number {
  if (games < 10) return 40;
  if (games < 30) return 30;
  return 20;
}

export function calculatePuzzleRating(
  userRating: number,
  puzzleRating: number,
  solved: boolean,
  gamesPlayed: number
): number {
  const K = getKFactor(gamesPlayed);
  const expected = 1 / (1 + Math.pow(10, (puzzleRating - userRating) / 400));
  const score = solved ? 1 : 0;
  const change = Math.round(K * (score - expected));
  return Math.max(100, userRating + change);
}

export async function updatePuzzleRating(
  userId: string,
  puzzleId: string,
  puzzleRating: number,
  solved: boolean
): Promise<{ newRating: number; change: number }> {
  // Получаем текущий рейтинг
  const { data: profile } = await supabase
    .from('profiles')
    .select('puzzle_rating, puzzle_games')
    .eq('id', userId)
    .single();

  const currentRating = profile?.puzzle_rating || 1200;
  const games = profile?.puzzle_games || 0;
  const newRating = calculatePuzzleRating(currentRating, puzzleRating, solved, games);
  const change = newRating - currentRating;

  // Обновляем профиль
  await supabase
    .from('profiles')
    .update({
      puzzle_rating: newRating,
      puzzle_games: games + 1,
    })
    .eq('id', userId);

  // Сохраняем историю
  await supabase.from('puzzle_rating_history').insert({
    user_id: userId,
    puzzle_id: puzzleId,
    puzzle_rating: puzzleRating,
    user_rating_before: currentRating,
    user_rating_after: newRating,
    solved,
  });

  return { newRating, change };
}

export async function getPuzzleRatingHistory(userId: string, limit = 50) {
  const { data } = await supabase
    .from('puzzle_rating_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}
