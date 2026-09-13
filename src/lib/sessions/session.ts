import type { PhaseCompletion } from "@/lib/pomodoro/pomodoro";

/**
 * One completed focus session, as stored. Shaped like a future database row: plain values,
 * timestamps in milliseconds, and an id that means the same thing everywhere.
 */
export type FocusSession = {
  /** Derived from the end time, so logging the same completion twice can't create two rows. */
  id: string;
  /** When the session was first started. */
  startedAt: number;
  /** The real moment the time ran out (Block 1's finishedAt). */
  endedAt: number;
  /** Focus time. Can be less than endedAt − startedAt, because pauses don't count. */
  durationMs: number;
};

/** Only completed *focus* phases become sessions. Breaks aren't logged. */
export function sessionFromCompletion(completion: PhaseCompletion): FocusSession | null {
  if (completion.phase !== "focus") return null;
  return {
    id: `focus-${completion.finishedAt}`,
    startedAt: completion.startedAt,
    endedAt: completion.finishedAt,
    durationMs: completion.durationMs,
  };
}

/** Oldest first, one entry per id. Adding a session that's already there changes nothing. */
export function mergeSessions(existing: FocusSession[], additions: FocusSession[]): FocusSession[] {
  const byId = new Map<string, FocusSession>();
  for (const session of [...existing, ...additions]) {
    if (!byId.has(session.id)) byId.set(session.id, session);
  }
  return [...byId.values()].sort((a, b) => a.endedAt - b.endedAt);
}

// ---- Reading and writing the stored format ----------------------------------------------

/**
 * Stored as { version, sessions }. The version lets a later block change the format and still
 * recognise (and convert) data saved by this one.
 */
export const SESSIONS_FORMAT_VERSION = 1;

function isFocusSession(value: unknown): value is FocusSession {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.id === "string" &&
    s.id.length > 0 &&
    Number.isFinite(s.startedAt) &&
    Number.isFinite(s.endedAt) &&
    Number.isFinite(s.durationMs) &&
    (s.durationMs as number) > 0 &&
    (s.endedAt as number) >= (s.startedAt as number)
  );
}

export type ParsedSessions = {
  sessions: FocusSession[];
  /**
   * True when the stored text had anything we couldn't read: broken JSON, an unknown version,
   * or individual bad entries. The caller should keep a backup copy before overwriting it.
   */
  hadUnreadableData: boolean;
};

export function parseSessions(raw: string | null): ParsedSessions {
  if (raw === null) return { sessions: [], hadUnreadableData: false };

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { sessions: [], hadUnreadableData: true };
  }

  const envelope = data as { version?: unknown; sessions?: unknown } | null;
  if (!envelope || envelope.version !== SESSIONS_FORMAT_VERSION || !Array.isArray(envelope.sessions)) {
    return { sessions: [], hadUnreadableData: true };
  }

  const valid = envelope.sessions.filter(isFocusSession);
  return {
    sessions: mergeSessions([], valid),
    hadUnreadableData: valid.length !== envelope.sessions.length,
  };
}

export function serializeSessions(sessions: FocusSession[]): string {
  return JSON.stringify({ version: SESSIONS_FORMAT_VERSION, sessions });
}

// ---- Showing a session ---------------------------------------------------------------------

/**
 * Human-readable pieces for one session, in the viewer's own timezone and language.
 * `locale` is only passed by tests, to make the output predictable.
 */
export function formatSession(session: FocusSession, locale?: string) {
  const date = new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric" });
  // hourCycle "h23" gives 09:05 / 21:05 in every locale instead of switching to AM/PM.
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return {
    date: date.format(session.startedAt),
    timeRange: `${time.format(session.startedAt)}–${time.format(session.endedAt)}`,
    minutes: `${Math.round(session.durationMs / 60_000)} min`,
  };
}
