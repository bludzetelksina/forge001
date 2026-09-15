CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  role text NOT NULL DEFAULT 'editor' CHECK (role IN ('editor', 'viewer')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX project_members_project_email_key ON public.project_members (project_id, lower(invited_email));
CREATE INDEX project_members_user_idx ON public.project_members (user_id);

-- Role resolution helper (security definer to avoid recursive policy checks)
CREATE OR REPLACE FUNCTION public.project_role(_project_id uuid, _user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN 'none'
    WHEN EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = _user_id) THEN 'owner'
    ELSE COALESCE((
      SELECT m.role FROM public.project_members m
      WHERE m.project_id = _project_id AND m.user_id = _user_id AND m.status = 'accepted'
      LIMIT 1
    ), 'none')
  END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members and owners can view membership"
ON public.project_members FOR SELECT TO authenticated
USING (public.project_role(project_id, auth.uid()) <> 'none' OR user_id = auth.uid());

CREATE POLICY "Owners can add members"
ON public.project_members FOR INSERT TO authenticated
WITH CHECK (public.project_role(project_id, auth.uid()) = 'owner');

CREATE POLICY "Owners can update members"
ON public.project_members FOR UPDATE TO authenticated
USING (public.project_role(project_id, auth.uid()) = 'owner')
WITH CHECK (public.project_role(project_id, auth.uid()) = 'owner');

CREATE POLICY "Owners can remove members, members can leave"
ON public.project_members FOR DELETE TO authenticated
USING (public.project_role(project_id, auth.uid()) = 'owner' OR user_id = auth.uid());

CREATE TRIGGER project_members_touch BEFORE UPDATE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.project_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX project_packages_project_name_key ON public.project_packages (project_id, lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_packages TO authenticated;
GRANT SELECT ON public.project_packages TO anon;
GRANT ALL ON public.project_packages TO service_role;
ALTER TABLE public.project_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project people can view packages"
ON public.project_packages FOR SELECT TO authenticated
USING (public.project_role(project_id, auth.uid()) <> 'none');

CREATE POLICY "Public project packages are viewable by everyone"
ON public.project_packages FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_packages.project_id AND p.is_public = true));

CREATE POLICY "Owners and editors can add packages"
ON public.project_packages FOR INSERT TO authenticated
WITH CHECK (public.project_role(project_id, auth.uid()) IN ('owner', 'editor'));

CREATE POLICY "Owners and editors can update packages"
ON public.project_packages FOR UPDATE TO authenticated
USING (public.project_role(project_id, auth.uid()) IN ('owner', 'editor'))
WITH CHECK (public.project_role(project_id, auth.uid()) IN ('owner', 'editor'));

CREATE POLICY "Owners and editors can remove packages"
ON public.project_packages FOR DELETE TO authenticated
USING (public.project_role(project_id, auth.uid()) IN ('owner', 'editor'));

CREATE TRIGGER project_packages_touch BEFORE UPDATE ON public.project_packages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Re-scope existing policies to include members
DROP POLICY "Owners can view their projects" ON public.projects;
CREATE POLICY "Owners and members can view projects"
ON public.projects FOR SELECT TO authenticated
USING (owner_id = auth.uid() OR public.project_role(id, auth.uid()) <> 'none');

DROP POLICY "Owners can update their projects" ON public.projects;
CREATE POLICY "Owners and editors can update projects"
ON public.projects FOR UPDATE TO authenticated
USING (public.project_role(id, auth.uid()) IN ('owner', 'editor'))
WITH CHECK (public.project_role(id, auth.uid()) IN ('owner', 'editor'));

DROP POLICY "Owners can view their project files" ON public.project_files;
CREATE POLICY "Project people can view files"
ON public.project_files FOR SELECT TO authenticated
USING (public.project_role(project_id, auth.uid()) <> 'none');

DROP POLICY "Owners can insert project files" ON public.project_files;
CREATE POLICY "Owners and editors can insert files"
ON public.project_files FOR INSERT TO authenticated
WITH CHECK (public.project_role(project_id, auth.uid()) IN ('owner', 'editor'));

DROP POLICY "Owners can update project files" ON public.project_files;
CREATE POLICY "Owners and editors can update files"
ON public.project_files FOR UPDATE TO authenticated
USING (public.project_role(project_id, auth.uid()) IN ('owner', 'editor'))
WITH CHECK (public.project_role(project_id, auth.uid()) IN ('owner', 'editor'));

DROP POLICY "Owners can delete project files" ON public.project_files;
CREATE POLICY "Owners and editors can delete files"
ON public.project_files FOR DELETE TO authenticated
USING (public.project_role(project_id, auth.uid()) IN ('owner', 'editor'));

DROP POLICY "Owners can view runs for their projects" ON public.runs;
CREATE POLICY "Project people can view runs"
ON public.runs FOR SELECT TO authenticated
USING (public.project_role(project_id, auth.uid()) <> 'none');

-- Invite by email: resolves an existing account, otherwise stays pending
CREATE OR REPLACE FUNCTION public.invite_project_member(_project_id uuid, _email text, _role text)
RETURNS public.project_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target uuid;
  _row public.project_members;
BEGIN
  IF public.project_role(_project_id, auth.uid()) <> 'owner' THEN
    RAISE EXCEPTION 'Only the project owner can invite people.';
  END IF;
  IF _role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION 'Role must be editor or viewer.';
  END IF;

  SELECT u.id INTO _target FROM auth.users u WHERE lower(u.email) = lower(_email) LIMIT 1;

  IF _target IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = _target
  ) THEN
    RAISE EXCEPTION 'That person already owns this project.';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, invited_email, role, status)
  VALUES (_project_id, _target, lower(_email), _role,
          CASE WHEN _target IS NULL THEN 'pending' ELSE 'accepted' END)
  ON CONFLICT (project_id, lower(invited_email)) DO UPDATE
    SET role = EXCLUDED.role,
        user_id = COALESCE(public.project_members.user_id, EXCLUDED.user_id),
        status = CASE WHEN COALESCE(public.project_members.user_id, EXCLUDED.user_id) IS NULL THEN 'pending' ELSE 'accepted' END,
        updated_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.invite_project_member(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.invite_project_member(uuid, text, text) TO authenticated;

-- Claim pending invites when the invited person signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.project_members
  SET user_id = NEW.id, status = 'accepted', updated_at = now()
  WHERE user_id IS NULL AND lower(invited_email) = lower(NEW.email);

  RETURN NEW;
END;
$$;