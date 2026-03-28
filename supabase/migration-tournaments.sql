-- ═══════════════════════════════════════════════════════════════════════════════
-- ТУРНИРЫ + АДМИН + PUZZLE ELO — копируй ЦЕЛИКОМ в Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Админы (поле в profiles)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS puzzle_rating INTEGER DEFAULT 1200;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS puzzle_games INTEGER DEFAULT 0;

-- 2. Турниры
CREATE TABLE IF NOT EXISTS tournaments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','paused','finished')),
  format TEXT DEFAULT 'knockout' CHECK (format IN ('knockout','swiss')),
  time_control TEXT DEFAULT '10+0',
  max_participants INTEGER DEFAULT 32,
  current_round INTEGER DEFAULT 0,
  total_rounds INTEGER DEFAULT 5,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_hours INTEGER DEFAULT 24,
  created_by UUID REFERENCES auth.users(id),
  winner_id UUID REFERENCES profiles(id),
  second_id UUID REFERENCES profiles(id),
  third_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Участники турнира
CREATE TABLE IF NOT EXISTS tournament_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered','active','eliminated','winner')),
  seed INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  points REAL DEFAULT 0,
  tournament_rating INTEGER DEFAULT 1200,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- 4. Раунды турнира
CREATE TABLE IF NOT EXISTS tournament_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  round_number INTEGER NOT NULL,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','finished')),
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Матчи турнира
CREATE TABLE IF NOT EXISTS tournament_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  round_id UUID REFERENCES tournament_rounds(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  white_id UUID REFERENCES auth.users(id),
  black_id UUID REFERENCES auth.users(id),
  winner_id UUID REFERENCES auth.users(id),
  result TEXT CHECK (result IN ('white','black','draw','bye','pending')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','finished')),
  moves_json JSONB DEFAULT '[]',
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Puzzle Rating History
CREATE TABLE IF NOT EXISTS puzzle_rating_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  puzzle_id TEXT NOT NULL,
  puzzle_rating INTEGER NOT NULL,
  user_rating_before INTEGER NOT NULL,
  user_rating_after INTEGER NOT NULL,
  solved BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ RLS Policies ════════════════════════════════════════════════════════════

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE puzzle_rating_history ENABLE ROW LEVEL SECURITY;

-- Tournaments — все видят, только админ создаёт/редактирует
CREATE POLICY "Anyone can read tournaments" ON tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tournaments" ON tournaments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Participants — все видят, свои записи создают
CREATE POLICY "Anyone can read participants" ON tournament_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users join tournaments" ON tournament_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage participants" ON tournament_participants FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Rounds — все видят
CREATE POLICY "Anyone can read rounds" ON tournament_rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage rounds" ON tournament_rounds FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Matches — все видят, игроки обновляют свои
CREATE POLICY "Anyone can read matches" ON tournament_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Players update own matches" ON tournament_matches FOR UPDATE TO authenticated
  USING (auth.uid() = white_id OR auth.uid() = black_id);
CREATE POLICY "Admins manage matches" ON tournament_matches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Puzzle rating — свои видят и создают
CREATE POLICY "Users read own puzzle history" ON puzzle_rating_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own puzzle history" ON puzzle_rating_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Grants
GRANT ALL ON tournaments TO authenticated;
GRANT ALL ON tournament_participants TO authenticated;
GRANT ALL ON tournament_rounds TO authenticated;
GRANT ALL ON tournament_matches TO authenticated;
GRANT ALL ON puzzle_rating_history TO authenticated;

-- ═══ Realtime ════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_participants;

-- ═══ Сделать первого админа (ЗАМЕНИ user_id НА СВОЙ!) ════════════════════════
-- Чтобы узнать свой user_id:
-- SELECT id, username FROM profiles LIMIT 10;
-- Потом:
-- UPDATE profiles SET is_admin = true WHERE id = 'ТВОЙ-USER-ID';
