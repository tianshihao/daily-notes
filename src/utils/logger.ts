import { type LogOutputChannel, window } from "vscode";

export class Logger {
  private static output?: LogOutputChannel;

  public static dispose(): void {
    Logger.output?.dispose();
    Logger.output = undefined;
  }

  private static get channel(): LogOutputChannel {
    return Logger.output ??= window.createOutputChannel("Daily Notes", { log: true });
  }

  public static error(msg: string): void {
    Logger.channel.error(msg);
  }
  public static warn(msg: string): void {
    Logger.channel.warn(msg);
  }
  public static info(msg: string): void {
    Logger.channel.info(msg);
  }
  public static debug(msg: string): void {
    Logger.channel.debug(msg);
  }
  public static trace(msg: string): void {
    Logger.channel.trace(msg);
  }
}
