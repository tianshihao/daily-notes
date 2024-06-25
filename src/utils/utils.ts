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
}

export const utils = Utils.getInstance();
