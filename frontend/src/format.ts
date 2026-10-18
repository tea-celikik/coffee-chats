// undefined locale = use the visitor's browser language and time zone
export const dayLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// Group slots by local calendar day: [["Monday 20 October", [...]], ...]
export function groupByDay<T extends { startsAt: string }>(items: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const label = dayLabel(item.startsAt);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return [...groups.entries()];
}
