export const notePeriods = ["day", "week", "month", "quarter", "year"] as const;
export type NotePeriod = (typeof notePeriods)[number];

const formatDate = (date: Date) => date.toISOString().slice(0, 10);
const twoDigits = (value: number) => String(value).padStart(2, "0");
const periodMonths = { month: 1, quarter: 3, year: 12 };
const noteFilenamePattern = /^(\d{4}-\d{2}-\d{2})(?:\.(W\d{2}|month|quarter|year))?\.md$/;

function isoWeekNumber(date: Date): string {
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 3 - (date.getUTCDay() + 6) % 7);
  const januaryFirst = new Date(thursday);
  januaryFirst.setUTCMonth(0, 1);
  return twoDigits(Math.floor((thursday.getTime() - januaryFirst.getTime()) / (7 * 86_400_000)) + 1);
}

function setPeriodStart(period: NotePeriod, date: Date): void {
  if (period === "week") {
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  } else if (period !== "day") {
    const months = periodMonths[period];
    date.setUTCMonth(Math.floor(date.getUTCMonth() / months) * months, 1);
  }
}

export function notePeriodFromFilename(filename: string, expectedPeriod?: NotePeriod): NotePeriod | undefined {
  const match = noteFilenamePattern.exec(filename);
  if (!match) {
    return;
  }
  const [, day, suffix] = match;
  const period = !suffix ? "day" : suffix.startsWith("W") ? "week" : suffix as NotePeriod;
  if ((expectedPeriod && period !== expectedPeriod) || day.startsWith("0000")) {
    return;
  }

  const date = new Date(`${day}T00:00:00Z`);
  const time = date.getTime();
  if (Number.isNaN(time) || formatDate(date) !== day) {
    return;
  }
  setPeriodStart(period, date);
  if (date.getTime() === time && (period !== "week" || suffix === `W${isoWeekNumber(date)}`)) {
    return period;
  }
}

export interface NotePlaceholderValues {
  "date:full": string;
  "date:month": string;
  "date:quarter": string;
  "date:year": string;
  "date:end": string;
  "date:weekday": string;
  "week:iso": string;
  "week:number": string;
  "month:number": string;
  "quarter:label": string;
}

const legacyPlaceholders = {
  date: "date:full",
  endDate: "date:end",
  weekday: "date:weekday",
  week: "week:iso",
  weekNumber: "week:number",
  month: "month:number",
  quarter: "quarter:label",
  year: "date:year",
} as const satisfies Record<string, keyof NotePlaceholderValues>;

function placeholder(name: keyof NotePlaceholderValues): string {
  return `{${name}}`;
}

export const defaultNoteTemplates: Record<NotePeriod, string> = {
  day: `# ${placeholder("date:full")} ${placeholder("date:weekday")}\n`,
  week: `# Week ${placeholder("week:number")} · ${placeholder("date:full")} – ${placeholder("date:end")}\n`,
  month: `# ${placeholder("date:month")}\n`,
  quarter: `# ${placeholder("date:quarter")}\n`,
  year: `# ${placeholder("date:year")}\n`,
};

export function getNotePeriod(period: NotePeriod, now: Date) {
  // Use the local calendar date, then do calendar arithmetic in UTC.
  const start = new Date(0);
  start.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  setPeriodStart(period, start);
  const end = new Date(start);
  if (period === "week") {
    end.setUTCDate(start.getUTCDate() + 6);
  } else if (period !== "day") {
    end.setUTCMonth(start.getUTCMonth() + periodMonths[period], 0);
  }

  const date = formatDate(start);
  const weekNumber = isoWeekNumber(start);
  const year = date.slice(0, 4);
  const quarter = "Q" + (Math.floor(start.getUTCMonth() / 3) + 1);
  const variables: NotePlaceholderValues = {
    "date:full": date,
    "date:month": date.slice(0, 7),
    "date:quarter": `${year} ${quarter}`,
    "date:year": year,
    "date:end": formatDate(end),
    "date:weekday": start.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    "week:iso": "W" + weekNumber,
    "week:number": weekNumber,
    "month:number": twoDigits(start.getUTCMonth() + 1),
    "quarter:label": quarter,
  };
  const suffix = period === "week" ? variables["week:iso"] : period;
  const filename = period === "day" ? `${date}.md` : `${date}.${suffix}.md`;
  return { filename, variables };
}

export function renderNoteTemplate(template: string, variables: Readonly<NotePlaceholderValues>): string {
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*(?::[A-Za-z_][A-Za-z0-9_]*)*)\}/g, (placeholder, name: string, offset: number) => {
    const key = Object.hasOwn(legacyPlaceholders, name)
      ? legacyPlaceholders[name as keyof typeof legacyPlaceholders]
      : name;
    if (!Object.hasOwn(variables, key)) {
      const line = template.slice(0, offset).split(/\r\n|\r|\n/).length;
      throw new Error(`Unknown placeholder ${placeholder} on line ${line}.`);
    }
    return variables[key as keyof NotePlaceholderValues];
  });
}
