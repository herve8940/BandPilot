export type CoachMeterSnapshot = {channels: number[]; updatedAt: string | null; available: boolean};
export const emptyCoachMeters: CoachMeterSnapshot = {channels: [], updatedAt: null, available: false};

/** Keep the latest reading from the main socket, even while the soundcheck is closed. */
export function createCoachMeterFeed() {
  let latest = emptyCoachMeters;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => latest,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    publish(snapshot: CoachMeterSnapshot = emptyCoachMeters) {
      latest = snapshot;
      for (const listener of listeners) listener();
    },
  };
}
export type CoachMeters = CoachMeterSnapshot | ReturnType<typeof createCoachMeterFeed>;
