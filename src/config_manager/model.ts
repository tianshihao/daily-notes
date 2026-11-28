/**
 * Represents a map of configuration key types.
 */
export interface IConfigurationKeyTypeMap {
  notebookPath: string;
  notebookName: string;
  showDocumentStats: boolean;
  showGitStatus: boolean;
  enableGit: boolean;
  commitMessage: string;
  autoCommit: boolean;
  autoCommitInterval: number;
  autoSync: boolean;
}
