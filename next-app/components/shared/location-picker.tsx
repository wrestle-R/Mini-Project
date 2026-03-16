"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FiMapPin, FiSearch, FiX } from "react-icons/fi";

export interface LocationValue {
  displayName: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  country: string;
  zipCode: string;
  street: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    suburb?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

function extractLocation(r: NominatimResult): LocationValue {
  const a = r.address;
  return {
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    street: [a.road, a.suburb].filter(Boolean).join(", "),
    city: a.city || a.town || a.village || a.county || "",
    state: a.state || "",
    country: a.country || "",
    zipCode: a.postcode || "",
  };
}

interface LeafletMapProps {
  lat: number;
  lng: number;
  zoom: number;
  onMapClick: (lat: number, lng: number) => void;
}

/* Lazy-load the map so leaflet (browser-only) never runs on server */
const LeafletMap = dynamic<LeafletMapProps>(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="h-52 w-full rounded-xl border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

interface LocationPickerProps {
  value?: Partial<LocationValue>;
  onChange: (loc: LocationValue) => void;
  label?: string;
}

export function LocationPicker({ value, onChange, label }: LocationPickerProps) {
  const [query, setQuery] = useState(value?.displayName || "");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selected, setSelected] = useState<LocationValue | null>(
    value?.lat && value?.lng ? (value as LocationValue) : null
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search Nominatim on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query === selected?.displayName) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5&countrycodes=in`;
        const res = await fetch(url, { headers: { "Accept-Language": "en" } });
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setShowDropdown(data.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = useCallback((r: NominatimResult) => {
    const loc = extractLocation(r);
    setSelected(loc);
    setQuery(r.display_name);
    setShowDropdown(false);
    setResults([]);
    onChange(loc);
  }, [onChange]);

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
      const res = await fetch(url, { headers: { "Accept-Language": "en" } });
      const data: NominatimResult = await res.json();
      const loc = extractLocation(data);
      setSelected(loc);
      setQuery(data.display_name);
      onChange(loc);
    } catch {
      // fallback: just store lat/lng without geocoding
      const loc: LocationValue = {
        displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat, lng, city: "", state: "", country: "", zipCode: "", street: "",
      };
      setSelected(loc);
      setQuery(loc.displayName);
      onChange(loc);
    }
  }, [onChange]);

  const clearSelection = () => {
    setQuery("");
    setSelected(null);
    setResults([]);
    setShowDropdown(false);
  };

  return (
    <div className="space-y-3">
      {label && <Label className="text-xs font-medium text-muted-foreground">{label}</Label>}

      {/* Search input */}
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowDropdown(true)}
            placeholder="Search for a location…"
            className="pl-8 pr-8 h-10 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={clearSelection}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <FiX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover shadow-lg overflow-hidden">
            {loading ? (
              <div className="px-3 py-2.5 text-sm text-muted-foreground">Searching…</div>
            ) : (
              results.map(r => (
                <button
                  key={r.place_id}
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors flex items-start gap-2 border-b border-border/40 last:border-0"
                >
                  <FiMapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{r.display_name}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected location details */}
      {selected && (
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
          {selected.city && <p><span className="font-medium text-foreground">City:</span> {selected.city}</p>}
          {selected.state && <p><span className="font-medium text-foreground">State:</span> {selected.state}</p>}
          {selected.zipCode && <p><span className="font-medium text-foreground">PIN:</span> {selected.zipCode}</p>}
          {selected.country && <p><span className="font-medium text-foreground">Country:</span> {selected.country}</p>}
        </div>
      )}

      {/* Map */}
      <LeafletMap
        lat={selected?.lat ?? 20.5937}
        lng={selected?.lng ?? 78.9629}
        zoom={selected ? 14 : 5}
        onMapClick={handleMapClick}
      />

      <p className="text-[10px] text-muted-foreground">
        Search above or click anywhere on the map to set your location.
      </p>
    </div>
  );
}
