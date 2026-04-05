-- ═══════════════════════════════════════════════════════════════════
-- МИГРАЦИЯ v9 — Раздельный ELO, Daily Chess, Tiebreakers
-- Выполни в Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Раздельный ELO (bullet / blitz / rapid)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_bullet INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_blitz INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_rapid INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS elo_classical INTEGER DEFAULT 0;

-- 2. Daily Chess (партии по переписке)
CREATE TABLE IF NOT EXISTS daily_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  white_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  black_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting','active','finished')),
  invite_code TEXT,
  fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves_json JSONB DEFAULT '[]',
  result TEXT,
  time_per_move_hours INTEGER DEFAULT 24,
  last_move_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE daily_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "daily_select" ON daily_games FOR SELECT TO authenticated USING (true);
CREATE POLICY "daily_insert" ON daily_games FOR INSERT TO authenticated WITH CHECK (auth.uid() = white_id);
CREATE POLICY "daily_update" ON daily_games FOR UPDATE TO authenticated
  USING (auth.uid() = white_id OR auth.uid() = black_id);

GRANT ALL ON daily_games TO authenticated;

-- 3. Tiebreakers — добавляем Buchholz и Sonneborn-Berger в участников
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS buchholz NUMERIC DEFAULT 0;
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS sonneborn NUMERIC DEFAULT 0;

-- 4. Время начала и конца матча
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ;
ALTER TABLE tournament_matches ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
