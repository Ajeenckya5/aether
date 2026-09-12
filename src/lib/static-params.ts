import { COACH_SESSIONS } from "./coach";

export function coachSlugs(): string[] {
  return COACH_SESSIONS.map((session) => session.slug);
}
