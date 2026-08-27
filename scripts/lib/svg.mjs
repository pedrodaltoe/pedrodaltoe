// Shared SVG theme + card renderers for the profile metric cards.

export const THEME = {
  bg: "#0a0e27",
  border: "#00F7FF",
  line: "#252c52",
  text: "#e6e6f0",
  muted: "#7a7f9e",
  accent: "#00F7FF",
  font: "JetBrains Mono, DejaVu Sans Mono, Menlo, Consolas, monospace",
};

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const fmt = (n) => Number(n).toLocaleString("en-US");

/**
 * Card with a title and label/value rows.
 * rows: [label, value, opts?] where opts = { highlight: true }
 */
export function statsCard({ title, rows, width = 380, note }) {
  const rowGap = 30;
  const top = 62;
  const height = top + rows.length * rowGap + (note ? 26 : 8);

  let body = "";
  rows.forEach(([label, value, opts = {}], i) => {
    const y = top + i * rowGap;
    const labelColor = opts.highlight ? THEME.accent : THEME.text;
    const valueColor = opts.highlight ? THEME.accent : THEME.accent;
    const weight = opts.highlight ? "bold" : "normal";
    body += `
  <text x="20" y="${y}" fill="${labelColor}" font-size="13" font-weight="${weight}" font-family="${THEME.font}">${esc(label)}</text>
  <text x="${width - 20}" y="${y}" fill="${valueColor}" font-size="13" font-weight="bold" font-family="${THEME.font}" text-anchor="end">${esc(value)}</text>`;
    if (opts.rule) {
      body += `
  <line x1="20" y1="${y + 9}" x2="${width - 20}" y2="${y + 9}" stroke="${THEME.line}" stroke-width="1"/>`;
    }
  });

  const noteEl = note
    ? `
  <text x="20" y="${height - 10}" fill="${THEME.muted}" font-size="10" font-family="${THEME.font}">${esc(note)}</text>`
    : "";

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">
  <rect width="${width}" height="${height}" rx="10" fill="${THEME.bg}" stroke="${THEME.border}" stroke-width="1"/>
  <text x="20" y="28" fill="${THEME.accent}" font-size="15" font-weight="bold" font-family="${THEME.font}">${esc(title)}</text>
  <line x1="20" y1="40" x2="${width - 20}" y2="40" stroke="${THEME.line}" stroke-width="1"/>${body}${noteEl}
</svg>`;
}

/**
 * Card with a horizontal bar per entry (org / repo commit distribution).
 * entries: [{ label, value, sub, color }]
 */
export function barCard({ title, entries, width = 380, note, unit = "commits" }) {
  const rowH = 54;
  const top = 58;
  const height = top + entries.length * rowH + (note ? 22 : 6);
  const barW = width - 40;
  const max = Math.max(1, ...entries.map((e) => e.value));

  let body = "";
  entries.forEach((e, i) => {
    const y = top + i * rowH;
    const w = Math.max(3, (e.value / max) * barW);
    const color = e.color || THEME.accent;
    body += `
  <text x="20" y="${y}" fill="${THEME.text}" font-size="13" font-family="${THEME.font}">${esc(e.label)}</text>
  <text x="${width - 20}" y="${y}" fill="${color}" font-size="13" font-weight="bold" font-family="${THEME.font}" text-anchor="end">${esc(fmt(e.value))} ${esc(unit)}</text>
  <rect x="20" y="${y + 8}" width="${barW}" height="7" rx="3.5" fill="${THEME.line}"/>
  <rect x="20" y="${y + 8}" width="${w.toFixed(1)}" height="7" rx="3.5" fill="${color}"/>`;
    if (e.sub) {
      body += `
  <text x="20" y="${y + 32}" fill="${THEME.muted}" font-size="10" font-family="${THEME.font}">${esc(e.sub)}</text>`;
    }
  });

  const noteEl = note
    ? `
  <text x="20" y="${height - 8}" fill="${THEME.muted}" font-size="10" font-family="${THEME.font}">${esc(note)}</text>`
    : "";

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(title)}">
  <rect width="${width}" height="${height}" rx="10" fill="${THEME.bg}" stroke="${THEME.border}" stroke-width="1"/>
  <text x="20" y="28" fill="${THEME.accent}" font-size="15" font-weight="bold" font-family="${THEME.font}">${esc(title)}</text>
  <line x1="20" y1="40" x2="${width - 20}" y2="40" stroke="${THEME.line}" stroke-width="1"/>${body}${noteEl}
</svg>`;
}
