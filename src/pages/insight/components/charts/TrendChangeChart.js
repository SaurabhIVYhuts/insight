import React, { useMemo, useState } from "react";
import { CHART_COLORS, SEQUENTIAL_PURPLE, TEXT_MUTED, GRID_LINE } from "../../insightPalette";
import { formatShort, formatFull, niceStep } from "./timeChartUtils";

// Hand-rolled SVG diverging bar chart — the day-over-day (or month-over-month)
// CHANGE in sold-out inventory, the time-series companion to the Movers
// breakdown below it. Bars grow up from a zero baseline in the primary purple
// where more went sold out, down in the available-inventory blue where
// inventory freed up — the same two-hue convention MoversList uses, so the
// chart and the list read as one idea. Two series only in the sense of
// "direction of change"; magnitude is never re-encoded by colour, so the
// biggest swing is called out with a direct value label instead.
const VB_H = 300;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 32;
const PAD_BOTTOM = 38;
const BAR_MAX_W = 24;
const RESPONSIVE_MAX_POINTS = 20;
const FIXED_BAND_PX = 40;
const IDEAL_BAND_PX = 100;

const ACTIVE_UP_FILL = SEQUENTIAL_PURPLE[SEQUENTIAL_PURPLE.length - 1];
const DOWN_FILL = CHART_COLORS.blue;
const ACTIVE_DOWN_FILL = "#2F6FB0";

function fmtSigned(v) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toLocaleString()}`;
}

// `points`: [{ key, value }] ascending, where `value` is the signed change vs
// the previous period (null for the first point — nothing before it).
// `granularity`: "day" | "month" — label formatting only.
export default function TrendChangeChart({ points, granularity, selectedKey, onSelectKey }) {
  const [hoverKey, setHoverKey] = useState(null);

  const sorted = useMemo(() => [...(points || [])].sort((a, b) => a.key.localeCompare(b.key)), [points]);
  const values = sorted.map((p) => p.value).filter((v) => v != null);

  if (values.length === 0) {
    return <p className="insight-chart-empty">Need at least two stored snapshots to show a change.</p>;
  }

  const scrollMode = sorted.length > RESPONSIVE_MAX_POINTS;
  const chartWidth = scrollMode ? PAD_LEFT + PAD_RIGHT + sorted.length * FIXED_BAND_PX : 800;

  const step = niceStep(Math.max(1, ...values.map((v) => Math.abs(v))));
  let niceMax = Math.ceil(Math.max(0, ...values) / step) * step;
  let niceMin = Math.floor(Math.min(0, ...values) / step) * step;
  if (niceMax === niceMin) niceMax = niceMin + step; // all-zero guard
  const ticks = [];
  for (let v = niceMin; v <= niceMax + 1e-9; v += step) ticks.push(Math.round(v));

  const fullPlotWidth = chartWidth - PAD_LEFT - PAD_RIGHT;
  const plotWidth = scrollMode ? fullPlotWidth : Math.min(fullPlotWidth, sorted.length * IDEAL_BAND_PX);
  const plotLeft = PAD_LEFT + (fullPlotWidth - plotWidth) / 2;
  const plotRight = plotLeft + plotWidth;
  const plotTop = PAD_TOP;
  const plotBottom = VB_H - PAD_BOTTOM;
  const plotHeight = plotBottom - plotTop;

  const bandWidth = plotWidth / sorted.length;
  const yFor = (v) => plotBottom - ((v - niceMin) / (niceMax - niceMin)) * plotHeight;
  const yZero = yFor(0);

  // Called out bar = biggest swing in either direction.
  const peakIndex = sorted.reduce(
    (best, p, i) => (Math.abs(p.value || 0) > Math.abs(sorted[best]?.value || -Infinity) ? i : best),
    0
  );

  const activeKey = hoverKey || selectedKey;
  const activeEntry = sorted.find((p) => p.key === activeKey) || null;
  const activeIndex = activeEntry ? sorted.indexOf(activeEntry) : -1;

  return (
    <div className="insight-trendchart-scroll">
      <div className="insight-trendchart-wrap" style={scrollMode ? { width: chartWidth } : undefined}>
        <svg
          className={scrollMode ? "insight-trendchart-svg-fixed" : "insight-trendchart-svg"}
          width={scrollMode ? chartWidth : undefined}
          height={scrollMode ? VB_H : undefined}
          viewBox={`0 0 ${chartWidth} ${VB_H}`}
          role="img"
          aria-label={`Day-over-day change in sold-out inventory by ${granularity}, ${formatFull(sorted[0].key, granularity)} to ${formatFull(
            sorted[sorted.length - 1].key,
            granularity
          )}`}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={plotLeft}
                x2={plotRight}
                y1={yFor(t)}
                y2={yFor(t)}
                stroke={t === 0 ? TEXT_MUTED : GRID_LINE}
                strokeWidth={t === 0 ? 1.25 : 1}
              />
              <text x={plotLeft - 10} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill={TEXT_MUTED}>
                {fmtSigned(t)}
              </text>
            </g>
          ))}

          {sorted.map((p, i) => {
            const bandX = plotLeft + i * bandWidth;
            const barW = Math.min(BAR_MAX_W, bandWidth * 0.6);
            const barX = bandX + (bandWidth - barW) / 2;
            const isActive = i === activeIndex;
            const isPeak = i === peakIndex && values.length > 1 && p.value != null && p.value !== 0;
            const v = p.value;
            const up = (v || 0) >= 0;
            const barY = v == null ? yZero : up ? yFor(v) : yZero;
            const barH = v == null ? 0 : Math.abs(yFor(v) - yZero);
            const fill = up ? (isActive ? ACTIVE_UP_FILL : CHART_COLORS.purple) : isActive ? ACTIVE_DOWN_FILL : DOWN_FILL;

            return (
              <g key={p.key}>
                {isActive && (
                  <rect x={bandX + 2} y={plotTop} width={Math.max(bandWidth - 4, 0)} height={plotHeight} fill={CHART_COLORS.purple} opacity="0.06" rx="4" />
                )}
                {v != null && barH > 0 && <rect x={barX} y={barY} width={barW} height={barH} rx="2" fill={fill} style={{ transition: "fill 0.15s ease" }} />}
                {isPeak && (
                  <text x={barX + barW / 2} y={up ? yFor(v) - 8 : yFor(v) + 16} textAnchor="middle" fontSize="12" fontWeight="700" fill={TEXT_MUTED}>
                    {fmtSigned(v)}
                  </text>
                )}
                <text x={bandX + bandWidth / 2} y={plotBottom + 20} textAnchor="middle" fontSize="11" fill={TEXT_MUTED}>
                  {formatShort(p.key, granularity)}
                </text>
                <rect
                  className="insight-trendchart-hit"
                  x={bandX}
                  y={plotTop}
                  width={bandWidth}
                  height={plotHeight}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={`${formatFull(p.key, granularity)}: ${
                    v == null ? "no previous snapshot to compare" : `${fmtSigned(v)} sold out vs the previous ${granularity}`
                  }. Activate to see breakdown.`}
                  onPointerEnter={() => setHoverKey(p.key)}
                  onPointerLeave={() => setHoverKey(null)}
                  onFocus={() => setHoverKey(p.key)}
                  onBlur={() => setHoverKey(null)}
                  onClick={() => onSelectKey(p.key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectKey(p.key);
                    }
                  }}
                />
              </g>
            );
          })}
        </svg>

        {activeEntry && (
          <div className="insight-trendchart-tooltip">
            <strong>{fmtSigned(activeEntry.value)}</strong>
            <span>{formatFull(activeEntry.key, granularity)}</span>
          </div>
        )}
      </div>

      <table className="sr-only">
        <caption>Day-over-day change in sold-out inventory by {granularity}</caption>
        <thead>
          <tr>
            <th>{granularity === "day" ? "Date" : "Month"}</th>
            <th>Change vs previous</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.key}>
              <td>{formatFull(p.key, granularity)}</td>
              <td>{p.value == null ? "—" : fmtSigned(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
