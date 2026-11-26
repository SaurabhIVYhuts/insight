// Market-calendar place records. Every *.json file in src/data/places is one
// place — dropping in a new file is all it takes to add a country or city.
// loadPlace() is async-shaped so it can be swapped for fetch(`/api/...`)
// later without touching any component.
const ctx = require.context("../data/places", false, /\.json$/);
const ALL = ctx.keys().map((k) => ctx(k));
const BY_ID = Object.fromEntries(ALL.map((p) => [p.id, p]));
const cache = new Map();

const hasData = (p) =>
  !!p && ((p.kpis && p.kpis.length) || (p.sourceCountries && p.sourceCountries.length) || (p.intakes && p.intakes.length) || p.visa);

export function listPlaces() {
  const byName = (a, b) => a.name.localeCompare(b.name);
  return {
    countries: ALL.filter((p) => p.type === "country").sort(byName),
    cities: ALL.filter((p) => p.type === "city").sort(byName),
  };
}

// -> { place, data, fallbackFrom } | null
//  place        the record the user picked
//  data         the record whose numbers are shown (parent country if the
//               city has none of its own)
//  fallbackFrom the parent country record when national figures stand in
//               for a city, else null
export function resolvePlace(id) {
  const place = BY_ID[id];
  if (!place) return null;
  const parent = place.parentCountry ? BY_ID[place.parentCountry] : null;
  if (hasData(place)) {
    const national = place.type === "city" && place.dataLevel === "national";
    return { place, data: place, fallbackFrom: national ? parent || { name: place.parentCountry } : null };
  }
  if (parent && hasData(parent)) return { place, data: parent, fallbackFrom: parent };
  return null;
}

export function loadPlace(id) {
  if (!cache.has(id)) cache.set(id, Promise.resolve(resolvePlace(id)));
  return cache.get(id);
}
