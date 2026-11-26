import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, MapPin, Globe2 } from "lucide-react";

// Searchable combobox, grouped Countries / Cities. Arrow keys + Enter + Esc.
export default function PlaceSelector({ places, value, onSelect }) {
  const selected = [...places.countries, ...places.cities].find((p) => p.id === value);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const root = useRef(null);
  const parentName = useMemo(() => Object.fromEntries(places.countries.map((c) => [c.id, c.name])), [places]);

  const groups = useMemo(() => {
    const t = q.trim().toLowerCase();
    const match = (p) => !t || [p.name, ...(p.aliases || [])].some((s) => s.toLowerCase().includes(t));
    return [
      { label: "Countries", Icon: Globe2, items: places.countries.filter(match) },
      { label: "Cities", Icon: MapPin, items: places.cities.filter(match) },
    ].filter((g) => g.items.length);
  }, [places, q]);
  const flat = groups.flatMap((g) => g.items);

  useEffect(() => {
    const away = (e) => root.current && !root.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const choose = (p) => {
    onSelect(p.id);
    setOpen(false);
    setQ("");
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHi((h) => Math.min(h + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && open && flat[hi]) {
      e.preventDefault();
      choose(flat[hi]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="mi-select" ref={root}>
      <label className="mi-select-label" htmlFor="mi-place-input">
        Select country or city
      </label>
      <div className="mi-select-box">
        <Search size={15} aria-hidden="true" />
        <input
          id="mi-place-input"
          role="combobox"
          aria-expanded={open}
          aria-controls="mi-place-list"
          aria-autocomplete="list"
          aria-activedescendant={open && flat[hi] ? `mi-opt-${flat[hi].id}` : undefined}
          autoComplete="off"
          placeholder={selected ? selected.name : "Search places"}
          value={open ? q : selected ? selected.name : ""}
          onFocus={() => {
            setOpen(true);
            setQ("");
            setHi(0);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setHi(0);
          }}
          onKeyDown={onKey}
        />
      </div>
      {open && (
        <div className="mi-select-menu" id="mi-place-list" role="listbox">
          {groups.length === 0 && <p className="mi-select-none">No matching place. Try another name.</p>}
          {groups.map((g) => (
            <div role="group" aria-label={g.label} key={g.label}>
              <p className="mi-select-group">{g.label}</p>
              {g.items.map((p) => {
                const idx = flat.indexOf(p);
                return (
                  <div
                    key={p.id}
                    id={`mi-opt-${p.id}`}
                    role="option"
                    aria-selected={p.id === value}
                    className={`mi-select-opt${idx === hi ? " hi" : ""}`}
                    onMouseEnter={() => setHi(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      choose(p);
                    }}
                  >
                    <g.Icon size={14} aria-hidden="true" /> {p.name}
                    {p.type === "city" && p.parentCountry && <small>{parentName[p.parentCountry] || p.parentCountry}</small>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
