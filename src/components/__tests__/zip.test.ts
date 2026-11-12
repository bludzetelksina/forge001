import { describe, expect, it } from "vitest";
import { findReadme, zipEntries } from "@/lib/zip";

describe("zip", () => {
  it("includes every file path", () => {
    expect(Object.keys(zipEntries([{ path: "main.py", content: "x" }, { path: "/src/a.js", content: "" }]))).toEqual(["main.py", "src/a.js"]);
  });
  it("finds README.md case-insensitively", () => {
    expect(findReadme([{ path: "main.py" }, { path: "readme.MD" }])?.path).toBe("readme.MD");
    expect(findReadme([{ path: "docs/README.md" }])).toBeNull();
  });
});
