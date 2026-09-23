"use client";

import { useEffect, useState } from "react";
import { parseLocaleNumber } from "@ajeenckya/engine";
import type { Athlete, Units } from "@/lib/athlete";
import {
  bodyMassIndex,
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  lbToKg,
  validHeightCm,
  validWeightKg,
} from "@/lib/athlete";
import { useLab } from "./useLab";

const fieldClass =
  "mt-1 min-h-11 w-full rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-paper";

export function AthleteFields() {
  const { athlete, updateAthlete } = useLab();
  const imperial = athlete.units === "imperial";
  const ftIn = athlete.heightCm != null ? cmToFeetInches(athlete.heightCm) : { feet: 5, inches: 0 };
  const [ageText, setAgeText] = useState(String(athlete.age));
  const [heightText, setHeightText] = useState("");
  const [weightText, setWeightText] = useState("");
  const [feetText, setFeetText] = useState("");
  const [inchText, setInchText] = useState("");
  const [restText, setRestText] = useState("");
  const [maxText, setMaxText] = useState("");
  const [sbpText, setSbpText] = useState("");
  const bmi =
    athlete.weightKg != null && athlete.heightCm != null
      ? bodyMassIndex(athlete.weightKg, athlete.heightCm)
      : null;

  useEffect(() => {
    setAgeText(String(athlete.age));
    setHeightText(athlete.heightCm != null ? String(athlete.heightCm) : "");
    setFeetText(athlete.heightCm != null ? String(cmToFeetInches(athlete.heightCm).feet) : "");
    setInchText(athlete.heightCm != null ? String(cmToFeetInches(athlete.heightCm).inches) : "");
    setWeightText(
      athlete.weightKg == null
        ? ""
        : imperial
          ? String(Math.round(kgToLb(athlete.weightKg) * 10) / 10)
          : String(athlete.weightKg),
    );
    setRestText(athlete.restHrOverride != null ? String(athlete.restHrOverride) : "");
    setMaxText(athlete.maxHrOverride != null ? String(athlete.maxHrOverride) : "");
    setSbpText(athlete.systolicMmHg != null ? String(athlete.systolicMmHg) : "");
  }, [
    athlete.age,
    athlete.heightCm,
    athlete.maxHrOverride,
    athlete.restHrOverride,
    athlete.systolicMmHg,
    athlete.weightKg,
    imperial,
  ]);

  function setUnits(units: Units) {
    updateAthlete({ units });
  }

  return (
    <div className="mt-4 space-y-4">
      <label className="block text-xs text-muted">
        Name
        <input
          type="text"
          autoComplete="given-name"
          maxLength={40}
          placeholder="What to call you"
          value={athlete.displayName}
          onChange={(e) => updateAthlete({ displayName: e.target.value })}
          className={fieldClass}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted">
          Age
          <input
            type="number"
            min={16}
            max={90}
            inputMode="numeric"
            value={ageText}
            onChange={(e) => {
              const next = e.target.value;
              setAgeText(next);
              const n = Number(next);
              if (Number.isFinite(n) && n >= 16 && n <= 90) {
                updateAthlete({ age: n });
              }
            }}
            onBlur={() => {
              const n = Number(ageText);
              if (Number.isFinite(n) && n >= 16 && n <= 90) {
                updateAthlete({ age: n });
                return;
              }
              setAgeText(String(athlete.age));
            }}
            className={fieldClass}
          />
        </label>
        <label className="text-xs text-muted">
          Sex
          <select
            value={athlete.sex}
            onChange={(e) =>
              updateAthlete({ sex: e.target.value as Athlete["sex"] })
            }
            className={fieldClass}
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="unspecified">Unspecified</option>
          </select>
        </label>
      </div>

      <div>
        <p className="text-xs text-muted">Units for height and weight</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setUnits("metric")}
            className={`rounded-full py-2 text-sm ${athlete.units === "metric" ? "bg-lime text-ink" : "border border-white/15"}`}
          >
            cm / kg
          </button>
          <button
            type="button"
            onClick={() => setUnits("imperial")}
            className={`rounded-full py-2 text-sm ${imperial ? "bg-lime text-ink" : "border border-white/15"}`}
          >
            ft / lb
          </button>
        </div>
      </div>

      {imperial ? (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">
            Height (ft)
            <input
              type="number"
              min={4}
              max={7}
              inputMode="numeric"
              placeholder="5"
              value={feetText}
              onChange={(e) => {
                const next = e.target.value;
                setFeetText(next);
                if (next === "") {
                  updateAthlete({ heightCm: null });
                  return;
                }
                const cm = feetInchesToCm(Number(next) || 0, Number(inchText) || 0);
                if (validHeightCm(cm)) updateAthlete({ heightCm: cm });
              }}
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-muted">
            Height (in)
            <input
              type="number"
              min={0}
              max={11}
              inputMode="numeric"
              placeholder="10"
              value={inchText}
              onChange={(e) => {
                const next = e.target.value;
                setInchText(next);
                const cm = feetInchesToCm(Number(feetText) || ftIn.feet, Number(next) || 0);
                if (validHeightCm(cm)) updateAthlete({ heightCm: cm });
              }}
              className={fieldClass}
            />
          </label>
          <label className="col-span-2 text-xs text-muted">
            Weight (lb)
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-label="Weight in pounds"
              placeholder="154"
              value={weightText}
              onChange={(e) => {
                const next = e.target.value;
                setWeightText(next);
                if (next.trim() === "") {
                  updateAthlete({ weightKg: null });
                  return;
                }
                const pounds = parseLocaleNumber(next);
                if (pounds == null) return;
                const kg = lbToKg(pounds);
                if (validWeightKg(kg)) updateAthlete({ weightKg: kg });
              }}
              className={fieldClass}
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted">
            Height (cm)
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-label="Height in centimeters"
              placeholder="175"
              value={heightText}
              onChange={(e) => {
                const next = e.target.value;
                setHeightText(next);
                if (next.trim() === "") {
                  updateAthlete({ heightCm: null });
                  return;
                }
                const cm = parseLocaleNumber(next);
                if (cm != null && validHeightCm(cm)) updateAthlete({ heightCm: cm });
              }}
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-muted">
            Weight (kg)
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              aria-label="Weight in kilograms"
              placeholder="70"
              value={weightText}
              onChange={(e) => {
                const next = e.target.value;
                setWeightText(next);
                if (next.trim() === "") {
                  updateAthlete({ weightKg: null });
                  return;
                }
                const kg = parseLocaleNumber(next);
                if (kg != null && validWeightKg(kg)) updateAthlete({ weightKg: kg });
              }}
              className={fieldClass}
            />
          </label>
        </div>
      )}

      {bmi != null && (
        <p className="text-sm text-paper">
          BMI {bmi.toFixed(1)}
          <span className="text-muted"> · stays on this phone</span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-muted">
          Resting HR
          <input
            type="number"
            min={30}
            max={110}
            inputMode="numeric"
            placeholder="Band / 60"
            value={restText}
            onChange={(e) => {
              const next = e.target.value;
              setRestText(next);
              if (next === "") {
                updateAthlete({ restHrOverride: null });
                return;
              }
              const n = Number(next);
              if (Number.isFinite(n) && n >= 30 && n <= 110) {
                updateAthlete({ restHrOverride: n });
              }
            }}
            className={fieldClass}
          />
        </label>
        <label className="text-xs text-muted">
          HRmax override
          <input
            type="number"
            min={120}
            max={230}
            inputMode="numeric"
            placeholder="Tanaka"
            value={maxText}
            onChange={(e) => {
              const next = e.target.value;
              setMaxText(next);
              if (next === "") {
                updateAthlete({ maxHrOverride: null });
                return;
              }
              const n = Number(next);
              if (Number.isFinite(n) && n >= 120 && n <= 230) {
                updateAthlete({ maxHrOverride: n });
              }
            }}
            className={fieldClass}
          />
        </label>
        <label className="col-span-2 text-xs text-muted">
          Cycle day (1–28, optional)
          <input
            type="number"
            min={1}
            max={28}
            inputMode="numeric"
            value={athlete.cycleDay ?? ""}
            onChange={(e) =>
              updateAthlete({
                cycleDay: e.target.value ? Number(e.target.value) : null,
              })
            }
            className={fieldClass}
          />
        </label>
        <label className="col-span-2 text-xs text-muted">
          Systolic BP (optional, mmHg)
          <input
            type="number"
            min={80}
            max={220}
            inputMode="numeric"
            placeholder="Home cuff"
            value={sbpText}
            onChange={(e) => {
              const next = e.target.value;
              setSbpText(next);
              if (next === "") {
                updateAthlete({ systolicMmHg: null });
                return;
              }
              const n = Number(next);
              if (Number.isFinite(n) && n >= 80 && n <= 220) {
                updateAthlete({ systolicMmHg: n });
              }
            }}
            className={fieldClass}
          />
        </label>
      </div>
      <p className="text-xs text-muted">
        Home systolic is a strong aging marker in Klemera–Doubal. It stays on
        this phone and is never required.
      </p>
    </div>
  );
}
