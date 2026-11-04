import { describe, expect, it } from "vitest";
import { hasUnseen, LATEST_RELEASE, RELEASES, snapshotsToPrune } from "@/lib/changelog";
import { formatParserFor } from "@/lib/format";

describe("changelog", () => {
  it("latest release is 13 Nov 2026", () => expect(LATEST_RELEASE.id).toBe("2026-11-13"));
  it("unseen until latest id stored", () => {
    expect(hasUnseen(null)).toBe(true);
    expect(hasUnseen("2026-11-06")).toBe(true);
    expect(hasUnseen("2026-11-13")).toBe(false);
  });
  it("releases newest first", () => {
    const ids = RELEASES.map((r) => r.id);
    expect([...ids].sort().reverse()).toEqual(ids);
  });
});
describe("snapshots", () => {
  it("keeps only the newest 30", () => {
    const list = Array.from({ length: 33 }, (_, i) => i);
    expect(snapshotsToPrune(list)).toEqual([30, 31, 32]);
    expect(snapshotsToPrune(list.slice(0, 30))).toEqual([]);
  });
});
describe("format", () => {
  it("supports js/ts/html/css/json only", () => {
    expect(formatParserFor("a.ts")).toBe("typescript");
    expect(formatParserFor("a.json")).toBe("json");
    expect(formatParserFor("main.py")).toBeNull();
  });
});
