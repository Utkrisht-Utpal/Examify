-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('student', 'teacher', 'admin');

-- Create enum for question types
CREATE TYPE public.question_type AS ENUM ('mcq', 'descriptive', 'coding');

-- Create enum for exam status
CREATE TYPE public.exam_status AS ENUM ('draft', 'published', 'archived');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table (separate for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subject TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_type question_type NOT NULL DEFAULT 'mcq',
  options JSONB, -- For MCQ options: ["option1", "option2", ...]
  correct_answer TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exams table
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL, -- Duration in minutes
  total_marks INTEGER NOT NULL DEFAULT 0,
  passing_marks INTEGER NOT NULL DEFAULT 0,
  status exam_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create exam_questions junction table
CREATE TABLE public.exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  order_number INTEGER NOT NULL,
  UNIQUE(exam_id, question_id)
);

-- Create submissions table
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  answers JSONB NOT NULL, -- { "question_id": "answer", ... }
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  time_taken INTEGER, -- Time taken in seconds
  UNIQUE(exam_id, student_id)
);

-- Create results table
CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID REFERENCES public.submissions(id) ON DELETE CASCADE NOT NULL UNIQUE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES public.exams(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_marks INTEGER NOT NULL,
  percentage DECIMAL(5,2) NOT NULL,
  graded_by UUID REFERENCES public.profiles(id),
  graded_at TIMESTAMP WITH TIME ZONE,
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for questions
CREATE POLICY "Teachers and admins can view questions" ON public.questions FOR SELECT USING (
  public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Teachers and admins can create questions" ON public.questions FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Teachers can update own questions" ON public.questions FOR UPDATE USING (
  created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Teachers can delete own questions" ON public.questions FOR DELETE USING (
  created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for exams
CREATE POLICY "Published exams viewable by all authenticated" ON public.exams FOR SELECT USING (
  status = 'published' OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Teachers and admins can create exams" ON public.exams FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Teachers can update own exams" ON public.exams FOR UPDATE USING (
  created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Teachers can delete own exams" ON public.exams FOR DELETE USING (
  created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
);

-- RLS Policies for exam_questions
CREATE POLICY "Exam questions viewable with exam" ON public.exam_questions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.exams WHERE id = exam_id AND (status = 'published' OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);
CREATE POLICY "Teachers can manage exam questions" ON public.exam_questions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.exams WHERE id = exam_id AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- RLS Policies for submissions
CREATE POLICY "Students can view own submissions" ON public.submissions FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Teachers can view all submissions" ON public.submissions FOR SELECT USING (
  public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Students can create own submissions" ON public.submissions FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students can update own ungraded submissions" ON public.submissions FOR UPDATE USING (
  student_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.results WHERE submission_id = id)
);

-- RLS Policies for results
CREATE POLICY "Students can view own results" ON public.results FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Teachers can view all results" ON public.results FOR SELECT USING (
  public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Teachers can manage results" ON public.results FOR ALL USING (
  public.has_role(auth.uid(), 'teacher') OR public.has_role(auth.uid(), 'admin')
);

-- Create trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    NEW.email
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_exams_updated_at BEFORE UPDATE ON public.exams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Create indexes for performance
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_questions_created_by ON public.questions(created_by);
CREATE INDEX idx_exams_created_by ON public.exams(created_by);
CREATE INDEX idx_exams_status ON public.exams(status);
CREATE INDEX idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX idx_submissions_exam_id ON public.submissions(exam_id);
CREATE INDEX idx_results_student_id ON public.results(student_id);
CREATE INDEX idx_results_exam_id ON public.results(exam_id);