"use client";

import { useEffect, useState } from "react";
import {
  explainGeoError,
  placeSourceLabel,
  type Place,
} from "@/lib/place";
import { reversePlace, searchPlaces } from "@/lib/open-meteo";
import { roundCoords } from "@/lib/privacy";
import { usePlace } from "./usePlace";

type Hit = { name: string; lat: number; lon: number; timezone: string | null };
type GpsPerm = "prompt" | "granted" | "denied" | "unknown";

export function LocationFields() {
  const { place, updatePlace } = usePlace();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [gpsPerm, setGpsPerm] = useState<GpsPerm>("unknown");
  const [geoOk, setGeoOk] = useState(false);
  const [probed, setProbed] = useState(false);

  useEffect(() => {
    const available = Boolean(navigator.geolocation);
    setGeoOk(available);
    if (!available) {
      setGpsPerm("denied");
      setProbed(true);
      return;
    }
    let cancelled = false;
    const perm = navigator.permissions;
    if (!perm?.query) {
      setProbed(true);
      return;
    }
    void perm
      .query({ name: "geolocation" })
      .then((status) => {
        if (cancelled) return;
        const apply = () => {
          if (status.state === "granted" || status.state === "denied" || status.state === "prompt") {
            setGpsPerm(status.state);
          }
        };
        apply();
        status.onchange = apply;
        setProbed(true);
      })
      .catch(() => {
        if (!cancelled) {
          setGpsPerm("unknown");
          setProbed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      void searchPlaces(q)
        .then((results) => setHits(results))
        .catch(() => setHits([]));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [query]);

  async function choose(hit: Hit, source: Place["source"]) {
    const coarse = roundCoords(hit.lat, hit.lon);
    const next: Place = {
      lat: coarse.lat,
      lon: coarse.lon,
      name: hit.name,
      timezone: hit.timezone,
      source,
    };
    updatePlace(next);
    setQuery("");
    setHits([]);
    setNote(null);
  }

  async function locateFromGps() {
    if (!navigator.geolocation) {
      setNote(explainGeoError(undefined, place?.name));
      return;
    }
    setBusy("gps");
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const coarse = roundCoords(pos.coords.latitude, pos.coords.longitude);
          const hit = await reversePlace(coarse.lat, coarse.lon);
          await choose(hit, "gps");
          setGpsPerm("granted");
        } catch {
          setNote(
            place
              ? `GPS worked, but naming the pin failed. ${place.name} is still used.`
              : "GPS worked, but naming the pin failed. Search a city instead.",
          );
        } finally {
          setBusy(null);
        }
      },
      (err) => {
        setBusy(null);
        setGpsPerm((current) => (err.code === 1 ? "denied" : current));
        setNote(explainGeoError(err.code, place?.name));
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
  }

  return (
    <div>
      {place ? (
        <p className="text-sm text-paper">
          {place.name}
          <span className="text-muted">
            {" "}
            · {place.lat.toFixed(2)}, {place.lon.toFixed(2)} · {placeSourceLabel(place.source)}
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted">No location yet. GPS or a city name — never your IP.</p>
      )}

      {probed && (gpsPerm === "denied" || !geoOk) && (
        <p className="mt-2 text-xs text-muted">
          This browser has GPS blocked (denied, or no prompt in a preview). City
          search still works.
        </p>
      )}

      <button
        type="button"
        onClick={() => void locateFromGps()}
        disabled={busy != null}
        className="mt-3 w-full rounded-full bg-lime px-3 py-2 text-sm text-ink disabled:opacity-40"
      >
        {busy === "gps" ? "Locating…" : "Use GPS (rounded, not a street pin)"}
      </button>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search city"
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
          onClick={() => {
            updatePlace(null);
            setNote(null);
          }}
          className="mt-3 text-xs text-muted"
        >
          Clear location
        </button>
      )}
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </div>
  );
}
