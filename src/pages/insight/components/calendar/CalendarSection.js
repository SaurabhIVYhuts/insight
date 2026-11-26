import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Info, ExternalLink } from "lucide-react";
import PlaceSelector from "./PlaceSelector";
import KpiTiles from "./KpiTiles";
import RegionBarChart from "./RegionBarChart";
import IntakeCalendar from "./IntakeCalendar";
import SplitBarCharts from "./SplitBarCharts";
import VisaCard from "./VisaCard";
import Estimated from "./Estimated";
import { ChartSkeleton } from "../SkeletonBlocks";
import { listPlaces, loadPlace } from "../../../../services/placesData";
import "./calendar.css";

const DEFAULT_PLACE = "australia";

function Skeleton() {
  return (
    <div className="mi-skel" aria-busy="true" aria-label="Loading market data">
      <div className="mi-kpis">
        {[0, 1, 2].map((i) => (
          <div key={i} className="insight-skeleton" style={{ height: 78, borderRadius: 12 }} />
        ))}
      </div>
      <ChartSkeleton height={260} />
      <ChartSkeleton height={110} />
    </div>
  );
}

function EmptyMarket({ id }) {
  const name = id || "this market";
  const subject = encodeURIComponent(`Market request: ${name}`);
  const body = encodeURIComponent(`Please add market insights for: ${name}`);
  return (
    <div className="mi-empty">
      <p>
        <b>No market data for {name} yet.</b>
      </p>
      <p>Pick another place above, or ask for this one to be added.</p>
      <a className="mi-btn" href={`mailto:?subject=${subject}&body=${body}`}>
        Request this market
      </a>
    </div>
  );
}

export default function CalendarSection() {
  const [params, setParams] = useSearchParams();
  const places = useMemo(listPlaces, []);
  const placeId = params.get("place") || DEFAULT_PLACE;
  const [state, setState] = useState({ loading: true, result: null });

  useEffect(() => {
    let live = true;
    setState({ loading: true, result: null });
    loadPlace(placeId).then((result) => live && setState({ loading: false, result }));
    return () => {
      live = false;
    };
  }, [placeId]);

  const select = (id) => {
    const next = new URLSearchParams(params);
    next.set("tab", "calendar");
    next.set("place", id);
    setParams(next);
  };

  const { loading, result } = state;
  const d = result && result.data;
  const m = (d && d.meta) || {};

  return (
    <section className="insight-section">
      <div className="insight-section-intro">
        <h2>Calendar</h2>
        <p>Where students come from, when the intakes are, who studies how, and visa context for a country or city.</p>
      </div>

      <div className="mi-cal" data-place={placeId}>
        <PlaceSelector places={places} value={placeId} onSelect={select} />

        {loading && <Skeleton />}
        {!loading && !result && <EmptyMarket id={params.get("place")} />}

        {!loading && result && (
          <div className="mi-body">
            {result.fallbackFrom && (
              <p className="mi-note" role="status">
                <Info size={14} aria-hidden="true" /> City-level data isn't published. Showing national figures for {result.fallbackFrom.name}.
              </p>
            )}
            {d.placeholder && (
              <p className="mi-note mi-note-warn" role="status">
                <Estimated /> Placeholder data for layout testing. Replace with published figures before sharing.
              </p>
            )}

            {!(d.kpis && d.kpis.length) && !(d.sourceCountries && d.sourceCountries.length) && (
              <p className="mi-note" role="status">
                <Info size={14} aria-hidden="true" /> Student-origin figures for {d.name} haven't been added yet. Intake timing and visa links are shown below.
              </p>
            )}

            <KpiTiles kpis={d.kpis} />

            {d.sourceCountries && d.sourceCountries.length > 0 && (
              <>
                <h3 className="mi-h">Where students come from</h3>
                <RegionBarChart
                  items={d.sourceCountries}
                  ariaLabel={`Top source countries for ${d.name}`}
                  estimated={m.sourceCountries && m.sourceCountries.estimated}
                  footnote={m.sourceCountries && m.sourceCountries.note}
                />
              </>
            )}

            {d.intakes && d.intakes.length > 0 && (
              <>
                <h3 className="mi-h">Intake calendar</h3>
                <IntakeCalendar intakes={d.intakes} footnote={m.intakes && m.intakes.note} />
              </>
            )}

            {d.byLevel && (
              <>
                <h3 className="mi-h">Degree vs exchange</h3>
                <SplitBarCharts byLevel={d.byLevel} meta={m.byLevel} />
              </>
            )}

            {d.visa && (
              <>
                <h3 className="mi-h">Visa and entry</h3>
                <VisaCard visa={d.visa} lastUpdated={d.lastUpdated} placeName={d.name} />
              </>
            )}

            <footer className="mi-sources">
              <h3 className="mi-h">Sources</h3>
              <ul>
                {(d.sources || []).map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noopener noreferrer">
                      {s.title} <ExternalLink size={11} aria-hidden="true" />
                    </a>
                    {s.year ? ` (${s.year})` : ""}
                  </li>
                ))}
              </ul>
              <p className="mi-foot">Last updated {d.lastUpdated}.</p>
            </footer>
          </div>
        )}
      </div>
    </section>
  );
}
