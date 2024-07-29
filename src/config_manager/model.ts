/**
 * Represents a map of configuration key types.
 */
export interface IConfigurationKeyTypeMap {
  notebookPath: string;
  notebookName: string;
  enableGit: boolean;
  commitMessage: string;
  autoCommit: boolean;
  autoCommitInterval: number;
  autoSync: boolean;
}

export type IConfigurationKnownKey = keyof IConfigurationKeyTypeMap;
