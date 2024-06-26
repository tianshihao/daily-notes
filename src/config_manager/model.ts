/**
 * Represents a map of configuration key types.
 */
export interface IConfigurationKeyTypeMap {
  notebookDirectory: string;
  notebookName: string;
  enableGit: boolean;
  commitMessage: string;
  autoCommit: boolean;
  autoCommitInterval: number;
}

export type IConfigurationKnownKey = keyof IConfigurationKeyTypeMap;
