import React from "react";
import { MONTHS, describeMonths, monthsOf } from "./format";

// 12-month strip, one row per intake. Months are plain 1-12 sets, so a window
// such as Sep -> Jan (wrapping the year end) simply fills Sep-Dec and Jan.
// Colour is never the only cue: every cell has a label and each row prints
// its windows as text underneath.
export default function IntakeCalendar({ intakes = [], footnote }) {
  if (!intakes.length) return null;
  return (
    <figure className="mi-chart">
      <ul className="mi-legend" aria-label="Key">
        <li>
          <i className="mi-apply" /> Application window
        </li>
        <li>
          <i className="mi-start" /> Classes start
        </li>
      </ul>
      <div className="mi-cal-strip" role="table" aria-label="Intake calendar by month">
        <div className="mi-cal-row mi-cal-head" role="row">
          <span role="columnheader" className="mi-cal-name" />
          {MONTHS.map((m) => (
            <span role="columnheader" key={m} className="mi-cal-month">
              <span className="mi-m-full">{m}</span>
              <span className="mi-m-short" aria-hidden="true">
                {m[0]}
              </span>
            </span>
          ))}
        </div>
        {intakes.map((it) => {
          const apply = new Set(monthsOf(it, "apply"));
          const start = new Set(monthsOf(it, "start"));
          return (
            <React.Fragment key={it.name}>
              <div className="mi-cal-row" role="row">
                <span role="rowheader" className="mi-cal-name">
                  {it.name}
                </span>
                {MONTHS.map((m, i) => {
                  const n = i + 1;
                  const kind = start.has(n) ? "start" : apply.has(n) ? "apply" : "";
                  const label = start.has(n) ? "classes start" : apply.has(n) ? "application window" : "none";
                  return (
                    <span
                      role="cell"
                      key={m}
                      className={`mi-cell${kind ? ` mi-${kind}` : ""}${start.has(n) && apply.has(n) ? " mi-both" : ""}`}
                      title={`${it.name}, ${m}: ${label}`}
                      aria-label={`${it.name}, ${m}: ${label}`}
                    />
                  );
                })}
              </div>
              <p className="mi-cal-text">
                <b>{it.name}:</b> apply {describeMonths([...apply]) || "n/a"}; classes start {describeMonths([...start]) || "n/a"}
              </p>
            </React.Fragment>
          );
        })}
      </div>
      {footnote && <p className="mi-foot">{footnote}</p>}
    </figure>
  );
}
