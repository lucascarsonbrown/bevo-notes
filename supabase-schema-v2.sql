-- Bevo Notes v2 Schema — Courses + Units architecture
-- Run this in Supabase SQL Editor after the v1 schema

-- ============================================
-- COURSES TABLE
-- ============================================

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  -- UT course catalog fields
  course_code TEXT NOT NULL,         -- e.g. "CS 429"
  course_name TEXT NOT NULL,         -- e.g. "Computer Architecture"
  semester TEXT,                     -- e.g. "Fall 2024"
  year INTEGER,                      -- e.g. 2024
  professor TEXT,
  color TEXT DEFAULT '#bf5700',
  icon TEXT DEFAULT '📚',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_courses_user_code_semester ON courses(user_id, course_code, semester, year);
CREATE INDEX idx_courses_user_id ON courses(user_id);

-- RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own courses"
  ON courses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own courses"
  ON courses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own courses"
  ON courses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own courses"
  ON courses FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- UNITS TABLE
-- ============================================

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,                -- e.g. "Unit 1: Memory Management"
  description TEXT,
  position INTEGER DEFAULT 0,       -- ordering within a course
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_units_course_id ON units(course_id);
CREATE INDEX idx_units_user_id ON units(user_id);

-- RLS
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own units"
  ON units FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own units"
  ON units FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own units"
  ON units FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own units"
  ON units FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON units
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MATERIALS TABLE (syllabi, textbooks, custom notes)
-- ============================================

CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('syllabus', 'textbook', 'custom_notes')),
  title TEXT NOT NULL,
  file_path TEXT,                    -- Supabase Storage path
  file_size_bytes INTEGER,
  content_text TEXT,                 -- extracted text (for custom notes or small PDFs)
  is_processed BOOLEAN DEFAULT FALSE,-- has been chunked + embedded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_materials_course_id ON materials(course_id);
CREATE INDEX idx_materials_unit_id ON materials(unit_id);
CREATE INDEX idx_materials_user_id ON materials(user_id);

-- RLS
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own materials"
  ON materials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own materials"
  ON materials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own materials"
  ON materials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own materials"
  ON materials FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON materials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATE NOTES: add course_id + unit_id columns
-- (folder_id kept for backwards compat, can be dropped later)
-- ============================================

ALTER TABLE notes
  ADD COLUMN course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  ADD COLUMN unit_id   UUID REFERENCES units(id)   ON DELETE SET NULL;

CREATE INDEX idx_notes_course_id ON notes(course_id);
CREATE INDEX idx_notes_unit_id   ON notes(unit_id);

-- ============================================
-- QUIZZES TABLE (for later — scaffold now)
-- ============================================

CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  query TEXT NOT NULL,               -- the natural language prompt ("quiz me on Unit 2")
  format TEXT NOT NULL CHECK (format IN ('flashcard', 'multiple_choice', 'free_response')),
  mode TEXT CHECK (mode IN ('standard', 'unit_test', 'exam_prep')),
  questions JSONB,                   -- generated questions array
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_quizzes_course_id ON quizzes(course_id);
CREATE INDEX idx_quizzes_user_id ON quizzes(user_id);

-- RLS
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quizzes"
  ON quizzes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quizzes"
  ON quizzes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own quizzes"
  ON quizzes FOR DELETE
  USING (auth.uid() = user_id);
