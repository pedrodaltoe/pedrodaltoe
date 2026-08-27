import { mkdir, writeFile } from "node:fs/promises";

const token = process.env.PAT_TOKEN;
const username = "pedrodaltoe";

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

async function listAllRepos() {
  let repos = [];
  let page = 1;
  while (true) {
    const batch = await gh(
      `/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`,
    );
    repos = repos.concat(batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return repos;
}

const LANG_COLORS = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Java: "#b07219",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Ruby: "#701516",
  Go: "#00ADD8",
  C: "#555555",
  "C++": "#f34b7d",
  Dart: "#00B4AB",
  Dockerfile: "#384d54",
};

function colorFor(lang) {
  return LANG_COLORS[lang] || "#8b8b8b";
}

async function main() {
  const repos = await listAllRepos();
  const totals = {};

  for (const repo of repos) {
    if (repo.fork) continue;
    try {
      const langs = await gh(`/repos/${repo.owner.login}/${repo.name}/languages`);
      for (const [lang, bytes] of Object.entries(langs)) {
        totals[lang] = (totals[lang] || 0) + bytes;
      }
    } catch {
      // skip repos we can't read
    }
  }

  const totalBytes = Object.values(totals).reduce((a, b) => a + b, 0);
  const sorted = Object.entries(totals)
    .map(([lang, bytes]) => ({ lang, pct: (bytes / totalBytes) * 100 }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);

  const width = 380;
  const barHeight = 8;
  const rowGap = 30;
  const height = 70 + sorted.length * rowGap;
  const barWidth = width - 40;

  let bars = `<rect x="20" y="50" width="${barWidth}" height="${barHeight}" rx="4" fill="#1a1f3a"/>`;
  let offset = 0;
  for (const { lang, pct } of sorted) {
    const w = (pct / 100) * barWidth;
    bars += `<rect x="${20 + offset}" y="50" width="${w}" height="${barHeight}" fill="${colorFor(lang)}"/>`;
    offset += w;
  }

  let rows = "";
  sorted.forEach(({ lang, pct }, i) => {
    const y = 85 + i * rowGap;
    rows += `
  <circle cx="26" cy="${y - 4}" r="5" fill="${colorFor(lang)}"/>
  <text x="40" y="${y}" fill="#e6e6f0" font-size="13" font-family="JetBrains Mono, monospace">${lang}</text>
  <text x="${width - 20}" y="${y}" fill="#7a7f9e" font-size="13" font-family="JetBrains Mono, monospace" text-anchor="end">${pct.toFixed(1)}%</text>`;
  });

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" rx="10" fill="#0a0e27" stroke="#00F7FF" stroke-width="1"/>
  <text x="20" y="28" fill="#00F7FF" font-size="16" font-weight="bold" font-family="JetBrains Mono, monospace">Most Used Languages (incl. private)</text>
  ${bars}
  ${rows}
</svg>`;

  await mkdir("generated", { recursive: true });
  await writeFile("generated/languages-private.svg", svg);
}

main();
