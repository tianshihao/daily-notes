import * as vscode from "vscode";

export enum ExtensionState {
  New = "new",
  Running = "running",
  Ready = "ready to be set up",
  Waiting = "waiting to be ready",
  Terminated = "terminated",
}

class Context {
  private static instance: Context;
  private extensionState: ExtensionState;
  private isNotebookConfigured: boolean;
  private isConfigurationChangeListenerSet: boolean;
  private isWorkspaceFolderChangeListenerSet: boolean;

  private isActiveEditorChangeListenerEnabled = false;
  private activeEditorChangeListener: vscode.Disposable | undefined;

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

  public getIsActiveEditorChangeListenerEnabled(): boolean {
    return this.isActiveEditorChangeListenerEnabled;
  }
  public setIsActiveEditorChangeListenerEnabled(
    isActiveEditorChangeListenerEnabled: boolean
  ): void {
    this.isActiveEditorChangeListenerEnabled =
      isActiveEditorChangeListenerEnabled;
  }

  public getActiveEditorChangeListener(): vscode.Disposable | undefined {
    return this.activeEditorChangeListener;
  }
  public setActiveEditorChangeListener(
    activeEditorChangeListener: vscode.Disposable | undefined
  ): void {
    this.activeEditorChangeListener = activeEditorChangeListener;
  }
}

export default Context;
