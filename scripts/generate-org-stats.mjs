import { mkdir, writeFile } from "node:fs/promises";
import { ghRaw, listAllRepos, USERNAME } from "./lib/github.mjs";
import { barCard } from "./lib/svg.mjs";

/**
 * Counts commits authored by USERNAME in every repository the PAT can reach —
 * including private and organization repos — and groups them by owner.
 *
 * This reads the repos directly, so it works even while
 * "Include private contributions on my profile" is still off.
 */

// Show a friendly name instead of the raw GitHub org login.
const ORG_ALIASES = {
  vslturbo: "Cakto",
  pedrodaltoe: "Personal / OSS",
};

// Optional: only these owners are shown (empty array = show everything).
const ONLY_OWNERS = [];

// Owners below this many commits are hidden, so one-off collaborations on other
// people's private repos do not end up on the public card.
const MIN_COMMITS = 10;

const COLORS = ["#00F7FF", "#7C5CFF", "#00D68F", "#FFB020", "#FF6B6B"];

/** Commit count via the Link header, so we never page through thousands of commits. */
async function countCommits(owner, repo) {
  const res = await ghRaw(
    `/repos/${owner}/${repo}/commits?author=${encodeURIComponent(USERNAME)}&per_page=1`,
  );
  if (res.status === 409) return 0; // empty repository
  if (!res.ok) return 0; // no access / disabled — skip quietly
  const link = res.headers.get("link");
  if (link) {
    const last = link.split(",").find((p) => p.includes('rel="last"'));
    if (last) {
      const m = last.match(/[?&]page=(\d+)/);
      if (m) return Number(m[1]);
    }
  }
  const body = await res.json();
  return Array.isArray(body) ? body.length : 0;
}

function labelFor(owner) {
  return ORG_ALIASES[owner.toLowerCase()] || owner;
}

async function main() {
  const repos = (await listAllRepos()).filter((r) => !r.fork && !r.archived);

  const byOwner = new Map();

  for (const repo of repos) {
    const owner = repo.owner.login;
    if (ONLY_OWNERS.length && !ONLY_OWNERS.includes(owner.toLowerCase())) continue;

    const commits = await countCommits(owner, repo.name);
    if (commits < MIN_COMMITS) continue;

    const key = labelFor(owner);
    const entry = byOwner.get(key) || { label: key, value: 0, repos: 0, private: 0 };
    entry.value += commits;
    entry.repos += 1;
    if (repo.private) entry.private += 1;
    byOwner.set(key, entry);
  }

  const entries = [...byOwner.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5)
    .map((e, i) => ({
      label: e.label,
      value: e.value,
      sub: `${e.repos} repo${e.repos === 1 ? "" : "s"}${e.private ? ` · ${e.private} private` : ""}`,
      color: COLORS[i % COLORS.length],
    }));

  if (!entries.length) {
    console.warn("No commit data found — check that the PAT has `repo` scope.");
    return;
  }

  const svg = barCard({
    title: "Where I Ship",
    entries,
    note: "Public + private + organization repos",
  });

  await mkdir("generated", { recursive: true });
  await writeFile("generated/orgs-private.svg", svg);
  console.log(JSON.stringify(entries, null, 2));
}

main();
