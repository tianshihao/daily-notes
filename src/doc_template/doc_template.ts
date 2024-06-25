import { utils } from "../utils/utils";

export interface IDocTemplate {
  dailyNote: string;
  weeklyNote: string;
  listNote: string;
}

export type IDocTemplateKey = keyof IDocTemplate;

class DocTemplate<M> {
  private static instance: DocTemplate<IDocTemplate>;

  constructor() {}

  getInstance(): DocTemplate<IDocTemplate> {
    if (!DocTemplate.instance) {
      DocTemplate.instance = new DocTemplate<IDocTemplate>();
    }

    return DocTemplate.instance;
  }

  private generateDailyNote(): string {
    const date = utils.getDate().replace(new RegExp("/", "g"), "-");
    const weekDay = utils.getWeekDay();
    const dateTitle = `${date} ${weekDay}`;

    return `# ${dateTitle}\n`;
  }

  private generateWeeklyNote(): string {
    // Title is 'Week <week number>'
    const weekNumber = utils.getWeekNumber();
    return `# Week ${weekNumber}\n`;
  }

  private generateListNote(): string {
    return `# List Note\n\nContent for List Note.`;
  }

  public generateContent<K extends keyof M>(docTemplate: K): string {
    switch (docTemplate) {
      case "dailyNote":
        return this.generateDailyNote();
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
