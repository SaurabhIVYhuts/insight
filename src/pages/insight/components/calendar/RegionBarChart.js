import React, { useMemo, useState } from "react";
import { compact, full, niceScale } from "./format";
import { regionColor, regionsIn } from "./regions";
import Estimated from "./Estimated";

// Horizontal bars coloured by region. One value axis, thin gridlines, rounded
// bar ends. Each row is keyboard-focusable and shows its tooltip on hover,
// focus or tap; the full figure is also in the row's aria-label.
export default function RegionBarChart({ title, items = [], unit = "students", footnote, estimated, ariaLabel, valueSuffix = "" }) {
  const [active, setActive] = useState(null);
  const rows = useMemo(() => [...items].sort((a, b) => b.value - a.value), [items]);
  const scale = useMemo(() => niceScale(Math.max(...rows.map((r) => r.value), 0)), [rows]);
  const regions = regionsIn(rows);
  if (!rows.length) return null;

  const summary = `${ariaLabel || title}. ${rows.map((r) => `${r.name} ${full(r.value)}${valueSuffix} ${unit}`).join(", ")}.`;

  return (
    <figure className="mi-chart">
      {title && (
        <figcaption className="mi-chart-title">
          {title} {estimated && <Estimated />}
        </figcaption>
      )}
      <ul className="mi-legend" aria-label="Region colours">
        {regions.map((r) => (
          <li key={r}>
            <i style={{ background: regionColor(r) }} /> {r}
          </li>
        ))}
      </ul>
      <div className="mi-bars" role="list" aria-label={summary}>
        <div className="mi-grid" aria-hidden="true">
          {scale.ticks.map((t) => (
            <span key={t} style={{ left: `${(t / scale.max) * 100}%` }} />
          ))}
        </div>
        {rows.map((r, i) => {
          const pct = (r.value / scale.max) * 100;
          const on = active === i;
          return (
            <div
              className="mi-row"
              role="listitem"
              tabIndex={0}
              key={r.name}
              aria-label={`${r.name}, ${r.region}: ${full(r.value)}${valueSuffix} ${unit}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              onClick={() => setActive(on ? null : i)}
            >
              <span className="mi-row-label" title={r.name}>
                {r.name}
              </span>
              <span className="mi-track">
                <span className="mi-bar" style={{ width: `${pct}%`, background: regionColor(r.region) }} />
                {on && (
                  <span className="mi-tip" style={{ left: `${Math.min(pct, 65)}%` }}>
                    <b>{r.name}</b>
                    <span>
                      <i style={{ background: regionColor(r.region) }} /> {full(r.value)}
                      {valueSuffix} {unit}
                    </span>
                  </span>
                )}
              </span>
            </div>
          );
        })}
        <div className="mi-axis" aria-hidden="true">
          {scale.ticks.map((t) => (
            <span key={t} style={{ left: `${(t / scale.max) * 100}%` }}>
              {compact(t)}
              {valueSuffix}
            </span>
          ))}
        </div>
      </div>
      {footnote && <p className="mi-foot">{footnote}</p>}
    </figure>
  );
}
