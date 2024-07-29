export enum ExtensionState {
  New = "new",
  Running = "running",
  Ready = "ready",
  Waiting = "waiting",
  Terminated = "terminated",
}

class Context {
  private static instance: Context;
  private extensionState: ExtensionState;
  private isNotebookConfigured: boolean;
  private isConfigurationChangeListenerSet: boolean;
  private isWorkspaceFolderChangeListenerSet: boolean;

  private constructor() {
    this.extensionState = ExtensionState.New; // Default state
    this.isNotebookConfigured = false;
    this.isConfigurationChangeListenerSet = false;
    this.isWorkspaceFolderChangeListenerSet = false;
  }

  public getExtensionState(): ExtensionState {
    return this.extensionState;
  }

  public setExtensionState(extensionState: ExtensionState): void {
    this.extensionState = extensionState;
  }

  public static getInstance(): Context {
    if (!Context.instance) {
      Context.instance = new Context();
    }
    return Context.instance;
  }

  public getIsNotebookConfigured(): boolean {
    return this.isNotebookConfigured;
  }

  public setIsNotebookConfigured(isNotebookConfigured: boolean): void {
    this.isNotebookConfigured = isNotebookConfigured;
  }

  public getIsConfigurationChangeListenerSet(): boolean {
    return this.isConfigurationChangeListenerSet;
  }

  public setIsConfigurationChangeListenerSet(
    isConfigurationChangeListenerSet: boolean
  ): void {
    this.isConfigurationChangeListenerSet = isConfigurationChangeListenerSet;
  }

  public getIsWorkspaceFolderChangeListenerSet(): boolean {
    return this.isWorkspaceFolderChangeListenerSet;
  }

  public setIsWorkspaceFolderChangeListenerSet(
    isWorkspaceFolderChangeListenerSet: boolean
  ): void {
    this.isWorkspaceFolderChangeListenerSet =
      isWorkspaceFolderChangeListenerSet;
  }
}

export default Context;
