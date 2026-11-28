import { dateTime } from "../utils/datetime";

export interface IDocTemplate {
  dailyNote: string;
  weeklyNote: string;
  listNote: string;
}

export type IDocTemplateKey = keyof IDocTemplate;

class DocTemplate<M> {
  private static instance: DocTemplate<IDocTemplate>;

  constructor() { }

  getInstance(): DocTemplate<IDocTemplate> {
    if (!DocTemplate.instance) {
      DocTemplate.instance = new DocTemplate<IDocTemplate>();
    }

    return DocTemplate.instance;
  }

  private generateDailyNote(selectedDate?: Date): string {
    if (selectedDate) {
      const date = selectedDate.toISOString().slice(0, 10);
      const weekday = selectedDate.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
      return `# ${date} ${weekday}\n`;
    }
    const date = dateTime.getDate().replace(new RegExp("/", "g"), "-");
    const weekDay = dateTime.getWeekDay();
    const dateTitle = `${date} ${weekDay}`;

    return `# ${dateTitle}\n`;
  }

  private generateWeeklyNote(): string {
    // Title is 'Week <week number>'
    const weekNumber = dateTime.getWeekNumber();
    return `# Week ${weekNumber}\n`;
  }

  private generateListNote(): string {
    return `# List Note\n\nContent for List Note.`;
  }

  public generateContent<K extends keyof M>(docTemplate: K, selectedDate?: Date): string {
    switch (docTemplate) {
      case "dailyNote":
        return this.generateDailyNote(selectedDate);
      case "weeklyNote":
        return this.generateWeeklyNote();
      case "listNote":
        return this.generateListNote();
      default:
        return "Invalid template type";
    }
  }
}

export const docTemplate = new DocTemplate<IDocTemplate>().getInstance();
