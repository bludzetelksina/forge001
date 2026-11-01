ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS forked_from uuid;
CREATE TABLE public.project_stars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT ON public.project_stars TO anon;
GRANT SELECT, INSERT, DELETE ON public.project_stars TO authenticated;
GRANT ALL ON public.project_stars TO service_role;
ALTER TABLE public.project_stars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stars on public projects are visible" ON public.project_stars FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_public) OR user_id = auth.uid());
CREATE POLICY "Users star public projects" ON public.project_stars FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.is_public));
CREATE POLICY "Users remove own stars" ON public.project_stars FOR DELETE TO authenticated USING (user_id = auth.uid());