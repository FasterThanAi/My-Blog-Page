/**
 * Computes a consecutive-day reading streak from a list of ISO timestamps
 * (post "completed_at" values). A streak counts consecutive calendar days
 * (UTC) with at least one completed read, ending today or yesterday so it
 * doesn't reset the instant midnight passes.
 *
 * Pulled into a plain utility (rather than inlined in a component) so the
 * date math stays out of any component render body.
 */
export function computeReadingStreak(completedAtTimestamps: string[], now: Date = new Date()): number {
  if (completedAtTimestamps.length === 0) return 0;

  const msPerDay = 24 * 60 * 60 * 1000;
  const dayKeys = Array.from(
    new Set(completedAtTimestamps.map((ts) => new Date(ts).toISOString().slice(0, 10)))
  ).sort((a, b) => (a < b ? 1 : -1));

  const todayKey = now.toISOString().slice(0, 10);
  const yesterdayKey = new Date(now.getTime() - msPerDay).toISOString().slice(0, 10);

  if (dayKeys[0] !== todayKey && dayKeys[0] !== yesterdayKey) {
    return 0;
  }

  let streak = 1;
  let cursor = new Date(dayKeys[0]).getTime();

  for (let i = 1; i < dayKeys.length; i++) {
    const expectedPrev = new Date(cursor - msPerDay).toISOString().slice(0, 10);
    if (dayKeys[i] === expectedPrev) {
      streak += 1;
      cursor -= msPerDay;
    } else {
      break;
    }
  }

  return streak;
}
