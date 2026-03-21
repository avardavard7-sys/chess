-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  avatar_url TEXT,
  elo_rating INTEGER DEFAULT 1200,
  rank TEXT DEFAULT '🌱 Новичок',
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  games_lost INTEGER DEFAULT 0,
  games_draw INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_white UUID REFERENCES profiles(id) ON DELETE SET NULL,
  player_black UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  winner UUID REFERENCES profiles(id) ON DELETE SET NULL,
  result TEXT,
  moves JSONB DEFAULT '[]',
  fen_history JSONB DEFAULT '[]',
  difficulty TEXT,
  mode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS matchmaking_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  elo_rating INTEGER,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  result TEXT CHECK (result IN ('win', 'loss', 'draw')),
  elo_before INTEGER,
  elo_after INTEGER,
  elo_change INTEGER,
  played_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history(user_id);
CREATE INDEX IF NOT EXISTS idx_game_history_played_at ON game_history(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_matchmaking_elo ON matchmaking_queue(elo_rating);
CREATE INDEX IF NOT EXISTS idx_game_sessions_players ON game_sessions(player_white, player_black);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  TO authenticated, anon
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Game sessions policies
CREATE POLICY "Players can read their own sessions"
  ON game_sessions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = player_white OR
    auth.uid() = player_black OR
    status = 'active'
  );

CREATE POLICY "Authenticated users can create sessions"
  ON game_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = player_white OR auth.uid() = player_black
  );

CREATE POLICY "Players can update their own sessions"
  ON game_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_white OR auth.uid() = player_black);

-- Matchmaking queue policies
CREATE POLICY "Users can view entire queue"
  ON matchmaking_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join queue"
  ON matchmaking_queue FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave queue"
  ON matchmaking_queue FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue entry"
  ON matchmaking_queue FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Game history policies
CREATE POLICY "Users can read their own history"
  ON game_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert game history"
  ON game_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- AUTH TRIGGER — auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, elo_rating, rank)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    1200,
    '🌱 Новичок'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- REALTIME
-- ============================================================

-- Enable realtime for game_sessions and matchmaking_queue
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE matchmaking_queue;
