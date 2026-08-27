import { mkdir, writeFile } from "node:fs/promises";
import { gh, graphql, listAllRepos } from "./lib/github.mjs";
import { statsCard, fmt } from "./lib/svg.mjs";

/**
 * Why the old numbers were wrong:
 * GitHub's GraphQL contributionsCollection only puts private contributions into
 * totalCommitContributions / totalPullRequestContributions / ... when the account has
 * "Include private contributions on my profile" enabled. While that setting is OFF,
 * every private contribution is lumped into `restrictedContributionsCount` instead —
 * which the previous script requested but never used. Hence 23 commits instead of ~1.1k.
 *
 * This version adds restrictedContributionsCount back in, so the totals are correct
 * whether or not the profile setting is on (when it IS on, restricted drops to 0,
 * so there is no double counting).
 */
const CONTRIB_QUERY = `
  query($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        restrictedContributionsCount
        contributionCalendar { totalContributions }
      }
    }
  }
`;

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function totalContributions(login) {
  const me = await gh("/user");
  const created = new Date(me.created_at);
  const now = new Date();

  const totals = {
    commits: 0,
    prs: 0,
    reviews: 0,
    issues: 0,
    restricted: 0,
    calendar: 0,
  };

  let from = new Date(created);
  while (from < now) {
    const to = new Date(Math.min(from.getTime() + YEAR_MS, now.getTime()));
    const data = await graphql(CONTRIB_QUERY, {
      login,
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const c = data.user.contributionsCollection;
    totals.commits += c.totalCommitContributions;
    totals.prs += c.totalPullRequestContributions;
    totals.reviews += c.totalPullRequestReviewContributions;
    totals.issues += c.totalIssueContributions;
    totals.restricted += c.restrictedContributionsCount;
    totals.calendar += c.contributionCalendar.totalContributions;
    from = to;
  }

  // The calendar total already includes private contributions for the authenticated
  // user; the typed totals + restricted is the belt-and-braces version. Take the
  // larger of the two so the headline number is never understated.
  const typedSum =
    totals.commits + totals.prs + totals.reviews + totals.issues + totals.restricted;
  totals.total = Math.max(totals.calendar, typedSum);

  return totals;
}

async function totalStars() {
  const repos = await listAllRepos();
  return repos
    .filter((r) => r.owner.login.toLowerCase() === "pedrodaltoe" && !r.fork)
    .reduce((sum, r) => sum + r.stargazers_count, 0);
}

async function main() {
  const login = process.env.GH_USERNAME || "pedrodaltoe";
  const [c, stars] = await Promise.all([totalContributions(login), totalStars()]);

  const rows = [
    ["Total Contributions", fmt(c.total), { highlight: true, rule: true }],
    ["Commits", fmt(c.commits)],
    ["Pull Requests", fmt(c.prs)],
    ["PR Reviews", fmt(c.reviews)],
    ["Issues", fmt(c.issues)],
    ["Private / org work", fmt(c.restricted), { rule: true }],
    ["Stars Earned", fmt(stars)],
  ];

  const svg = statsCard({
    title: "GitHub Stats — all time",
    rows,
    note: "Includes private and organization repositories",
  });

  await mkdir("generated", { recursive: true });
  await writeFile("generated/stats-private.svg", svg);
  console.log(JSON.stringify(c, null, 2));
}

main();
