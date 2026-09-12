export const SPORT_LABELS: Record<number, string> = {
  0: "Activity",
  1: "Running",
  16: "Cycling",
  18: "Weightlifting",
  21: "Functional Fitness",
  22: "Rowing",
  23: "Walking",
  24: "Swimming",
  43: "Swimming",
  44: "Tennis",
  48: "Yoga",
  51: "Pilates",
  52: "HIIT",
  55: "Dancing",
  59: "Hiking",
  63: "Soccer",
  70: "Basketball",
  71: "Boxing",
  73: "Golf",
};

export function sportLabel(name: string | undefined, id?: number): string {
  if (name && name.trim()) {
    return name.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (id != null && SPORT_LABELS[id]) return SPORT_LABELS[id];
  return "Workout";
}

export function sportKey(name: string): string {
  return name.toLowerCase().replace(/[\s_]+/g, "-");
}
