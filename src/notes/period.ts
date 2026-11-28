export type NotePeriod = "day" | "week" | "month" | "quarter" | "year";

export function getNotePeriod(period: NotePeriod, now: Date) {
  // Use the local calendar date, then do calendar arithmetic in UTC.
  const start = new Date(0);
  start.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  const format = (date: Date) => date.toISOString().slice(0, 10);
  const month = start.getUTCMonth();
  let heading: string;
  let suffix: string = period;
  switch (period) {
    case "day": {
      const date = format(start);
      const weekday = start.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      return { filename: date + ".md", heading: `${date} ${weekday}` };
    }
    case "week": {
      start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
      const sunday = new Date(start);
      sunday.setUTCDate(start.getUTCDate() + 6);
      const thursday = new Date(start);
      thursday.setUTCDate(start.getUTCDate() + 3);
      const januaryFirst = new Date(thursday);
      januaryFirst.setUTCMonth(0, 1);
      const week = Math.floor((thursday.getTime() - januaryFirst.getTime()) / (7 * 86_400_000)) + 1;
      const weekNumber = String(week).padStart(2, "0");
      suffix = "W" + weekNumber;
      heading = `Week ${weekNumber} · ${format(start)} – ${format(sunday)}`;
      break;
    }
    case "month":
      start.setUTCDate(1);
      heading = format(start).slice(0, 7);
      break;
    case "quarter": {
      const quarter = Math.floor(month / 3);
      start.setUTCMonth(quarter * 3, 1);
      heading = `${start.getUTCFullYear()} Q${quarter + 1}`;
      break;
    }
    case "year":
      start.setUTCMonth(0, 1);
      heading = String(start.getUTCFullYear());
      break;
  }
  return { filename: `${format(start)}.${suffix}.md`, heading };
}
