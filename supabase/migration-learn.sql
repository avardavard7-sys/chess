-- ============================================
-- ОБУЧЕНИЕ — таблица прогресса
-- Копируй в Supabase SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.learn_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  course_id TEXT NOT NULL,
  solved_puzzles JSONB DEFAULT '[]',
  solved_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

ALTER TABLE learn_progress ENABLE ROW LEVEL SECURITY;
GRANT ALL ON learn_progress TO authenticated;

CREATE POLICY "Users read own learn progress" ON learn_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own learn progress" ON learn_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own learn progress" ON learn_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
