"use client";

import { useEffect, useState } from "react";
import type { Place } from "@/lib/place";
import { usePlace } from "./usePlace";

type Hit = { name: string; lat: number; lon: number; timezone: string | null };

export function LocationFields() {
  const { place, updatePlace } = usePlace();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((body) => setHits((body.results ?? []) as Hit[]))
        .catch(() => setHits([]));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [query]);

  async function choose(hit: Hit, source: Place["source"]) {
    const next: Place = {
      lat: hit.lat,
      lon: hit.lon,
      name: hit.name,
      timezone: hit.timezone,
      source,
    };
    updatePlace(next);
    setQuery("");
    setHits([]);
    setNote(null);
  }

  async function useGps() {
    if (!navigator.geolocation) {
      setNote("This browser has no geolocation.");
      return;
    }
    setBusy("gps");
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const res = await fetch(`/api/geocode?lat=${lat}&lon=${lon}`);
          const body = await res.json();
          const hit = (body.results?.[0] as Hit | undefined) ?? {
            name: `${lat.toFixed(3)}, ${lon.toFixed(3)}`,
            lat,
            lon,
            timezone: null,
          };
          await choose(hit, "gps");
        } catch {
          setNote("GPS worked but reverse-geocode failed. Try a city name.");
        } finally {
          setBusy(null);
        }
      },
      () => {
        setBusy(null);
        setNote("Location permission denied. Search a city instead.");
      },
      { enableHighAccuracy: false, timeout: 12000 },
    );
  }

  async function useIp() {
    setBusy("ip");
    setNote(null);
    try {
      const res = await fetch("https://ipwho.is/");
      const body = (await res.json()) as {
        success?: boolean;
        city?: string;
        region?: string;
        country?: string;
        latitude?: number;
        longitude?: number;
        timezone?: { id?: string };
      };
      if (!body.success || body.latitude == null || body.longitude == null) {
        throw new Error("ipwho.is had no coordinates");
      }
      await choose(
        {
          name: [body.city, body.region, body.country].filter(Boolean).join(", "),
          lat: body.latitude,
          lon: body.longitude,
          timezone: body.timezone?.id ?? null,
        },
        "ip",
      );
    } catch {
      setNote("Approximate IP location failed. Use GPS or type a city.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {place ? (
        <p className="text-sm text-paper">
          {place.name}
          <span className="text-muted">
            {" "}
            · {place.lat.toFixed(3)}, {place.lon.toFixed(3)} · {place.source}
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted">No location yet.</p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void useGps()}
          disabled={busy != null}
          className="rounded-full bg-lime px-3 py-2 text-sm text-ink"
        >
          {busy === "gps" ? "Locating…" : "Use GPS"}
        </button>
        <button
          type="button"
          onClick={() => void useIp()}
          disabled={busy != null}
          className="rounded-full border border-white/15 px-3 py-2 text-sm"
        >
          {busy === "ip" ? "Looking up…" : "Approximate"}
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search city — Open-Meteo geocoding"
        className="mt-3 w-full rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-paper outline-none placeholder:text-muted"
      />
      {hits.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-2xl border border-white/10">
          {hits.map((hit) => (
            <li key={`${hit.lat}-${hit.lon}`}>
              <button
                type="button"
                onClick={() => void choose(hit, "search")}
                className="w-full px-3 py-2 text-left text-sm hover:bg-white/6"
              >
                {hit.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {place && (
        <button
          type="button"
          onClick={() => updatePlace(null)}
          className="mt-3 text-xs text-muted"
        >
          Clear location
        </button>
      )}
      {note && <p className="mt-2 text-xs text-ember">{note}</p>}
    </div>
  );
}
