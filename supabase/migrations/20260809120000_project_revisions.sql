CREATE TABLE public.project_revisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_revisions_project_id_created_at_idx
  ON public.project_revisions(project_id, created_at DESC);

GRANT SELECT, INSERT ON public.project_revisions TO anon;
GRANT SELECT, INSERT, DELETE ON public.project_revisions TO authenticated;
GRANT ALL ON public.project_revisions TO service_role;

ALTER TABLE public.project_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view project revisions"
  ON public.project_revisions FOR SELECT USING (true);
CREATE POLICY "Anyone can create project revisions"
  ON public.project_revisions FOR INSERT WITH CHECK (true);
