-- Добавляем поле для фото ученика (base64, сжатое на клиенте до ~50KB)
ALTER TABLE national_students
  ADD COLUMN IF NOT EXISTS photo_url text;
