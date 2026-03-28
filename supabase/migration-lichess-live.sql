-- ═══════════════════════════════════════════════════════════════════════════════
-- LICHESS OAUTH + LIVE GAMES + TOURNAMENT RESULTS
-- Копируй ЦЕЛИКОМ в Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Lichess аккаунт привязка
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lichess_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lichess_token TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lichess_rating INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_game_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

-- 2. Live games (активные партии для стриминга)
CREATE TABLE IF NOT EXISTS live_games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  white_id UUID REFERENCES auth.users(id),
  black_id UUID REFERENCES auth.users(id),
  white_name TEXT,
  black_name TEXT,
  mode TEXT DEFAULT 'online',
  tournament_id UUID REFERENCES tournaments(id),
  tournament_match_id UUID REFERENCES tournament_matches(id),
  fen TEXT DEFAULT 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves_json JSONB DEFAULT '[]',
  status TEXT DEFAULT 'active' CHECK (status IN ('active','finished','aborted')),
  result TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

-- 3. Tournament results (история всех партий турнира)
CREATE TABLE IF NOT EXISTS tournament_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  match_id UUID REFERENCES tournament_matches(id),
  round_number INTEGER NOT NULL,
  white_id UUID REFERENCES auth.users(id),
  black_id UUID REFERENCES auth.users(id),
  white_name TEXT,
  black_name TEXT,
  result TEXT,
  moves_json JSONB DEFAULT '[]',
  final_fen TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE live_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read live games" ON live_games FOR SELECT TO authenticated USING (true);
CREATE POLICY "Players manage own live games" ON live_games FOR ALL TO authenticated
  USING (auth.uid() = white_id OR auth.uid() = black_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Anyone can insert live games" ON live_games FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Anyone can read tournament results" ON tournament_results FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tournament results" ON tournament_results FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "Players insert results" ON tournament_results FOR INSERT TO authenticated WITH CHECK (true);

GRANT ALL ON live_games TO authenticated;
GRANT ALL ON tournament_results TO authenticated;

-- Realtime для стриминга
ALTER PUBLICATION supabase_realtime ADD TABLE live_games;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
