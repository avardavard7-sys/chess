
ALTER TABLE school_students ADD COLUMN IF NOT EXISTS student_code text;

CREATE INDEX IF NOT EXISTS idx_school_students_student_code ON school_students(student_code);

SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'school_students' AND column_name = 'student_code';
