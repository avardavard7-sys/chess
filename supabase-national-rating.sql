-- ═══════════════════════════════════════════════════════════════════
-- НАЦИОНАЛЬНЫЙ РЕЙТИНГ КАЗАХСТАНА 🇰🇿
-- ═══════════════════════════════════════════════════════════════════

-- 1. Права доступа в profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_edit_national_rating boolean DEFAULT false;

-- 2. Города
CREATE TABLE IF NOT EXISTS national_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_national_cities_name ON national_cities(name);

-- 3. Разделы (академии, школы, клубы и т.д.) внутри города
CREATE TABLE IF NOT EXISTS national_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id uuid NOT NULL REFERENCES national_cities(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_national_sections_city ON national_sections(city_id);

-- 4. Организации (конкретные школы/академии) внутри раздела
CREATE TABLE IF NOT EXISTS national_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES national_sections(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_national_orgs_section ON national_orgs(section_id);

-- 5. Ученики национального рейтинга
CREATE TABLE IF NOT EXISTS national_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES national_orgs(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  birth_year integer,
  rating integer DEFAULT 0,
  trainer_name text,
  school text,
  achievements text,
  comments text,
  rating_history jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_national_students_org ON national_students(org_id);
CREATE INDEX IF NOT EXISTS idx_national_students_name ON national_students(full_name);

-- 6. Права редактирования конкретных организаций (для ответственных за школу/академию)
CREATE TABLE IF NOT EXISTS national_org_editors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES national_orgs(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_national_org_editors_user ON national_org_editors(user_id);
CREATE INDEX IF NOT EXISTS idx_national_org_editors_org ON national_org_editors(org_id);

-- ═══════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════

-- CITIES: читают все, меняют только главные редакторы
ALTER TABLE national_cities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nc_select ON national_cities;
DROP POLICY IF EXISTS nc_modify ON national_cities;
CREATE POLICY nc_select ON national_cities FOR SELECT USING (true);
CREATE POLICY nc_modify ON national_cities FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND can_edit_national_rating = true)
) WITH CHECK (true);

-- SECTIONS: читают все, меняют только главные редакторы
ALTER TABLE national_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ns_select ON national_sections;
DROP POLICY IF EXISTS ns_modify ON national_sections;
CREATE POLICY ns_select ON national_sections FOR SELECT USING (true);
CREATE POLICY ns_modify ON national_sections FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND can_edit_national_rating = true)
) WITH CHECK (true);

-- ORGS: читают все, меняют главные редакторы
ALTER TABLE national_orgs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS no_select ON national_orgs;
DROP POLICY IF EXISTS no_modify ON national_orgs;
CREATE POLICY no_select ON national_orgs FOR SELECT USING (true);
CREATE POLICY no_modify ON national_orgs FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND can_edit_national_rating = true)
) WITH CHECK (true);

-- STUDENTS: читают все, меняют главные редакторы ИЛИ редакторы конкретной организации
ALTER TABLE national_students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS nst_select ON national_students;
DROP POLICY IF EXISTS nst_modify ON national_students;
CREATE POLICY nst_select ON national_students FOR SELECT USING (true);
CREATE POLICY nst_modify ON national_students FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND can_edit_national_rating = true)
  OR
  EXISTS (SELECT 1 FROM national_org_editors WHERE user_id = auth.uid() AND org_id = national_students.org_id)
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND can_edit_national_rating = true)
  OR
  EXISTS (SELECT 1 FROM national_org_editors WHERE user_id = auth.uid() AND org_id = national_students.org_id)
);

-- ORG_EDITORS: читают все, назначает только главный редактор
ALTER TABLE national_org_editors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS noe_select ON national_org_editors;
DROP POLICY IF EXISTS noe_modify ON national_org_editors;
CREATE POLICY noe_select ON national_org_editors FOR SELECT USING (true);
CREATE POLICY noe_modify ON national_org_editors FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND can_edit_national_rating = true)
) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════
-- ДАТЬ ДОСТУП ГЛАВНОГО РЕДАКТОРА ПОЛЬЗОВАТЕЛЮ:
-- UPDATE profiles SET can_edit_national_rating = true WHERE username = 'USERNAME';
-- или по ID:
-- UPDATE profiles SET can_edit_national_rating = true WHERE id = 'UUID';
--
-- ДАТЬ ПОЛЬЗОВАТЕЛЮ ДОСТУП К КОНКРЕТНОЙ ОРГАНИЗАЦИИ:
-- INSERT INTO national_org_editors (user_id, org_id) VALUES
--   ((SELECT id FROM profiles WHERE username = 'USER'), 'ORG_UUID');
-- ═══════════════════════════════════════════════════════════════════
