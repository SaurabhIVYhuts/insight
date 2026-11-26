// Region -> CSS variable (hues defined in calendar.css, tuned per theme).
const SLUG = {
  Europe: "europe",
  "Latin America": "latam",
  Asia: "asia",
  "North America": "namerica",
  "North Africa": "nafrica",
  "South Asia": "sasia",
  "Southeast Asia": "seasia",
  "Middle East": "mideast",
  "Sub-Saharan Africa": "ssafrica",
  Oceania: "oceania",
};
export const regionColor = (region) => `var(--mi-r-${SLUG[region] || "other"})`;

export function regionsIn(...lists) {
  const seen = [];
  lists.flat().forEach((r) => r && !seen.includes(r.region) && seen.push(r.region));
  return seen.filter(Boolean);
}
