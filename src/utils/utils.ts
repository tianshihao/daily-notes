import * as vscode from "vscode";
import path from "path";
import fs from "fs";

class Utils {
  private static instance: Utils;

  private constructor() {}

  static getInstance(): Utils {
    if (!Utils.instance) {
      Utils.instance = new Utils();
    }

    return Utils.instance;
  }

  /**
   * Returns the current timestamp in the format "yyyy-MM-dd HH:mm:ss".
   * @returns {string} The current timestamp.
   */
  getTimestamp(): string {
    const date = new Date();
    const timestamp = date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return timestamp;
  }

  /**
   * Returns the current date in the format "YYYY-MM-DD".
   * @returns {string} The current date.
   */
  getDate(): string {
    const date = new Date();
    const timestamp = date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    return timestamp;
  }

  /**
   * Gets the current time in the format of "hh:mm:ss".
   * @returns The current time as a string.
   */
  getTime(): string {
    const date = new Date();
    const timestamp = date.toLocaleString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    return timestamp;
  }

  // get week number
  getWeekNumber(): number {
    const date = new Date();
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear =
      (date.valueOf() - firstDayOfYear.valueOf()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  }

  // get weekday
  getWeekDay(): string {
    const date = new Date();
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return weekDays[date.getDay()];
  }

  /**
   * Checks if the file associated with the active editor is within the notebook path.
   * @param activeEditor - The active text editor.
   * @returns A boolean indicating whether the file is within the notebook path.
   */
  public isFileInNotebookPath(activeEditor: vscode.TextEditor): boolean {
    const config = vscode.workspace.getConfiguration("dailyNotes");
    const notebookPath = config.get("notebookPath") as string;
    const fileName = activeEditor.document.fileName;
    return fileName.startsWith(notebookPath);
  }

  /**
   * Checks if a value is non-default and not empty.
   * @param value - The value to check.
   * @param defaultValue - The default value to compare against.
   * @returns A boolean indicating whether the value is non-default and not empty.
   */
  public isNonDefaultAndNotEmpty(value: string, defaultValue: string): boolean {
    return value !== defaultValue && value.trim() !== "";
  }

  /**
   * Checks if a given file path is valid.
   * @param filePath - The file path to check.
   * @returns A boolean indicating whether the path is valid or not.
   */
  public isValidPath(filePath: string): boolean {
    try {
      // Normalize the path to resolve '..' and '.' segments
      const normalizedPath = path.resolve(filePath);
      // Check if the path exists
      const exists = fs.existsSync(normalizedPath);
      // A valid path is one that exists.
      return exists;
    } catch (error) {
      // If any error occurs (e.g., insufficient permissions), consider the path invalid
      return false;
    }
  }

  /**
   * Checks if a given file path is present in the workspace folders.
   * @param filePath - The file path to check.
   * @returns A boolean indicating whether the file path is present in the workspace folders.
   */
  public isPathPresent(filePath: string): boolean {
    const isNotebookPathPresent = vscode.workspace.workspaceFolders?.some(
      (folder) => folder.uri.fsPath === filePath
    );

    return isNotebookPathPresent as boolean;
  }

  /**
   * Checks if the provided notebook path is valid.
   *
   * @param path - The notebook path to validate.
   * @returns `true` if the path is valid, `false` otherwise.
   */
  public isValidNotebookPath(path: string): boolean {
    return (
      this.isNonDefaultAndNotEmpty(path, "") &&
      this.isValidPath(path) &&
      this.isPathPresent(path)
    );
  }
}

export const utils = Utils.getInstance();
