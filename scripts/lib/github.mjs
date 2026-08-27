// Shared GitHub API helpers.

export const TOKEN = process.env.PAT_TOKEN;
export const USERNAME = process.env.GH_USERNAME || "pedrodaltoe";

if (!TOKEN) {
  throw new Error("PAT_TOKEN env var is required");
}

export async function ghRaw(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  return res;
}

export async function gh(path) {
  const res = await ghRaw(path);
  if (!res.ok) {
    throw new Error(`GitHub API ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function graphql(query, variables) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
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

/** Every repo the token can see: owned, org member, and outside-collaborator. */
export async function listAllRepos() {
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
