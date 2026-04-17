-- ═══════════════════════════════════════════════════════════════════
-- МИГРАЦИЯ v10 — Внутренний рейтинг, тренеры, ученики
-- Выполни в Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Тренеры школы
CREATE TABLE IF NOT EXISTS school_trainers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  photo_url TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE school_trainers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trainers_select" ON school_trainers FOR SELECT USING (true);
CREATE POLICY "trainers_admin" ON school_trainers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
GRANT ALL ON school_trainers TO authenticated;
GRANT SELECT ON school_trainers TO anon;

-- 2. Ученики (внутренний рейтинг)
CREATE TABLE IF NOT EXISTS school_students (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  birth_year INTEGER,
  trainer_id UUID REFERENCES school_trainers(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating INTEGER DEFAULT 0,
  rating_history JSONB DEFAULT '[]',
  achievements TEXT[] DEFAULT '{}',
  graduated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE school_students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "students_select" ON school_students FOR SELECT USING (true);
CREATE POLICY "students_admin" ON school_students FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "students_self_update" ON school_students FOR UPDATE TO authenticated
  USING (profile_id = auth.uid());
GRANT ALL ON school_students TO authenticated;
GRANT SELECT ON school_students TO anon;

-- 3. Добавляем trainer_id в profiles (игрок выбирает тренера)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS trainer_id UUID REFERENCES school_trainers(id) ON DELETE SET NULL;
