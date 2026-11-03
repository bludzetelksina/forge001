CREATE TABLE public.project_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  label text NOT NULL DEFAULT 'Auto',
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX project_snapshots_project_idx ON public.project_snapshots(project_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.project_snapshots TO authenticated;
GRANT ALL ON public.project_snapshots TO service_role;
ALTER TABLE public.project_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project members view snapshots" ON public.project_snapshots FOR SELECT TO authenticated
USING (public.project_role(project_id, auth.uid()) <> 'none');
CREATE POLICY "Editors create snapshots" ON public.project_snapshots FOR INSERT TO authenticated
WITH CHECK (public.project_role(project_id, auth.uid()) IN ('owner','editor') AND created_by = auth.uid());
CREATE POLICY "Editors delete snapshots" ON public.project_snapshots FOR DELETE TO authenticated
USING (public.project_role(project_id, auth.uid()) IN ('owner','editor'));