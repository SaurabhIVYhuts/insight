import React from "react";
import RegionBarChart from "./RegionBarChart";

const DEFAULT_TITLES = { degree: "Degree-seeking", exchange: "Exchange students" };

// Two small charts side by side (stacked below 700px). The keys of `byLevel`
// drive the panels, so a place can supply any splits (e.g. "bachelors" /
// "masters") together with titles in meta.titles.
export default function SplitBarCharts({ byLevel = {}, meta = {} }) {
  const keys = Object.keys(byLevel).filter((k) => byLevel[k] && byLevel[k].length);
  if (!keys.length) return null;
  return (
    <div className="mi-split">
      {keys.map((k) => (
        <RegionBarChart
          key={k}
          title={(meta.titles && meta.titles[k]) || DEFAULT_TITLES[k] || k}
          items={byLevel[k]}
          estimated={meta.estimated}
        />
      ))}
      {meta.note && <p className="mi-foot mi-split-foot">{meta.note}</p>}
    </div>
  );
}
