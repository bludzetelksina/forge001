REVOKE ALL ON FUNCTION public.project_role(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.project_role(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.invite_project_member(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.invite_project_member(uuid, text, text) TO authenticated;