-- ═══════════════════════════════════════════════════════════════════
-- МИГРАЦИЯ v11 — Кабинет тренера (28 функций)
-- Выполни в Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════

-- 1. Добавляем роль тренера
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_trainer BOOLEAN DEFAULT false;

-- 2. Привязка тренера к school_trainers
ALTER TABLE school_trainers ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Группы учеников
CREATE TABLE IF NOT EXISTS trainer_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE trainer_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tg_select" ON trainer_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "tg_modify" ON trainer_groups FOR ALL TO authenticated USING (auth.uid() = trainer_id);
GRANT ALL ON trainer_groups TO authenticated;

-- 4. Привязка ученика к группе
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES trainer_groups(id) ON DELETE SET NULL;

-- 5. Расписание
CREATE TABLE IF NOT EXISTS trainer_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id UUID REFERENCES trainer_groups(id) ON DELETE SET NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TEXT NOT NULL,
  end_time TEXT,
  topic TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE trainer_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ts_select" ON trainer_schedule FOR SELECT USING (true);
CREATE POLICY "ts_modify" ON trainer_schedule FOR ALL TO authenticated USING (auth.uid() = trainer_id);
GRANT ALL ON trainer_schedule TO authenticated;
GRANT SELECT ON trainer_schedule TO anon;

-- 6. Посещаемость
CREATE TABLE IF NOT EXISTS trainer_attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  present BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date)
);
ALTER TABLE trainer_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ta_select" ON trainer_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "ta_modify" ON trainer_attendance FOR ALL TO authenticated USING (auth.uid() = trainer_id);
GRANT ALL ON trainer_attendance TO authenticated;

-- 7. Домашние задания
CREATE TABLE IF NOT EXISTS trainer_homework (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES school_students(id) ON DELETE CASCADE,
  group_id UUID REFERENCES trainer_groups(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  puzzle_theme TEXT,
  puzzle_count INTEGER DEFAULT 5,
  video_url TEXT,
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  result_percent INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE trainer_homework ENABLE ROW LEVEL SECURITY;
CREATE POLICY "th_select" ON trainer_homework FOR SELECT TO authenticated USING (true);
CREATE POLICY "th_modify" ON trainer_homework FOR ALL TO authenticated USING (auth.uid() = trainer_id);
GRANT ALL ON trainer_homework TO authenticated;

-- 8. Комментарии / заметки тренера
CREATE TABLE IF NOT EXISTS trainer_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE trainer_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tn_select" ON trainer_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "tn_modify" ON trainer_notes FOR ALL TO authenticated USING (auth.uid() = trainer_id);
GRANT ALL ON trainer_notes TO authenticated;

-- 9. Цели ученика
CREATE TABLE IF NOT EXISTS trainer_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_rating INTEGER,
  deadline DATE,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE trainer_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tgo_select" ON trainer_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "tgo_modify" ON trainer_goals FOR ALL TO authenticated USING (auth.uid() = trainer_id);
GRANT ALL ON trainer_goals TO authenticated;

-- 10. Награды от тренера
CREATE TABLE IF NOT EXISTS trainer_awards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  trainer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  icon TEXT DEFAULT '⭐',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE trainer_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "taw_select" ON trainer_awards FOR SELECT TO authenticated USING (true);
CREATE POLICY "taw_modify" ON trainer_awards FOR ALL TO authenticated USING (auth.uid() = trainer_id);
GRANT ALL ON trainer_awards TO authenticated;
