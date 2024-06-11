/**
 * Represents a map of configuration key types.
 */
export interface IConfigurationKeyTypeMap {
  notebookDirectory: string;
  notebookName: string;
}

export type IConfigurationKnownKey = keyof IConfigurationKeyTypeMap;
