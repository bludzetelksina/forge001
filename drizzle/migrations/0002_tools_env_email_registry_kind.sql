CREATE TABLE public.project_env (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_env TO authenticated;
GRANT ALL ON public.project_env TO service_role;
ALTER TABLE public.project_env ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners and editors manage env" ON public.project_env FOR ALL TO authenticated
  USING (public.project_role(project_id, auth.uid()) IN ('owner','editor'))
  WITH CHECK (public.project_role(project_id, auth.uid()) IN ('owner','editor'));

CREATE TABLE public.domain_email (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id uuid NOT NULL UNIQUE REFERENCES public.project_domains(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  to_address text,
  sent_this_hour integer NOT NULL DEFAULT 0,
  hour_start timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.domain_email TO authenticated;
GRANT ALL ON public.domain_email TO service_role;
ALTER TABLE public.domain_email ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage domain email" ON public.domain_email FOR ALL TO authenticated
  USING (public.project_role(project_id, auth.uid()) = 'owner')
  WITH CHECK (public.project_role(project_id, auth.uid()) = 'owner');

ALTER TABLE public.project_registries ADD COLUMN kind text NOT NULL DEFAULT 'npm';