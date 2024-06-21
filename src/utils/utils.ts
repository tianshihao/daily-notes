class Utils {
  private static instance: Utils;

  private constructor() {}

  static getInstance(): Utils {
    if (!Utils.instance) {
      Utils.instance = new Utils();
    }

    return Utils.instance;
  }

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
}

export const utils = Utils.getInstance();
