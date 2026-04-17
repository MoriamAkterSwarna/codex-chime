-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL DEFAULT '',
  project_title text NOT NULL DEFAULT '',
  live_url text NOT NULL DEFAULT '',
  github_repo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Evaluations table
CREATE TABLE public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  desktop_screenshot_url text,
  mobile_screenshot_url text,
  performance_score integer,
  accessibility_score integer,
  best_practices_score integer,
  seo_score integer,
  ui_design_score numeric(4,1),
  functionality_score numeric(4,1),
  responsiveness_score numeric(4,1),
  code_quality_score numeric(4,1),
  total_score numeric(5,1),
  ai_feedback jsonb,
  github_analysis jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX evaluations_project_id_idx ON public.evaluations(project_id);
CREATE INDEX evaluations_status_idx ON public.evaluations(status);
CREATE INDEX evaluations_project_created_idx ON public.evaluations(project_id, created_at DESC);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER evaluations_set_updated_at
BEFORE UPDATE ON public.evaluations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: per spec, public access (no auth)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_public" ON public.projects FOR SELECT USING (true);
CREATE POLICY "projects_insert_public" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "projects_update_public" ON public.projects FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "projects_delete_public" ON public.projects FOR DELETE USING (true);

CREATE POLICY "evaluations_select_public" ON public.evaluations FOR SELECT USING (true);
CREATE POLICY "evaluations_insert_public" ON public.evaluations FOR INSERT WITH CHECK (true);
CREATE POLICY "evaluations_update_public" ON public.evaluations FOR UPDATE USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

-- Seed data
INSERT INTO public.projects (student_name, project_title, live_url, github_repo) VALUES
('Aarav Patel', 'Recipe Finder', 'https://recipe-finder-demo.vercel.app', 'https://github.com/vercel/next.js'),
('Sofia Garcia', 'Habit Tracker', 'https://habit-tracker-demo.vercel.app', 'https://github.com/facebook/react'),
('Liam Chen', 'Weather Dashboard', 'https://weather-dashboard-demo.vercel.app', 'https://github.com/vitejs/vite'),
('Maya Johnson', 'Portfolio Site', 'https://portfolio-demo.vercel.app', 'https://github.com/tailwindlabs/tailwindcss'),
('Noah Williams', 'Task Manager', 'https://task-manager-demo.vercel.app', 'https://github.com/shadcn-ui/ui');