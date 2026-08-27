import { mkdir, writeFile } from "node:fs/promises";

const token = process.env.PAT_TOKEN;

if (!token) {
  throw new Error("PAT_TOKEN env var is required");
}

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${path} failed: ${res.status}`);
  }
  return res.json();
}

async function graphql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

const CONTRIB_QUERY = `
  query($from: DateTime!, $to: DateTime!) {
    viewer {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
        totalIssueContributions
        restrictedContributionsCount
      }
    }
  }
`;

async function totalContributions() {
  const me = await gh("/user");
  const created = new Date(me.created_at);
  const now = new Date();

  let totals = {
    commits: 0,
    prs: 0,
    reviews: 0,
    issues: 0,
  };

  let from = new Date(created);
  while (from < now) {
    const to = new Date(Math.min(from.getTime() + 365 * 24 * 60 * 60 * 1000, now.getTime()));
    const data = await graphql(CONTRIB_QUERY, {
      from: from.toISOString(),
      to: to.toISOString(),
    });
    const c = data.viewer.contributionsCollection;
    totals.commits += c.totalCommitContributions;
    totals.prs += c.totalPullRequestContributions;
    totals.reviews += c.totalPullRequestReviewContributions;
    totals.issues += c.totalIssueContributions;
    from = to;
  }

  return totals;
}

async function totalStars() {
  let stars = 0;
  let page = 1;
  while (true) {
    const repos = await gh(`/user/repos?affiliation=owner&per_page=100&page=${page}`);
    for (const repo of repos) {
      stars += repo.stargazers_count;
    }
    if (repos.length < 100) break;
    page += 1;
  }
  return stars;
}

function row(label, value, y) {
  return `
  <text x="20" y="${y}" fill="#e6e6f0" font-size="14" font-family="JetBrains Mono, monospace">${label}</text>
  <text x="360" y="${y}" fill="#00F7FF" font-size="14" font-weight="bold" font-family="JetBrains Mono, monospace" text-anchor="end">${value}</text>`;
}

async function main() {
  const [contributions, stars] = await Promise.all([totalContributions(), totalStars()]);

  const width = 380;
  const rows = [
    ["Total Commits (all-time)", contributions.commits],
    ["Total Pull Requests", contributions.prs],
    ["Total PR Reviews", contributions.reviews],
    ["Total Issues", contributions.issues],
    ["Total Stars Earned", stars],
  ];
  const height = 60 + rows.length * 32;

  let body = "";
  rows.forEach(([label, value], i) => {
    body += row(label, value, 65 + i * 32);
  });

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="10" fill="#0a0e27" stroke="#00F7FF" stroke-width="1"/>
  <text x="20" y="28" fill="#00F7FF" font-size="16" font-weight="bold" font-family="JetBrains Mono, monospace">GitHub Stats (incl. private)</text>
  <line x1="20" y1="38" x2="${width - 20}" y2="38" stroke="#1a1f3a" stroke-width="1"/>
  ${body}
</svg>`;

  await mkdir("generated", { recursive: true });
  await writeFile("generated/stats-private.svg", svg);
}

main();
