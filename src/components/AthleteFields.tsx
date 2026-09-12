"use client";

import { useEffect, useState } from "react";
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
  "mt-1 w-full rounded-2xl border border-white/10 bg-ink px-3 py-2 text-sm text-paper";

export function AthleteFields() {
  const { athlete, updateAthlete } = useLab();
  const imperial = athlete.units === "imperial";
  const ftIn = athlete.heightCm != null ? cmToFeetInches(athlete.heightCm) : { feet: 5, inches: 0 };
  const [heightText, setHeightText] = useState("");
  const [weightText, setWeightText] = useState("");
  const [feetText, setFeetText] = useState("");
  const [inchText, setInchText] = useState("");
  const bmi =
    athlete.weightKg != null && athlete.heightCm != null
      ? bodyMassIndex(athlete.weightKg, athlete.heightCm)
      : null;

  useEffect(() => {
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
  }, [athlete.heightCm, athlete.weightKg, imperial]);

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
            value={athlete.age}
            onChange={(e) => updateAthlete({ age: Number(e.target.value) || 16 })}
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
              type="number"
              min={66}
              max={550}
              step={0.1}
              inputMode="decimal"
              placeholder="154"
              value={weightText}
              onChange={(e) => {
                const next = e.target.value;
                setWeightText(next);
                if (next === "") {
                  updateAthlete({ weightKg: null });
                  return;
                }
                const kg = lbToKg(Number(next));
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
              type="number"
              min={120}
              max={230}
              step={0.5}
              inputMode="decimal"
              placeholder="175"
              value={heightText}
              onChange={(e) => {
                const next = e.target.value;
                setHeightText(next);
                if (next === "") {
                  updateAthlete({ heightCm: null });
                  return;
                }
                const cm = Number(next);
                if (validHeightCm(cm)) updateAthlete({ heightCm: cm });
              }}
              className={fieldClass}
            />
          </label>
          <label className="text-xs text-muted">
            Weight (kg)
            <input
              type="number"
              min={30}
              max={250}
              step={0.1}
              inputMode="decimal"
              placeholder="70"
              value={weightText}
              onChange={(e) => {
                const next = e.target.value;
                setWeightText(next);
                if (next === "") {
                  updateAthlete({ weightKg: null });
                  return;
                }
                const kg = Number(next);
                if (validWeightKg(kg)) updateAthlete({ weightKg: kg });
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
            value={athlete.restHrOverride ?? ""}
            onChange={(e) =>
              updateAthlete({
                restHrOverride: e.target.value ? Number(e.target.value) : null,
              })
            }
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
            value={athlete.maxHrOverride ?? ""}
            onChange={(e) =>
              updateAthlete({
                maxHrOverride: e.target.value ? Number(e.target.value) : null,
              })
            }
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
            value={athlete.systolicMmHg ?? ""}
            onChange={(e) =>
              updateAthlete({
                systolicMmHg: e.target.value ? Number(e.target.value) : null,
              })
            }
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
