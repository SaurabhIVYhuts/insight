import React from "react";
import Estimated from "./Estimated";
import { full } from "./format";

export default function KpiTiles({ kpis = [] }) {
  if (!kpis.length) return null;
  return (
    <div className="mi-kpis" role="list">
      {kpis.map((k) => {
        const hasDelta = typeof k.delta === "number";
        const up = hasDelta && k.delta >= 0;
        return (
          <div className="mi-kpi" role="listitem" key={k.label}>
            <span className="mi-kpi-label">
              {k.label} {k.estimated && <Estimated />}
            </span>
            <span className="mi-kpi-value">{typeof k.value === "number" ? full(k.value) : k.value}</span>
            <span className="mi-kpi-sub">
              {k.sub}
              {hasDelta && (
                <span className={`mi-delta ${up ? "up" : "down"}`}>
                  {" "}
                  {up ? "▲ +" : "▼ "}
                  {k.delta.toFixed(1)}% YoY
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
