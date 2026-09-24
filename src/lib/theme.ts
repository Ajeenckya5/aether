export type ThemeChoice = "system" | "light" | "dark";

const KEY = "aether-theme-v1";

export function parseTheme(value: string | null | undefined): ThemeChoice {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "system";
}

export function loadTheme(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    return parseTheme(localStorage.getItem(KEY));
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice) {
  document.documentElement.dataset.theme = choice;
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    /* private mode */
  }
}

export const THEME_BOOT =
  '(function(){try{var t=localStorage.getItem("aether-theme-v1");if(t==="light"||t==="dark"||t==="system")document.documentElement.setAttribute("data-theme",t);}catch(e){}})();';
