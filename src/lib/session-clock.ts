export type SessionClock = {
  origin: number | null;
  pauseAcc: number;
  pauseAt: number | null;
};

export function idleClock(): SessionClock {
  return { origin: null, pauseAcc: 0, pauseAt: null };
}

export function startClock(now: number): SessionClock {
  return { origin: now, pauseAcc: 0, pauseAt: null };
}

export function pauseClock(clock: SessionClock, now: number): SessionClock {
  if (clock.origin == null || clock.pauseAt != null) return clock;
  return { ...clock, pauseAt: now };
}

export function resumeClock(clock: SessionClock, now: number): SessionClock {
  if (clock.origin == null) return startClock(now);
  if (clock.pauseAt == null) return clock;
  return {
    origin: clock.origin,
    pauseAcc: clock.pauseAcc + Math.max(0, now - clock.pauseAt),
    pauseAt: null,
  };
}

export function skipClockTo(clock: SessionClock, now: number, elapsedMs: number): SessionClock {
  const hanging = clock.pauseAt != null ? Math.max(0, now - clock.pauseAt) : 0;
  const origin = now - clock.pauseAcc - hanging - Math.max(0, elapsedMs);
  return { origin, pauseAcc: clock.pauseAcc, pauseAt: clock.pauseAt };
}
