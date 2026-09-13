import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-md bg-primary font-mono text-sm font-bold text-primary-foreground">
        {"</>"}
      </span>
      <span className="font-mono text-base font-bold tracking-tight">forge</span>
    </Link>
  );
}

export default function SiteHeader() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Logo />
        <nav className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
          <Link to="/templates" activeProps={{ className: "text-foreground" }} className="hover:text-foreground">
            Templates
          </Link>
          {user ? (
            <Link to="/app" activeProps={{ className: "text-foreground" }} className="hover:text-foreground">
              My projects
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <span className="hidden max-w-40 truncate font-mono text-xs text-muted-foreground md:inline">
                {user.email}
              </span>
              <Button asChild size="sm" variant="secondary">
                <Link to="/app">Workspace</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={signOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button asChild size="sm" variant="ghost">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/auth">Start coding</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
