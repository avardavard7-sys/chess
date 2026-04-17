-- ═══════════════════════════════════════════════════════════════════
-- Миграция: Внутренний рейтинг учеников в кабинете тренера
-- Добавляет связь trainer_notes/trainer_attendance со school_students
-- ═══════════════════════════════════════════════════════════════════

-- 1. trainer_attendance — добавляем поле для связи со школьным учеником
ALTER TABLE trainer_attendance
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES school_students(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trainer_attendance_student
  ON trainer_attendance(student_id);

-- 2. trainer_notes — добавляем поля
ALTER TABLE trainer_notes
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES school_students(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS note_type text DEFAULT 'note';

CREATE INDEX IF NOT EXISTS idx_trainer_notes_student
  ON trainer_notes(student_id);

-- ═══════════════════════════════════════════════════════════════════
-- Готово! Тренеры могут добавлять посещаемость, успехи, комментарии
-- и советы для учеников из внутреннего рейтинга.
-- ═══════════════════════════════════════════════════════════════════
