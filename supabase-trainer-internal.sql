
ALTER TABLE trainer_attendance
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES school_students(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trainer_attendance_student
  ON trainer_attendance(student_id);

ALTER TABLE trainer_notes
  ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES school_students(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS note_type text DEFAULT 'note';

CREATE INDEX IF NOT EXISTS idx_trainer_notes_student
  ON trainer_notes(student_id);
