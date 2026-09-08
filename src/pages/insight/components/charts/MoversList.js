import React from "react";
import { CHART_COLORS } from "../../insightPalette";

// Diverging horizontal bars for the day-over-day (or month-over-month) change
// in sold-out inventory by country/city — the "what moved, and where" view
// that the ranked heatmap/bar can't give because those only ever render one
// period's absolute totals. Center axis = no change; places where more went
// sold out grow right in the primary purple ("sold-out" hue, same as
// everywhere else in this feature), places that freed up grow left in the
// available-inventory blue. The signed number and the prev -> curr counts are
// always printed on the row, never colour-alone (dataviz skill's marks rule).
//
// Rows are pre-computed and pre-sorted by the caller (TrendSection) — this
// component only draws them, same division of labour as BarList /
// BreakdownHeatmap.
export default function MoversList({ data, emptyMessage = "No changes to show for this period." }) {
  if (!data || data.length === 0) {
    return <p className="insight-chart-empty">{emptyMessage}</p>;
  }

  const max = Math.max(1, ...data.map((d) => Math.abs(d.delta)));

  return (
    <div className="insight-movers">
      {data.map((row) => {
        const up = row.delta > 0;
        // Half-track each side of the centre axis: the biggest mover fills its
        // whole half, everything else scales against it.
        const pct = (Math.abs(row.delta) / max) * 50;
        return (
          <div className="insight-movers-row" key={row.id}>
            <span className="insight-movers-label" title={row.label}>
              {row.label}
            </span>
            <div className="insight-movers-track">
              <span className="insight-movers-axis" />
              <div
                className={`insight-movers-fill ${up ? "is-up" : "is-down"}`}
                style={{ width: `${pct}%`, background: up ? CHART_COLORS.purple : CHART_COLORS.blue }}
              />
            </div>
            <span className="insight-movers-value">
              <span className="insight-movers-prevcurr">
                {row.prev} &rarr; {row.curr}
              </span>
              <span className={up ? "is-up" : "is-down"}>
                {up ? "+" : "−"}
                {Math.abs(row.delta)}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
