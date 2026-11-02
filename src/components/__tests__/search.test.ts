import { describe, expect, it } from "vitest";
import { findMatches, replaceAllIn } from "../SearchPanel";
import { parseFileBlocks } from "../AssistantPanel";

describe("find in files", () => {
  it("finds case-insensitive matches with line numbers", () => {
    const m = findMatches([{ id: "1", path: "a.py", content: "x = 1\nPrint(x)" }], "print");
    expect(m).toHaveLength(1);
    expect(m[0]!.line).toBe(2);
  });
  it("replaces every occurrence literally", () => {
    expect(replaceAllIn("a.b a.b", "a.b", "c")).toBe("c c");
  });
  it("parses assistant file blocks", () => {
    expect(parseFileBlocks("```file:main.py\nprint(1)\n```")).toEqual([{ path: "main.py", content: "print(1)" }]);
  });
});
