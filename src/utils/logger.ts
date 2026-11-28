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

  public static error(operation: string, error: unknown): string {
    const message = error instanceof Error ? error.message || error.name : String(error);
    const detail = (message.trim() || "Unknown error.")
      .replace(/\b([a-z][a-z\d+.-]*:\/\/)[^/\s?#]+@/gi, "$1")
      .replace(/([?&](?:access_token|api_key|password|token)=)[^&#\s'"<>]+/gi, "$1[redacted]");
    Logger.channel.error(`[${operation}] ${detail.replace(/\r\n?|\n/g, "\n  ")}`);
    return detail;
  }
}
