import React, { useMemo, useState } from "react";
import BreakdownHeatmap from "../charts/BreakdownHeatmap";
import BarList from "../charts/BarList";
import MoversList from "../charts/MoversList";
import TrendBarChart from "../charts/TrendBarChart";
import TrendChangeChart from "../charts/TrendChangeChart";
import TrendLineChart from "../charts/TrendLineChart";
import { ChartSkeleton } from "../SkeletonBlocks";
import ErrorState, { EmptyState } from "../ErrorState";
import { CHART_COLORS } from "../../insightPalette";

const GRANULARITIES = [
  { key: "month", label: "Month" },
  { key: "day", label: "Day" },
];
const DIMENSIONS = [
  { key: "country", label: "Country" },
  { key: "city", label: "City" },
];
// What the big chart plots: the running sold-out total, or the period-over-
// period change (the time-series form of the Movers breakdown below it).
const CHART_MODES = [
  { key: "total", label: "Total" },
  { key: "change", label: "Change" },
];
// Three views of the same underlying per-place data. Heatmap (sequential
// magnitude, the dataviz skill's own alternative to a bar form, good for
// scanning many places at once) and a plain bar chart (better for precise
// side-by-side length comparison of a shorter list) both show the selected
// period's absolute sold-out totals — same data, never a second source of
// truth. Movers instead shows the change vs the immediately-previous stored
// point (previous day, or previous month's representative day) — "which
// places drove the change," which neither absolute view can answer.
const BREAKDOWN_VIEWS = [
  { key: "heatmap", label: "Heatmap" },
  { key: "bar", label: "Bar Chart" },
  { key: "movers", label: "Movers Δ" },
];

// "1 September 2026" / "September 2026" for a day / month key — shared by the
// active-period heading and the Movers view's "vs <previous period>" label.
function fmtPeriod(key, granularity) {
  const d = new Date(granularity === "day" ? `${key}T00:00:00` : `${key}-01T00:00:00`);
  return granularity === "day"
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// Fold the per-place rows of one period into a case-normalised map keyed by
// country (or city+country) -> summed soldOut. The stored snapshots carry the
// same place under inconsistent casing ("Frankfurt am Main" vs "Frankfurt Am
// Main", "Saint-Étienne" vs "Saint-étienne"), which would otherwise show up
// as a pair of equal-and-opposite ±1 movers that are really the same place.
// City rows carry a single-line "City, Country" label (same form as the focus
// dropdown) so the location is unambiguous — city names collide across
// countries in this data (two real "London"s, etc.).
function aggregateByPlace(rows, dimension) {
  const map = new Map();
  for (const r of rows || []) {
    const rawKey = dimension === "country" ? r.country : r.city;
    if (!rawKey) continue;
    const norm = String(rawKey).toLocaleLowerCase().trim();
    const key = dimension === "country" ? norm : `${norm}||${String(r.country || "").toLocaleLowerCase().trim()}`;
    const entry = map.get(key) || {
      id: key,
      label: dimension === "country" ? r.country : r.country ? `${r.city}, ${r.country}` : r.city,
      soldOut: 0,
    };
    entry.soldOut += r.soldOut || 0;
    map.set(key, entry);
  }
  return map;
}

// Default caps the ranked list to a short "headline" view (matches the cap
// MarketSection already uses for its own ranked lists), but the dropdown
// below lets a reader who genuinely wants every place expand past it —
// "all" never re-sorts, it just stops slicing.
const BREAKDOWN_LIMIT_OPTIONS = [
  { key: "10", label: "Top 10" },
  { key: "25", label: "Top 25" },
  { key: "all", label: "All" },
];

// Latest-per-month rollup of the daily series — same "skip failed runs, keep
// the latest stored day within the month" rule the sold-out-trend endpoint
// used to apply server-side, now computed here so day and month views always
// share the exact same fetch and can never disagree with each other.
function rollUpByMonth(days) {
  const byMonth = new Map();
  for (const d of days) {
    byMonth.set(d.date.slice(0, 7), d); // ascending input -> last write wins
  }
  return Array.from(byMonth.entries()).map(([month, d]) => ({
    key: month,
    totalSoldOut: d.totalSoldOut,
    countries: d.countries,
    cities: d.cities,
    unresolvedCountrySoldOut: d.unresolvedCountrySoldOut,
    unresolvedCitySoldOut: d.unresolvedCitySoldOut,
  }));
}

// Dedicated section for "which month/day sold the most, and where" — split
// out of Market Intelligence into its own sidebar tab since it answers a
// different question (a history-over-time view) than that tab's
// point-in-time market snapshot.
export default function TrendSection({ trend, error, onRetry, onResetFilters }) {
  // Defaults to Day rather than Month: with under a full calendar month of
  // snapshot history so far, Month view is currently always exactly one
  // bar — Day already has every real point sitting there. Once there's a
  // few months of history both views are equally reasonable; this is a
  // one-click toggle either way.
  const [granularity, setGranularity] = useState("day");
  // City by default: this section's whole question is "where sold out" and the
  // most actionable answer is at city level (the Country toggle is still there
  // for a coarser overview).
  const [dimension, setDimension] = useState("city");
  const [chartMode, setChartMode] = useState("total");
  const [selectedKey, setSelectedKey] = useState(null);
  const [breakdownLimit, setBreakdownLimit] = useState("10");
  const [breakdownView, setBreakdownView] = useState("heatmap");
  // null = "All" (top-N ranking + breakdown panel, the default view). Set to
  // a specific country name, or a "city||country" composite key (city names
  // collide across countries — e.g. two real "London"s in this data), to
  // drill the chart itself into just that one place's trend over time.
  const [focusKey, setFocusKey] = useState(null);

  const days = useMemo(() => trend?.days || [], [trend]);

  // Every distinct real country/city ever seen across the whole stored
  // history (not just the currently-active period) — "Unknown" is already
  // excluded server-side (sold-out-trend.js), so it can never appear here
  // either. Built from the raw days, not the (possibly month-rolled) points,
  // so a country/city that only shows up on one historical day still gets
  // listed. Ranked by total sold-out volume across all of history, not
  // alphabetically — the places someone actually wants to drill into (the
  // big markets) sit at the top of the dropdown instead of wherever their
  // name happens to fall in the alphabet.
  const allCountries = useMemo(() => {
    const totals = new Map();
    for (const d of days) for (const c of d.countries || []) if (c.country) totals.set(c.country, (totals.get(c.country) || 0) + (c.soldOut || 0));
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([country]) => country);
  }, [days]);
  const allCities = useMemo(() => {
    const totals = new Map(); // key -> { city, country, total }
    for (const d of days) {
      for (const c of d.cities || []) {
        if (!c.city) continue;
        const key = `${c.city}||${c.country || ""}`;
        const prev = totals.get(key) || { city: c.city, country: c.country || "", total: 0 };
        prev.total += c.soldOut || 0;
        totals.set(key, prev);
      }
    }
    return Array.from(totals.values()).sort((a, b) => b.total - a.total || a.city.localeCompare(b.city));
  }, [days]);

  const points = useMemo(() => {
    if (granularity === "day") {
      return days.map((d) => ({
        key: d.date,
        totalSoldOut: d.totalSoldOut,
        countries: d.countries,
        cities: d.cities,
        unresolvedCountrySoldOut: d.unresolvedCountrySoldOut,
        unresolvedCitySoldOut: d.unresolvedCitySoldOut,
      }));
    }
    return rollUpByMonth(days);
  }, [days, granularity]);

  // No point explicitly clicked yet — default the breakdown panel (and the
  // chart's "active" bar) to the highest point, since that's the headline
  // answer to "which month/day sold the most" the manager asked for.
  const defaultKey = useMemo(() => {
    if (points.length === 0) return null;
    return points.reduce((best, p) => ((p.totalSoldOut || 0) > (best?.totalSoldOut ?? -Infinity) ? p : best), null).key;
  }, [points]);
  const activeKey = selectedKey || defaultKey;
  const activeEntry = points.find((p) => p.key === activeKey) || null;
  // Sorted here, explicitly — the stored snapshot's array order isn't
  // guaranteed descending-by-soldOut (confirmed live: it wasn't), so
  // trusting it silently produced a visibly wrong ranking. Also: city names
  // collide across countries (a real "Sunderland" in more than one country
  // exists in this data, same issue MarketSection's Top Demand Markets table
  // already works around) — city rows get a country sublabel and a
  // country-qualified id so two same-named cities never look like a
  // duplicate row or collide on React key.
  const breakdownFull = useMemo(() => {
    const raw = activeEntry ? (dimension === "country" ? activeEntry.countries : activeEntry.cities) || [] : [];
    const sorted = [...raw].sort((a, b) => (b.soldOut || 0) - (a.soldOut || 0));
    if (dimension !== "city") return sorted;
    return sorted.map((c) => ({ ...c, sublabel: c.country, id: `${c.city}-${c.country}` }));
  }, [activeEntry, dimension]);
  const breakdownData = breakdownLimit === "all" ? breakdownFull : breakdownFull.slice(0, Number(breakdownLimit));

  const activeLabel = useMemo(() => (activeEntry ? fmtPeriod(activeEntry.key, granularity) : ""), [activeEntry, granularity]);

  // The point immediately before the active one in the (ascending) series —
  // what the Movers view diffs against. null on the very first stored point.
  const prevEntry = useMemo(() => {
    if (!activeEntry) return null;
    const i = points.findIndex((p) => p.key === activeEntry.key);
    return i > 0 ? points[i - 1] : null;
  }, [points, activeEntry]);
  const prevLabel = useMemo(() => (prevEntry ? fmtPeriod(prevEntry.key, granularity) : ""), [prevEntry, granularity]);

  // Every place whose sold-out count changed between prevEntry and activeEntry,
  // for the current dimension — signed delta, sorted gainers-first then by
  // magnitude. Case-normalised (see aggregateByPlace) so casing-only duplicate
  // rows in the stored snapshots don't surface as phantom ±1 movers.
  const moversFull = useMemo(() => {
    if (!activeEntry || !prevEntry) return [];
    const curr = aggregateByPlace(dimension === "country" ? activeEntry.countries : activeEntry.cities, dimension);
    const prev = aggregateByPlace(dimension === "country" ? prevEntry.countries : prevEntry.cities, dimension);
    const rows = [];
    for (const key of new Set([...curr.keys(), ...prev.keys()])) {
      const c = curr.get(key)?.soldOut || 0;
      const p = prev.get(key)?.soldOut || 0;
      if (c === p) continue;
      const meta = curr.get(key) || prev.get(key);
      rows.push({ id: key, label: meta.label, sublabel: meta.sublabel, prev: p, curr: c, delta: c - p });
    }
    rows.sort((a, b) => b.delta - a.delta || Math.abs(b.delta) - Math.abs(a.delta) || a.label.localeCompare(b.label));
    return rows;
  }, [activeEntry, prevEntry, dimension]);

  // Same Top-N / All control as the absolute views, but "top" here means
  // largest absolute move in either direction — so the cap can't silently
  // drop every place that freed up just because the gainers out-number them.
  const moversData = useMemo(() => {
    if (breakdownLimit === "all") return moversFull;
    const keep = new Set(
      [...moversFull].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, Number(breakdownLimit)).map((r) => r.id)
    );
    return moversFull.filter((r) => keep.has(r.id));
  }, [moversFull, breakdownLimit]);

  // Headline site-wide move vs the sum of the per-place moves — they differ by
  // whatever sold-out inventory sits in an unresolved ("Unknown") locality
  // that the country/city breakdown deliberately excludes. Surfaced, never
  // hidden, so the numbers visibly reconcile.
  const headlineDelta = prevEntry && activeEntry ? (activeEntry.totalSoldOut || 0) - (prevEntry.totalSoldOut || 0) : 0;
  const moversNet = moversFull.reduce((s, r) => s + r.delta, 0);

  // Human label for the dropdown's current selection — a plain country name,
  // or "City, Country" for the composite city key.
  const focusLabel = useMemo(() => {
    if (!focusKey) return "";
    if (dimension === "country") return focusKey;
    const [city, country] = focusKey.split("||");
    return country ? `${city}, ${country}` : city;
  }, [focusKey, dimension]);

  // Drills the chart itself into one specific place: each period's bar
  // becomes that place's own sold-out count (0 for a period it wasn't
  // cached in that day, never fabricated) instead of the site-wide total.
  const chartPoints = useMemo(() => {
    if (!focusKey) return points;
    if (dimension === "country") {
      return points.map((p) => ({ ...p, totalSoldOut: (p.countries || []).find((c) => c.country === focusKey)?.soldOut || 0 }));
    }
    const [city, country] = focusKey.split("||");
    return points.map((p) => ({ ...p, totalSoldOut: (p.cities || []).find((c) => c.city === city && (c.country || "") === country)?.soldOut || 0 }));
  }, [points, focusKey, dimension]);

  // Signed period-over-period change for the "Change" chart mode — derived
  // from whatever chartPoints currently represents (site-wide, or one focused
  // place), so the toggle works the same in both. First point has no
  // predecessor, so its change is null (drawn as no bar, never a fake zero).
  const changePoints = useMemo(
    () =>
      chartPoints.map((p, i) => ({
        key: p.key,
        value: i === 0 ? null : (p.totalSoldOut || 0) - (chartPoints[i - 1].totalSoldOut || 0),
      })),
    [chartPoints]
  );

  return (
    <div className="insight-section">
      <div className="insight-section-intro">
        <h2>Sold-Out Trend</h2>
        <p>Total sold-out inventory over time — see which month or day sold the most, and where.</p>
      </div>

      <div className="insight-card">
        <div className="insight-table-toolbar">
          <div>
            <h3 style={{ marginBottom: 4 }}>
              {chartMode === "change" ? "Sold-Out Inventory Change" : "Sold-Out Inventory Over Time"}
              {focusKey ? ` — ${focusLabel}` : ""}
            </h3>
            <p className="insight-card-sub" style={{ margin: 0 }}>
              {chartMode === "change"
                ? `${focusKey ? `${focusLabel}'s` : "Site-wide"} ${granularity}-over-${granularity} change in sold-out inventory. Click a bar for the ${dimension} breakdown.`
                : focusKey
                ? `${focusLabel}'s own sold-out count across every stored ${granularity}.`
                : `${
                    granularity === "month" ? "Each month's total is its latest stored snapshot." : "One point per stored daily snapshot."
                  } Click a bar for the ${dimension} breakdown.`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div className="insight-dimension-switch">
              {CHART_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={chartMode === m.key ? "active" : ""}
                  onClick={() => {
                    setChartMode(m.key);
                    // Pair the chart with its matching breakdown: "Change"
                    // lines up with the Movers list, "Total" with the ranked
                    // absolute views. Non-sticky — freely switchable after.
                    if (m.key === "change") setBreakdownView("movers");
                    else if (breakdownView === "movers") setBreakdownView("heatmap");
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="insight-dimension-switch">
              {GRANULARITIES.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  className={granularity === g.key ? "active" : ""}
                  onClick={() => {
                    setGranularity(g.key);
                    setSelectedKey(null);
                  }}
                >
                  {g.label}
                </button>
              ))}
            </div>
            <div className="insight-dimension-switch">
              {DIMENSIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  className={dimension === d.key ? "active" : ""}
                  onClick={() => {
                    setDimension(d.key);
                    setFocusKey(null);
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <select className="insight-filter-select" value={focusKey || ""} onChange={(e) => setFocusKey(e.target.value || null)}>
              <option value="">{dimension === "country" ? "All Countries" : "All Cities"}</option>
              {dimension === "country"
                ? allCountries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))
                : allCities.map((c) => (
                    <option key={`${c.city}||${c.country}`} value={`${c.city}||${c.country}`}>
                      {c.city}, {c.country}
                    </option>
                  ))}
            </select>
          </div>
        </div>

        {error ? (
          <ErrorState onRetry={onRetry} />
        ) : !trend ? (
          <ChartSkeleton height={260} />
        ) : points.length === 0 ? (
          <EmptyState message="No sold-out snapshots recorded yet." onReset={onResetFilters} />
        ) : (
          <>
            {chartMode === "change" ? (
              <TrendChangeChart points={changePoints} granularity={granularity} selectedKey={activeKey} onSelectKey={setSelectedKey} />
            ) : focusKey ? (
              <TrendLineChart points={chartPoints} granularity={granularity} label={focusLabel} />
            ) : (
              <TrendBarChart points={chartPoints} granularity={granularity} selectedKey={activeKey} onSelectKey={setSelectedKey} />
            )}
            {!focusKey && activeEntry && (
              <div className="insight-trendchart-breakdown">
                <div className="insight-table-toolbar" style={{ marginBottom: 12 }}>
                  <h4 style={{ margin: 0 }}>
                    {breakdownView === "movers" ? (
                      <>
                        {breakdownLimit === "all" ? "All" : `Top ${breakdownLimit}`} {dimension === "country" ? "country" : "city"} movers
                        {prevEntry ? ` vs ${prevLabel}` : ""} — {activeLabel}
                        {breakdownLimit !== "all" && moversFull.length > Number(breakdownLimit) ? ` (of ${moversFull.length})` : ""}
                      </>
                    ) : (
                      <>
                        {breakdownLimit === "all" ? "All" : `Top ${breakdownLimit}`} {dimension === "country" ? "countries" : "cities"} — {activeLabel}
                        {breakdownLimit !== "all" && breakdownFull.length > Number(breakdownLimit) ? ` (of ${breakdownFull.length})` : ""}
                      </>
                    )}
                  </h4>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <div className="insight-dimension-switch">
                      {BREAKDOWN_VIEWS.map((v) => (
                        <button key={v.key} type="button" className={breakdownView === v.key ? "active" : ""} onClick={() => setBreakdownView(v.key)}>
                          {v.label}
                        </button>
                      ))}
                    </div>
                    <select className="insight-filter-select" value={breakdownLimit} onChange={(e) => setBreakdownLimit(e.target.value)}>
                      {BREAKDOWN_LIMIT_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {breakdownView === "movers" && prevEntry && moversFull.length > 0 && (
                  <p className="insight-movers-summary">
                    Site-wide sold-out {prevEntry.totalSoldOut?.toLocaleString()} &rarr; {activeEntry.totalSoldOut?.toLocaleString()}{" "}
                    <span className={headlineDelta >= 0 ? "delta-up" : "delta-down"}>
                      ({headlineDelta >= 0 ? "+" : "−"}
                      {Math.abs(headlineDelta).toLocaleString()})
                    </span>{" "}
                    · {moversFull.filter((r) => r.delta > 0).length} {dimension === "country" ? "countries" : "cities"} up,{" "}
                    {moversFull.filter((r) => r.delta < 0).length} down
                    {moversNet !== headlineDelta && (
                      <span className="insight-movers-note">
                        {Math.abs(headlineDelta - moversNet).toLocaleString()} of the site-wide move sits in an unresolved locality and isn&rsquo;t
                        attributed to a named {dimension} above.
                      </span>
                    )}
                  </p>
                )}
                <div className="insight-trendchart-breakdown-scroll">
                  {breakdownView === "heatmap" ? (
                    <BreakdownHeatmap data={breakdownData} valueKey="soldOut" labelKey={dimension} emptyMessage={`No ${dimension} data for this ${granularity}.`} />
                  ) : breakdownView === "movers" ? (
                    <MoversList
                      data={moversData}
                      emptyMessage={
                        prevEntry
                          ? `No ${dimension} changed its sold-out count between ${prevLabel} and ${activeLabel}.`
                          : `${activeLabel} is the earliest stored ${granularity} — nothing before it to compare against.`
                      }
                    />
                  ) : (
                    <BarList
                      data={breakdownData}
                      valueKey="soldOut"
                      labelKey={dimension}
                      color={CHART_COLORS.purple}
                      emptyMessage={`No ${dimension} data for this ${granularity}.`}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
