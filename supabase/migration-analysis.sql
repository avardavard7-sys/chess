-- ============================================
-- МИГРАЦИЯ: Исправление ELO и добавление анализа
-- Запустить в Supabase SQL Editor
-- ============================================

-- 1. Исправляем default ELO в таблице profiles
ALTER TABLE profiles ALTER COLUMN elo_rating SET DEFAULT 0;
ALTER TABLE profiles ALTER COLUMN rank SET DEFAULT '👶 Малыш';

-- 2. Обновляем триггер создания профиля
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url, elo_rating, rank)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    0,
    '👶 Малыш'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Обновляем game_history — добавляем поля для анализа
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS moves_json JSONB DEFAULT '[]';
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS final_fen TEXT;
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS analysis_json JSONB;
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS accuracy_white REAL;
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS accuracy_black REAL;
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'ai';
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS difficulty TEXT;
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS player_color TEXT DEFAULT 'white';
ALTER TABLE game_history ADD COLUMN IF NOT EXISTS opponent_name TEXT;
