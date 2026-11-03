import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LATEST_RELEASE, SEEN_KEY, hasUnseen } from "@/lib/changelog";

export function markSeen() {
  window.localStorage.setItem(SEEN_KEY, LATEST_RELEASE.id);
  window.dispatchEvent(new Event("forge-seen"));
}

export function useUnseen() {
  const [unseen, setUnseen] = useState(false);
  useEffect(() => {
    const sync = () => setUnseen(hasUnseen(window.localStorage.getItem(SEEN_KEY)));
    sync();
    window.addEventListener("forge-seen", sync);
    return () => window.removeEventListener("forge-seen", sync);
  }, []);
  return unseen;
}

export function WhatsNewLink({ className = "" }: { className?: string }) {
  const unseen = useUnseen();
  return (
    <Link to="/changelog" className={`relative hover:text-foreground ${className}`} activeProps={{ className: "text-foreground" }}>
      What's new
      {unseen ? <span aria-label="New release" className="absolute -right-2 -top-0.5 size-1.5 rounded-full bg-primary" /> : null}
    </Link>
  );
}

/** One-time popup for signed-in users when a new release exists. */
export function WhatsNewPopup() {
  const unseen = useUnseen();
  const [open, setOpen] = useState(false);
  useEffect(() => { if (unseen) setOpen(true); }, [unseen]);
  function close() { setOpen(false); markSeen(); }
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-mono">What's new · {LATEST_RELEASE.date}</DialogTitle>
        </DialogHeader>
        <p className="text-sm font-semibold">{LATEST_RELEASE.title}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {LATEST_RELEASE.items.map((i) => <li key={i}>{i}</li>)}
        </ul>
        <div className="flex justify-end gap-2">
          <Button asChild variant="secondary" size="sm"><Link to="/changelog" onClick={close}>See all</Link></Button>
          <Button size="sm" onClick={close}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const THEME_KEY = "forge-theme";

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark");
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    window.localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }
  return { theme, toggle };
}

export function applyTheme(theme: string | null) {
  const el = document.documentElement;
  el.classList.toggle("light", theme === "light");
  el.classList.toggle("dark", theme !== "light");
}

export function initTheme() {
  applyTheme(window.localStorage.getItem(THEME_KEY));
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button size="icon" variant="ghost" className="size-8" onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

export const SHORTCUTS: [string, string][] = [
  ["Ctrl/Cmd + Enter", "Run project"],
  ["Ctrl/Cmd + S", "Save now"],
  ["Ctrl/Cmd + K", "Command palette"],
  ["Shift + Alt + F", "Format file"],
  ["?", "Show this sheet"],
];

export function ShortcutsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-mono">Keyboard shortcuts</DialogTitle></DialogHeader>
        <dl className="divide-y divide-border text-sm">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex justify-between py-2">
              <dt className="text-muted-foreground">{v}</dt>
              <dd><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">{k}</kbd></dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
