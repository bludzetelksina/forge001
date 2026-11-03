export type Release = { id: string; date: string; title: string; items: string[] };

/** Newest first. */
export const RELEASES: Release[] = [
  {
    id: "2026-11-13",
    date: "13 Nov 2026",
    title: "Version history, formatting & light theme",
    items: [
      "Version history: automatic snapshots on every Run and every 10 minutes, restore from Settings.",
      "Format file button and Shift+Alt+F for JS, TS, HTML, CSS and JSON.",
      "Light and dark theme toggle.",
      "Keyboard shortcuts sheet — press ? anywhere in a project.",
      "This What's new page.",
    ],
  },
  {
    id: "2026-11-06",
    date: "6 Nov 2026",
    title: "AI assistant, search and Explore",
    items: [
      "Assistant tab with Explain error / Fix error buttons in the console.",
      "Find in files and the Ctrl/Cmd+K command palette.",
      "Star and fork public projects from Explore.",
    ],
  },
  {
    id: "2026-10-06",
    date: "6 Oct 2026",
    title: "Shell, Developer, Cloud and Settings tools",
    items: [
      "Linux Shell running in your browser (user forge).",
      "Developer tool with run history and environment variables.",
      "Cloud tool for sharing, domains and email; Settings tool for project details.",
    ],
  },
  {
    id: "2026-10-02",
    date: "2 Oct 2026",
    title: "Bots, pull requests and GitHub Actions",
    items: [
      "Discord and Telegram bot templates.",
      "Create, review and merge pull requests in the Git tab.",
      "See and re-run GitHub Actions workflows.",
    ],
  },
  {
    id: "2026-09-18",
    date: "18 Sep 2026",
    title: "GitHub, custom domains and live cursors",
    items: ["Connect GitHub to import and push.", "Serve web projects on your own domain.", "See teammates' cursors live.", "Private package registries."],
  },
  {
    id: "2026-09-15",
    date: "15 Sep 2026",
    title: "Multi-file projects and teams",
    items: ["Multiple files per project.", "Invite teammates by email.", "Install packages."],
  },
  {
    id: "2026-09-12",
    date: "12 Sep 2026",
    title: "Forge launches",
    items: ["Write, run and share code in ten languages.", "Live web preview and public share links."],
  },
];

export const LATEST_RELEASE = RELEASES[0];
export const SEEN_KEY = "forge-seen-release";

export function hasUnseen(seenId: string | null) {
  return seenId !== LATEST_RELEASE.id;
}

/** Snapshots beyond the newest `keep` (list sorted newest first). */
export function snapshotsToPrune<T>(newestFirst: T[], keep = 30): T[] {
  return newestFirst.slice(keep);
}
