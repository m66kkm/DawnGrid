import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

interface CommitInfo {
  hash: string;
  shortHash: string;
  subject: string;
  body: string;
}

function runGit(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

export function getRepoInfo(): { owner: string; repo: string } {
  if (process.env.GITHUB_REPOSITORY) {
    const [owner, repo] = process.env.GITHUB_REPOSITORY.split("/");
    if (owner && repo) {
      return { owner, repo };
    }
  }

  const remoteUrl = runGit("git remote get-url origin");
  const match = remoteUrl.match(/(?:[:/])([^/:]+)\/([^/.]+)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }

  return { owner: "m66kkm", repo: "DawnGrid" };
}

export function getTargetTag(): string {
  if (process.argv[2]) return process.argv[2];
  if (process.env.GITHUB_REF_NAME) return process.env.GITHUB_REF_NAME;
  if (process.env.TAG_NAME) return process.env.TAG_NAME;

  // Check if current HEAD is a tag
  const exactTag = runGit("git tag --points-at HEAD");
  if (exactTag) {
    const firstTag = exactTag.split("\n")[0].trim();
    if (firstTag) return firstTag;
  }

  return "HEAD";
}

export function getPreviousTag(target: string): string {
  // Try to find the closest previous tag before target (~1 works on Windows cmd/pwsh and Linux)
  const prev = runGit(`git describe --tags --abbrev=0 "${target}~1"`);
  if (prev) return prev;

  // Fallback: root commit
  const root = runGit("git rev-list --max-parents=0 HEAD");
  return root;
}

export function parseCommits(prevTag: string, targetTag: string): CommitInfo[] {
  const range = prevTag ? `${prevTag}..${targetTag}` : targetTag;
  const rawLog = runGit(`git log ${range} --format="%H%x1f%h%x1f%s%x1f%b%x1e"`);

  if (!rawLog) return [];

  const rawEntries = rawLog.split("\x1e");
  const commits: CommitInfo[] = [];

  for (const entry of rawEntries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const parts = trimmed.split("\x1f");
    if (parts.length < 3) continue;

    const hash = parts[0]?.trim() || "";
    const shortHash = parts[1]?.trim() || "";
    const subject = parts[2]?.trim() || "";
    const body = parts[3]?.trim() || "";

    if (!hash || !subject) continue;

    commits.push({ hash, shortHash, subject, body });
  }

  return commits;
}

function cleanSubject(subject: string): string {
  // Strip leading emojis, symbols, spaces like "✨ feat:", "@ perf:", etc.
  return subject.replace(/^[\p{Extended_Pictographic}\s@#*!~-]+/u, "").trim();
}

function formatCommitLine(commit: CommitInfo, owner: string, repo: string): string {
  const commitUrl = `https://github.com/${owner}/${repo}/commit/${commit.hash}`;
  const commitLink = `[\`${commit.shortHash}\`](${commitUrl})`;

  const cleaned = cleanSubject(commit.subject);

  // Conventional commit parsing: type(scope): message or type: message
  const match = cleaned.match(/^([a-zA-Z\u4e00-\u9fa5]+)(?:\(([^)]+)\))?!?:\s*(.*)$/);
  if (match) {
    const scope = match[2]?.trim();
    const desc = match[3]?.trim() || cleaned;
    if (scope) {
      return `- **${scope}**: ${desc} (${commitLink})`;
    }
    return `- ${desc} (${commitLink})`;
  }

  return `- ${cleaned || commit.subject} (${commitLink})`;
}

export function generateReleaseMarkdown(options: {
  targetTag: string;
  prevTag: string;
  commits: CommitInfo[];
  owner: string;
  repo: string;
}): string {
  const { targetTag, prevTag, commits, owner, repo } = options;

  const features: CommitInfo[] = [];
  const fixes: CommitInfo[] = [];
  const perf: CommitInfo[] = [];
  const refactor: CommitInfo[] = [];
  const docs: CommitInfo[] = [];
  const chores: CommitInfo[] = [];
  const others: CommitInfo[] = [];

  for (const c of commits) {
    const s = cleanSubject(c.subject);

    // Exclude release / bump commits from changelog entries
    if (/^chore(?:\(release\))?:\s*(bump\s+version|release\s+version)/i.test(s)) {
      continue;
    }

    if (
      /^(feat|feature|新增|特性)(\(.*\))?!?:/i.test(s) ||
      /\b(feat|feature)\b/i.test(s)
    ) {
      features.push(c);
    } else if (
      /^(fix|bugfix|bug|修复|修正)(\(.*\))?!?:/i.test(s) ||
      /\b(fix|bugfix)\b/i.test(s)
    ) {
      fixes.push(c);
    } else if (
      /^(perf|optimize|impr|improve|优化|性能)(\(.*\))?!?:/i.test(s) ||
      /\b(perf|optimize)\b/i.test(s)
    ) {
      perf.push(c);
    } else if (/^(refactor|重构)(\(.*\))?!?:/i.test(s)) {
      refactor.push(c);
    } else if (/^(docs|文档)(\(.*\))?!?:/i.test(s)) {
      docs.push(c);
    } else if (
      /^(chore|style|test|ci|build|工程|依赖|构建)(\(.*\))?!?:/i.test(s)
    ) {
      chores.push(c);
    } else {
      others.push(c);
    }
  }

  const sections: { title: string; list: CommitInfo[] }[] = [
    { title: "🚀 新增功能 (Features)", list: features },
    { title: "🐛 问题修复 (Bug Fixes)", list: fixes },
    { title: "⚡ 性能与体验优化 (Performance & Improvements)", list: perf },
    { title: "🔨 代码重构 (Refactoring)", list: refactor },
    { title: "📝 文档变更 (Documentation)", list: docs },
    { title: "🧹 工程与依赖维护 (Chores & Maintenance)", list: chores },
    { title: "📦 其他更新 (Other Changes)", list: others },
  ];

  const lines: string[] = [];
  const displayTag = targetTag === "HEAD" ? "Latest" : targetTag;
  const dateStr = new Date().toISOString().split("T")[0];

  lines.push(`## 🚀 DawnGrid ${displayTag} (${dateStr})\n`);

  let hasEntries = false;
  for (const sec of sections) {
    if (sec.list.length > 0) {
      hasEntries = true;
      lines.push(`### ${sec.title}`);
      for (const item of sec.list) {
        lines.push(formatCommitLine(item, owner, repo));
      }
      lines.push("");
    }
  }

  if (!hasEntries) {
    lines.push("常规优化与日常维护更新。\n");
  }

  lines.push("---");
  if (prevTag && prevTag !== targetTag) {
    lines.push(
      `**Full Changelog**: https://github.com/${owner}/${repo}/compare/${prevTag}...${targetTag}`
    );
  } else {
    lines.push(`**Commit**: https://github.com/${owner}/${repo}/commits/${targetTag}`);
  }

  return lines.join("\n").trim() + "\n";
}

export function main() {
  const targetTag = getTargetTag();
  const prevTag = getPreviousTag(targetTag);
  const { owner, repo } = getRepoInfo();

  console.log(`[generate-changelog] Target: ${targetTag}, Previous: ${prevTag}, Repo: ${owner}/${repo}`);

  const commits = parseCommits(prevTag, targetTag);
  console.log(`[generate-changelog] Found ${commits.length} commits.`);

  const markdown = generateReleaseMarkdown({
    targetTag,
    prevTag,
    commits,
    owner,
    repo,
  });

  // Write to release_notes.md
  const outputPath = path.resolve(process.cwd(), "release_notes.md");
  fs.writeFileSync(outputPath, markdown, "utf8");
  console.log(`[generate-changelog] Wrote release notes to ${outputPath}`);

  // If in GitHub Actions, append to GITHUB_OUTPUT
  if (process.env.GITHUB_OUTPUT) {
    const delimiter = `EOF_${Date.now()}`;
    const outputContent = `body<<${delimiter}\n${markdown}\n${delimiter}\n`;
    fs.appendFileSync(process.env.GITHUB_OUTPUT, outputContent, "utf8");
    console.log(`[generate-changelog] Exported 'body' to GITHUB_OUTPUT`);
  }

  console.log("\n--- Generated Release Notes Preview ---\n");
  console.log(markdown);
}

if (process.argv[1] && (process.argv[1].endsWith("generate-changelog.ts") || process.argv[1].endsWith("generate-changelog.js"))) {
  main();
}
