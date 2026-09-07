import { describe, it, expect } from "vitest";
import { generateReleaseMarkdown } from "../../scripts/generate-changelog";

describe("generateReleaseMarkdown", () => {
  it("should categorize conventional commits and format with commit links", () => {
    const commits = [
      {
        hash: "1111111111111111111111111111111111111111",
        shortHash: "1111111",
        subject: "feat(chart): add pie chart support",
        body: "",
      },
      {
        hash: "2222222222222222222222222222222222222222",
        shortHash: "2222222",
        subject: "fix(scroll): sheet wheel scrolling over overlay",
        body: "",
      },
      {
        hash: "3333333333333333333333333333333333333333",
        shortHash: "3333333",
        subject: "perf(render): coalesce canvas updates",
        body: "",
      },
      {
        hash: "4444444444444444444444444444444444444444",
        shortHash: "4444444",
        subject: "refactor(dialog): simplify dialog state",
        body: "",
      },
      {
        hash: "5555555555555555555555555555555555555555",
        shortHash: "5555555",
        subject: "chore: release version 0.3.0",
        body: "",
      },
    ];

    const markdown = generateReleaseMarkdown({
      targetTag: "v0.3.0",
      prevTag: "v0.2.1",
      commits,
      owner: "m66kkm",
      repo: "DawnGrid",
    });

    // Check version header
    expect(markdown).toContain("## 🚀 DawnGrid v0.3.0");

    // Check category headers
    expect(markdown).toContain("### 🚀 新增功能 (Features)");
    expect(markdown).toContain("### 🐛 问题修复 (Bug Fixes)");
    expect(markdown).toContain("### ⚡ 性能与体验优化 (Performance & Improvements)");
    expect(markdown).toContain("### 🔨 代码重构 (Refactoring)");

    // Check commit lines and links
    expect(markdown).toContain(
      "- **chart**: add pie chart support ([`1111111`](https://github.com/m66kkm/DawnGrid/commit/1111111111111111111111111111111111111111))"
    );
    expect(markdown).toContain(
      "- **scroll**: sheet wheel scrolling over overlay ([`2222222`](https://github.com/m66kkm/DawnGrid/commit/2222222222222222222222222222222222222222))"
    );

    // Release bump commit should be excluded
    expect(markdown).not.toContain("chore: release version 0.3.0");

    // Check full changelog link
    expect(markdown).toContain(
      "**Full Changelog**: https://github.com/m66kkm/DawnGrid/compare/v0.2.1...v0.3.0"
    );
  });
});
