"use client";

import { useState, useRef, useEffect } from "react";
import { ALL_COUNTRIES, COUNTRY_CITIES } from "@/lib/countryCities";

interface Props {
  selected: string[];
  onChange: (countries: string[]) => void;
}

const REGION_ORDER = [
  "West Africa",
  "East Africa",
  "Southern Africa",
  "North Africa",
  "Europe",
  "Americas",
  "Middle East",
  "Asia",
  "Oceania",
];

const COUNTRY_REGION: Record<string, string> = {
  Ghana: "West Africa", Nigeria: "West Africa", Senegal: "West Africa",
  "Côte d'Ivoire": "West Africa", "Burkina Faso": "West Africa", Mali: "West Africa",
  Togo: "West Africa", Benin: "West Africa", "Sierra Leone": "West Africa",
  Liberia: "West Africa", Guinea: "West Africa", Gambia: "West Africa",
  Kenya: "East Africa", Tanzania: "East Africa", Uganda: "East Africa",
  Rwanda: "East Africa", Ethiopia: "East Africa", "South Sudan": "East Africa",
  "South Africa": "Southern Africa", Zimbabwe: "Southern Africa", Zambia: "Southern Africa",
  Botswana: "Southern Africa", Mozambique: "Southern Africa",
  Egypt: "North Africa", Morocco: "North Africa", Tunisia: "North Africa", Algeria: "North Africa",
  "United Kingdom": "Europe", France: "Europe", Germany: "Europe", Spain: "Europe",
  Italy: "Europe", Netherlands: "Europe", Belgium: "Europe", Switzerland: "Europe",
  Portugal: "Europe", Sweden: "Europe", Norway: "Europe", Denmark: "Europe",
  Finland: "Europe", Poland: "Europe", Ireland: "Europe",
  "United States": "Americas", Canada: "Americas", Brazil: "Americas", Mexico: "Americas",
  Colombia: "Americas", Argentina: "Americas", Chile: "Americas", Peru: "Americas",
  Jamaica: "Americas", Trinidad: "Americas",
  "United Arab Emirates": "Middle East", "Saudi Arabia": "Middle East", Qatar: "Middle East",
  Kuwait: "Middle East", Bahrain: "Middle East", Oman: "Middle East",
  Jordan: "Middle East", Lebanon: "Middle East",
  India: "Asia", Pakistan: "Asia", Bangladesh: "Asia", "Sri Lanka": "Asia",
  China: "Asia", Japan: "Asia", "South Korea": "Asia", Singapore: "Asia",
  Malaysia: "Asia", Indonesia: "Asia", Philippines: "Asia", Thailand: "Asia",
  Vietnam: "Asia", Cambodia: "Asia",
  Australia: "Oceania", "New Zealand": "Oceania",
};

const COUNTRY_FLAG: Record<string, string> = {
  Ghana: "🇬🇭", Nigeria: "🇳🇬", Senegal: "🇸🇳", "Côte d'Ivoire": "🇨🇮",
  "Burkina Faso": "🇧🇫", Mali: "🇲🇱", Togo: "🇹🇬", Benin: "🇧🇯",
  "Sierra Leone": "🇸🇱", Liberia: "🇱🇷", Guinea: "🇬🇳", Gambia: "🇬🇲",
  Kenya: "🇰🇪", Tanzania: "🇹🇿", Uganda: "🇺🇬", Rwanda: "🇷🇼",
  Ethiopia: "🇪🇹", "South Sudan": "🇸🇸",
  "South Africa": "🇿🇦", Zimbabwe: "🇿🇼", Zambia: "🇿🇲",
  Botswana: "🇧🇼", Mozambique: "🇲🇿",
  Egypt: "🇪🇬", Morocco: "🇲🇦", Tunisia: "🇹🇳", Algeria: "🇩🇿",
  "United Kingdom": "🇬🇧", France: "🇫🇷", Germany: "🇩🇪", Spain: "🇪🇸",
  Italy: "🇮🇹", Netherlands: "🇳🇱", Belgium: "🇧🇪", Switzerland: "🇨🇭",
  Portugal: "🇵🇹", Sweden: "🇸🇪", Norway: "🇳🇴", Denmark: "🇩🇰",
  Finland: "🇫🇮", Poland: "🇵🇱", Ireland: "🇮🇪",
  "United States": "🇺🇸", Canada: "🇨🇦", Brazil: "🇧🇷", Mexico: "🇲🇽",
  Colombia: "🇨🇴", Argentina: "🇦🇷", Chile: "🇨🇱", Peru: "🇵🇪",
  Jamaica: "🇯🇲", Trinidad: "🇹🇹",
  "United Arab Emirates": "🇦🇪", "Saudi Arabia": "🇸🇦", Qatar: "🇶🇦",
  Kuwait: "🇰🇼", Bahrain: "🇧🇭", Oman: "🇴🇲", Jordan: "🇯🇴", Lebanon: "🇱🇧",
  India: "🇮🇳", Pakistan: "🇵🇰", Bangladesh: "🇧🇩", "Sri Lanka": "🇱🇰",
  China: "🇨🇳", Japan: "🇯🇵", "South Korea": "🇰🇷", Singapore: "🇸🇬",
  Malaysia: "🇲🇾", Indonesia: "🇮🇩", Philippines: "🇵🇭", Thailand: "🇹🇭",
  Vietnam: "🇻🇳", Cambodia: "🇰🇭",
  Australia: "🇦🇺", "New Zealand": "🇳🇿",
};

export function CountryPicker({ selected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const toggle = (country: string) => {
    if (selected.includes(country)) {
      onChange(selected.filter((c) => c !== country));
    } else {
      onChange([...selected, country]);
    }
  };

  const filtered = query.trim()
    ? ALL_COUNTRIES.filter((c) => c.toLowerCase().includes(query.toLowerCase()))
    : ALL_COUNTRIES;

  // Group by region
  const byRegion: Record<string, string[]> = {};
  for (const c of filtered) {
    const region = COUNTRY_REGION[c] ?? "Other";
    (byRegion[region] ??= []).push(c);
  }
  const regions = REGION_ORDER.filter((r) => byRegion[r]?.length > 0);

  const totalCities = selected.reduce((sum, c) => sum + (COUNTRY_CITIES[c]?.length ?? 0), 0);

  return (
    <div>
      <label className="text-xs text-ink-secondary block mb-1.5">
        Target countries
      </label>

      {/* Selected pills */}
      <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
        {selected.length === 0 && (
          <span className="text-xs text-ink-muted italic">No countries selected — add one below</span>
        )}
        {selected.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-brand/15 text-brand border border-brand/30"
          >
            {COUNTRY_FLAG[c] ?? "🌍"} {c}
            <button
              type="button"
              onClick={() => toggle(c)}
              className="ml-0.5 text-brand/60 hover:text-brand leading-none"
              aria-label={`Remove ${c}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {selected.length > 0 && (
        <p className="text-[11px] text-ink-muted mb-2">
          {totalCities} cities across {selected.length} {selected.length === 1 ? "country" : "countries"} — Scout will rotate through all of them.
        </p>
      )}

      {/* Dropdown trigger */}
      <div ref={ref} className="relative">
        <input
          type="text"
          placeholder="Search and add a country…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          className="w-full text-sm"
        />

        {open && (
          <div className="absolute z-50 mt-1 w-full max-h-72 overflow-y-auto rounded-xl border border-border-c bg-surface shadow-lg">
            {filtered.length === 0 ? (
              <p className="text-xs text-ink-muted px-3 py-2">No countries match "{query}"</p>
            ) : (
              regions.map((region) => (
                <div key={region}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted px-3 pt-2 pb-0.5 sticky top-0 bg-surface">
                    {region}
                  </p>
                  {byRegion[region].map((country) => {
                    const isSelected = selected.includes(country);
                    const cityCount = COUNTRY_CITIES[country]?.length ?? 0;
                    return (
                      <button
                        key={country}
                        type="button"
                        onClick={() => { toggle(country); setQuery(""); }}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 text-sm text-left transition-colors ${
                          isSelected
                            ? "bg-brand/10 text-brand"
                            : "hover:bg-surface-2 text-ink"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span>{COUNTRY_FLAG[country] ?? "🌍"}</span>
                          <span>{country}</span>
                        </span>
                        <span className="flex items-center gap-2 text-xs text-ink-muted shrink-0">
                          <span>{cityCount} {cityCount === 1 ? "city" : "cities"}</span>
                          {isSelected && <span className="text-brand font-bold">✓</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
