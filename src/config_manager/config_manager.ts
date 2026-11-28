import * as vscode from "vscode";
import type { IConfigurationKeyTypeMap } from "./model";

export const configManager = {
  get<K extends keyof IConfigurationKeyTypeMap>(key: K, scope?: vscode.ConfigurationScope): IConfigurationKeyTypeMap[K] {
    return vscode.workspace.getConfiguration("dailyNotes", scope).get<IConfigurationKeyTypeMap[K]>(key)!;
  },

  update<K extends keyof IConfigurationKeyTypeMap>(
    key: K,
    value: IConfigurationKeyTypeMap[K],
    target?: vscode.ConfigurationTarget
  ) {
    return vscode.workspace.getConfiguration("dailyNotes").update(key, value, target);
  },
};
