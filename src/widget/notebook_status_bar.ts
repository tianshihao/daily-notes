import * as vscode from "vscode";
import type { IConfigurationKeyTypeMap } from "../config_manager/model";
import { DocumentAnalyzer } from "../document_analysis/document_analyzer";

export type NotebookStatusOptions = Pick<IConfigurationKeyTypeMap,
  "notebookName" | "showDocumentStats" | "showGitStatus" | "enableGit" | "autoCommit" | "autoSync"
>;

interface StatusComponent {
  visibilitySetting: "showDocumentStats" | "showGitStatus";
  text(
    document: vscode.TextDocument,
    options: NotebookStatusOptions,
    refreshLanguage: boolean,
    update: (text: string) => void,
  ): string;
}

type Analyzer = Pick<DocumentAnalyzer, "prepare" | "analyze" | "recordChanges">;

class DocumentStats implements StatusComponent {
  readonly visibilitySetting = "showDocumentStats";
  private pending?: {
    document: vscode.TextDocument;
    version: number;
    controller: AbortController;
    refreshLanguage: boolean;
    update: (text: string) => void;
  };

  constructor(private analyzer?: Analyzer) { }

  cancel(): void {
    this.pending?.controller.abort();
    this.pending = undefined;
  }

  recordChanges(event: vscode.TextDocumentChangeEvent): void {
    this.cancel();
    this.analyzer?.recordChanges(event);
  }

  text(
    document: vscode.TextDocument,
    _options: NotebookStatusOptions,
    refreshLanguage: boolean,
    update: (text: string) => void,
  ): string {
    const pendingText = "Words: … · Language: …";
    if (this.pending?.document === document && this.pending.version === document.version) {
      this.pending.update = update;
      this.pending.refreshLanguage = refreshLanguage;
      return pendingText;
    }
    this.cancel();
    const analyzer = this.analyzer ??= new DocumentAnalyzer();
    const controller = new AbortController();
    const work = analyzer.prepare(document, controller.signal);
    function result(refreshLanguage: boolean): string {
      const { wordCount, language } = analyzer.analyze(document, refreshLanguage);
      return `Words: ${wordCount} · Language: ${language}`;
    }
    if (!work) {
      return result(refreshLanguage);
    }
    const task = { document, version: document.version, controller, refreshLanguage, update };
    this.pending = task;
    void work.then(() => {
      if (this.pending !== task) {
        return;
      }
      const text = document.version === task.version ? result(task.refreshLanguage) : undefined;
      this.pending = undefined;
      if (text !== undefined) {
        task.update(text);
      }
    }).catch((error: unknown) => {
      if (this.pending === task) {
        this.pending = undefined;
        if (document.version === task.version) {
          console.error("Daily Notes could not analyze the document", error);
          task.update("Words: — · Language: —");
        }
      }
    });
    return pendingText;
  }
}

const gitStatus: StatusComponent = {
  visibilitySetting: "showGitStatus",
  text(_document, { enableGit, autoCommit, autoSync }) {
    if (!enableGit) {
      return "Git: Off";
    }
    return `Git: On · Auto Commit: ${autoCommit ? "On" : "Off"} · Auto Sync: ${autoSync ? "On" : "Off"}`;
  },
};

type CreateStatusBarItem = (
  id: string, alignment: vscode.StatusBarAlignment, priority: number
) => vscode.StatusBarItem;

interface PendingEdit {
  readonly document: vscode.TextDocument;
  options: NotebookStatusOptions;
  readonly words: ReturnType<typeof setTimeout>;
  readonly language: ReturnType<typeof setTimeout>;
}

export class NotebookStatusBar implements vscode.Disposable {
  private readonly documentStats: DocumentStats;
  // A single native item keeps both components adjacent even when other extensions add items.
  private readonly components: readonly StatusComponent[];
  private readonly item: vscode.StatusBarItem;
  private pendingEdit?: PendingEdit;

  constructor(
    createItem: CreateStatusBarItem = vscode.window.createStatusBarItem,
    analyzer?: Analyzer
  ) {
    this.documentStats = new DocumentStats(analyzer);
    this.components = [this.documentStats, gitStatus];
    this.item = createItem("dailyNotes.notebookStatus", vscode.StatusBarAlignment.Left, 0);
    this.item.name = "Daily Notes: Notebook Status";
    this.item.command = "daily-notes.showStatusBarActions";
    this.item.tooltip = "Click to change Daily Notes settings";
  }

  scheduleEdit(event: vscode.TextDocumentChangeEvent, options: NotebookStatusOptions): void {
    const { document } = event;
    if (!options.showDocumentStats) {
      this.render(document, options);
      return;
    }
    this.documentStats.recordChanges(event);
    this.cancelEdit();
    const edit: PendingEdit = {
      document,
      options,
      words: setTimeout(() => this.update(document, edit.options, false), 60),
      language: setTimeout(() => {
        this.pendingEdit = undefined;
        this.update(document, edit.options, true);
      }, 350),
    };
    this.pendingEdit = edit;
  }

  render(document: vscode.TextDocument | undefined, options: NotebookStatusOptions): void {
    const edit = this.pendingEdit;
    if (edit && edit.document === document && options.showDocumentStats) {
      clearTimeout(edit.words);
      edit.options = options;
    } else {
      this.cancelEdit();
    }
    this.update(document, options, this.pendingEdit === undefined);
  }

  private cancelEdit(): void {
    if (this.pendingEdit) {
      clearTimeout(this.pendingEdit.words);
      clearTimeout(this.pendingEdit.language);
      this.pendingEdit = undefined;
    }
  }

  private update(document: vscode.TextDocument | undefined, options: NotebookStatusOptions, refreshLanguage: boolean): void {
    if (!document || !options.showDocumentStats) {
      this.documentStats.cancel();
    }
    const visibleComponents = this.components.filter(component => options[component.visibilitySetting]);
    if (!document || visibleComponents.length === 0) {
      this.item.hide();
      return;
    }
    // Status bar text interprets icon markup, even inside user-supplied names.
    const name = options.notebookName.trim().replace(/\$\([a-z0-9-]+(?:~[a-z]+)?\)/gi, "\\$&");
    const parts = name ? [name] : [];
    for (const component of visibleComponents) {
      const index = parts.length;
      parts.push(component.text(document, options, refreshLanguage, text => {
        parts[index] = text;
        this.item.text = parts.join("  |  ");
      }));
    }
    this.item.text = parts.join("  |  ");
    this.item.show();
  }

  dispose(): void {
    this.cancelEdit();
    this.documentStats.cancel();
    this.item.dispose();
  }
}
