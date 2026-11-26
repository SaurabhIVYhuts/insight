import React from "react";
import { ExternalLink } from "lucide-react";
import Estimated from "./Estimated";
import RegionBarChart from "./RegionBarChart";
import { field, fmtAsOf } from "./format";

const ROWS = [
  ["fee", "Visa fee"],
  ["financialProof", "Financial proof"],
  ["processing", "Processing time"],
  ["workRights", "Work rights"],
];

export default function VisaCard({ visa, lastUpdated, placeName }) {
  if (!visa) return null;
  const g = visa.grantRates;
  return (
    <div className="mi-visa">
      <dl className="mi-visa-list">
        {ROWS.filter(([k]) => visa[k]).map(([k, label]) => {
          const f = field(visa[k]);
          const stamp =
            [f.asOf && `As of ${fmtAsOf(f.asOf)}`, f.source && `Source: ${f.source}`].filter(Boolean).join(" · ") ||
            `Last updated ${lastUpdated}`;
          return (
            <div key={k}>
              <dt>{label}</dt>
              <dd>
                {f.value} {f.estimated && <Estimated />}
                <small>{stamp}</small>
              </dd>
            </div>
          );
        })}
      </dl>
      {g && g.items && g.items.length > 0 && (
        <RegionBarChart
          title={`${g.title || "Grant rate by nationality"}${g.asOf ? ` (${fmtAsOf(g.asOf)})` : ""}`}
          items={g.items}
          unit="granted"
          valueSuffix={g.unit || "%"}
          estimated={g.estimated}
          footnote={g.note}
        />
      )}
      {visa.notes && <p className="mi-foot">{visa.notes}</p>}
      <p className="mi-foot">
        Visa rules and grant rates change often. Last updated {lastUpdated}.{" "}
        {visa.officialUrl && (
          <a href={visa.officialUrl} target="_blank" rel="noopener noreferrer">
            Check official site{placeName ? ` for ${placeName}` : ""} <ExternalLink size={11} aria-hidden="true" />
          </a>
        )}
      </p>
    </div>
  );
}
