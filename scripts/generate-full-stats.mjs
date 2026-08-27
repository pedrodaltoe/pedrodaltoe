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
  query($from: DateTime!, $to: DateTime!) {
    viewer {
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

async function totalContributions() {
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
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const c = data.viewer.contributionsCollection;
    totals.commits += c.totalCommitContributions;
    totals.prs += c.totalPullRequestContributions;
    totals.reviews += c.totalPullRequestReviewContributions;
    totals.issues += c.totalIssueContributions;
    totals.restricted += c.restrictedContributionsCount;
    totals.calendar += c.contributionCalendar.totalContributions;
    from = to;
  }

  // contributionCalendar.totalContributions is exactly the number GitHub prints on
  // the profile (private included, since we query as `viewer`). typedSum is the
  // fallback in case the calendar comes back empty.
  const typedSum =
    totals.commits + totals.prs + totals.reviews + totals.issues + totals.restricted;
  totals.total = totals.calendar || typedSum;

  return totals;
}

async function totalStars() {
  const repos = await listAllRepos();
  return repos
    .filter((r) => r.owner.login.toLowerCase() === "pedrodaltoe" && !r.fork)
    .reduce((sum, r) => sum + r.stargazers_count, 0);
}

async function main() {
  const [c, stars] = await Promise.all([totalContributions(), totalStars()]);

  // GitHub never breaks private contributions down by type through the API — it
  // only reports them as one anonymised count — so the card labels the typed rows
  // "public" instead of pretending the breakdown covers everything.
  const publicContribs = c.commits + c.prs + c.reviews + c.issues;

  const rows = [
    ["Total Contributions", fmt(c.total), { highlight: true, rule: true }],
    ["Private / org work", fmt(c.restricted)],
    ["Public contributions", fmt(publicContribs), { rule: true }],
    ["Public commits", fmt(c.commits)],
    ["Public pull requests", fmt(c.prs)],
    ["Stars earned", fmt(stars)],
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
