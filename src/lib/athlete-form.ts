import { parseLocaleNumber } from "@ajeenckya/engine";
import type { Athlete, Sex, Units } from "./athlete";
import {
  cmToFeetInches,
  feetInchesToCm,
  kgToLb,
  lbToKg,
  sanitizeAthlete,
  validHeightCm,
  validWeightKg,
} from "./athlete";

export type AthleteForm = {
  displayName: string;
  age: string;
  sex: Sex;
  units: Units;
  heightCm: string;
  feet: string;
  inches: string;
  weight: string;
  rest: string;
  max: string;
  systolic: string;
  cycleTracking: boolean;
  cycleStart: string;
};

export function formFromAthlete(athlete: Athlete): AthleteForm {
  const imperial = athlete.units === "imperial";
  const height = athlete.heightCm != null ? cmToFeetInches(athlete.heightCm) : null;
  return {
    displayName: athlete.displayName,
    age: String(athlete.age),
    sex: athlete.sex,
    units: athlete.units,
    heightCm: athlete.heightCm != null ? String(athlete.heightCm) : "",
    feet: height ? String(height.feet) : "",
    inches: height ? String(height.inches) : "",
    weight:
      athlete.weightKg == null
        ? ""
        : imperial
          ? String(Math.round(kgToLb(athlete.weightKg) * 10) / 10)
          : String(athlete.weightKg),
    rest: athlete.restHrOverride != null ? String(athlete.restHrOverride) : "",
    max: athlete.maxHrOverride != null ? String(athlete.maxHrOverride) : "",
    systolic: athlete.systolicMmHg != null ? String(athlete.systolicMmHg) : "",
    cycleTracking: athlete.cycleTracking,
    cycleStart: athlete.cycleStart ?? "",
  };
}

function optionalNumber(text: string): number | null | "bad" {
  if (text.trim() === "") return null;
  const value = parseLocaleNumber(text);
  return value == null ? "bad" : value;
}

export function errorsFor(form: AthleteForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const age = Number(form.age);
  if (!Number.isFinite(age) || age < 16 || age > 90) {
    errors.age = "Enter an age from 16 to 90.";
  }
  if (form.units === "metric") {
    const cm = optionalNumber(form.heightCm);
    if (cm === "bad" || (typeof cm === "number" && !validHeightCm(cm))) {
      errors.height = "Enter a height from 120 to 230 cm.";
    }
    const kg = optionalNumber(form.weight);
    if (kg === "bad" || (typeof kg === "number" && !validWeightKg(kg))) {
      errors.weight = "Enter a weight from 30 to 250 kg.";
    }
  } else {
    if (form.feet.trim() !== "" || form.inches.trim() !== "") {
      const cm = feetInchesToCm(Number(form.feet) || 0, Number(form.inches) || 0);
      if (!validHeightCm(cm)) errors.height = "Enter a height from 4 ft to 7 ft 6 in.";
    }
    const pounds = optionalNumber(form.weight);
    const kg = typeof pounds === "number" ? lbToKg(pounds) : pounds;
    if (kg === "bad" || (typeof kg === "number" && !validWeightKg(kg))) {
      errors.weight = "Enter a weight from 66 to 551 lb.";
    }
  }
  const rest = optionalNumber(form.rest);
  if (rest === "bad" || (typeof rest === "number" && (rest < 30 || rest > 110))) {
    errors.rest = "Enter a resting heart rate from 30 to 110, or leave this blank.";
  }
  const max = optionalNumber(form.max);
  if (max === "bad" || (typeof max === "number" && (max < 120 || max > 230))) {
    errors.max = "Enter a max heart rate from 120 to 230, or leave this blank.";
  }
  const systolic = optionalNumber(form.systolic);
  if (systolic === "bad" || (typeof systolic === "number" && (systolic < 80 || systolic > 220))) {
    errors.systolic = "Enter a reading from 80 to 220, or leave this blank.";
  }
  if (form.cycleTracking && form.cycleStart) {
    const start = new Date(`${form.cycleStart}T00:00:00`);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (Number.isNaN(start.getTime()) || start > endOfToday) {
      errors.cycle = "Choose a start date that is today or earlier.";
    }
  }
  return errors;
}

export function athleteFromForm(form: AthleteForm): Athlete {
  const metric = form.units === "metric";
  const heightBlank = metric
    ? form.heightCm.trim() === ""
    : form.feet.trim() === "" && form.inches.trim() === "";
  const heightCm = heightBlank
    ? null
    : metric
      ? parseLocaleNumber(form.heightCm)
      : feetInchesToCm(Number(form.feet) || 0, Number(form.inches) || 0);
  const weightText = optionalNumber(form.weight);
  const weightKg =
    weightText == null || weightText === "bad"
      ? null
      : metric
        ? weightText
        : lbToKg(weightText);
  const rest = optionalNumber(form.rest);
  const max = optionalNumber(form.max);
  const systolic = optionalNumber(form.systolic);
  const age = Number(form.age);
  return sanitizeAthlete({
    displayName: form.displayName,
    age: Number.isFinite(age) ? age : undefined,
    sex: form.sex,
    units: form.units,
    heightCm,
    weightKg,
    restHrOverride: typeof rest === "number" ? rest : null,
    maxHrOverride: typeof max === "number" ? max : null,
    systolicMmHg: typeof systolic === "number" ? systolic : null,
    cycleTracking: form.cycleTracking,
    cycleStart: form.cycleTracking && form.cycleStart ? form.cycleStart : null,
  });
}

export function withUnits(form: AthleteForm, units: Units): AthleteForm {
  if (form.units === units) return form;
  const current = athleteFromForm({ ...form, units: form.units });
  return formFromAthlete({ ...current, units });
}
