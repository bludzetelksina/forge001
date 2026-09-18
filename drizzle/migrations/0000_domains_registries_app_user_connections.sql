-- Per-app-user connector keys (GitHub), server-only
CREATE TABLE public.app_user_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connector_id text NOT NULL,
  connection_key_ciphertext text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, connector_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_user_connections TO service_role;
ALTER TABLE public.app_user_connections ENABLE ROW LEVEL SECURITY;

-- Remembered git link per project
CREATE TABLE public.project_git_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repo_full_name text NOT NULL,
  branch text NOT NULL DEFAULT 'main',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_git_links TO authenticated;
GRANT ALL ON public.project_git_links TO service_role;
ALTER TABLE public.project_git_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project people can view git link" ON public.project_git_links
  FOR SELECT TO authenticated USING (public.project_role(project_id, auth.uid()) <> 'none');
CREATE POLICY "Owners and editors can set git link" ON public.project_git_links
  FOR INSERT TO authenticated
  WITH CHECK (public.project_role(project_id, auth.uid()) IN ('owner','editor'));
CREATE POLICY "Owners and editors can update git link" ON public.project_git_links
  FOR UPDATE TO authenticated
  USING (public.project_role(project_id, auth.uid()) IN ('owner','editor'))
  WITH CHECK (public.project_role(project_id, auth.uid()) IN ('owner','editor'));
CREATE POLICY "Owners and editors can remove git link" ON public.project_git_links
  FOR DELETE TO authenticated
  USING (public.project_role(project_id, auth.uid()) IN ('owner','editor'));
CREATE TRIGGER project_git_links_touch BEFORE UPDATE ON public.project_git_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Custom domains for web projects
CREATE TABLE public.project_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  hostname text NOT NULL UNIQUE,
  verify_token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(8), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  last_checked_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_domains TO authenticated;
GRANT ALL ON public.project_domains TO service_role;
ALTER TABLE public.project_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project people can view domains" ON public.project_domains
  FOR SELECT TO authenticated USING (public.project_role(project_id, auth.uid()) <> 'none');
CREATE POLICY "Owners can add domains" ON public.project_domains
  FOR INSERT TO authenticated WITH CHECK (public.project_role(project_id, auth.uid()) = 'owner');
CREATE POLICY "Owners can update domains" ON public.project_domains
  FOR UPDATE TO authenticated
  USING (public.project_role(project_id, auth.uid()) = 'owner')
  WITH CHECK (public.project_role(project_id, auth.uid()) = 'owner');
CREATE POLICY "Owners can remove domains" ON public.project_domains
  FOR DELETE TO authenticated
  USING (public.project_role(project_id, auth.uid()) = 'owner');
CREATE TRIGGER project_domains_touch BEFORE UPDATE ON public.project_domains
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Private package registries (token is server-only)
CREATE TABLE public.project_registries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  registry_url text NOT NULL,
  scope text,
  token_ciphertext text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id)
);
GRANT ALL ON public.project_registries TO service_role;
ALTER TABLE public.project_registries ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER project_registries_touch BEFORE UPDATE ON public.project_registries
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();