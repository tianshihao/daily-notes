import * as vscode from "vscode";
import type { IConfigurationKeyTypeMap } from "../config_manager/model";
import { DocumentAnalyzer } from "../document_analysis/document_analyzer";

export type NotebookStatusOptions = Pick<IConfigurationKeyTypeMap,
  "notebookName" | "showDocumentStats" | "showGitStatus" | "enableGit" | "autoCommit" | "autoSync"
>;

interface StatusComponent {
  visibilitySetting: "showDocumentStats" | "showGitStatus";
  text(document: vscode.TextDocument, options: NotebookStatusOptions, update: (text: string) => void): string;
}

type Analyzer = Pick<DocumentAnalyzer, "prepare" | "analyze" | "recordChanges">;

class DocumentStats implements StatusComponent {
  readonly visibilitySetting = "showDocumentStats";
  private pending?: {
    document: vscode.TextDocument;
    version: number;
    controller: AbortController;
    update: (text: string) => void;
  };

  constructor(private readonly analyzer: Analyzer) { }

  cancel(): void {
    this.pending?.controller.abort();
    this.pending = undefined;
  }

  text(document: vscode.TextDocument, _options: NotebookStatusOptions, update: (text: string) => void): string {
    const pendingText = "Words: … · Language: …";
    if (this.pending?.document === document && this.pending.version === document.version) {
      this.pending.update = update;
      return pendingText;
    }
    this.cancel();
    const controller = new AbortController();
    const work = this.analyzer.prepare(document, controller.signal);
    if (!work) {
      return this.result(document);
    }
    const task = { document, version: document.version, controller, update };
    this.pending = task;
    void work.then(() => {
      if (this.pending !== task) {
        return;
      }
      const text = document.version === task.version ? this.result(document) : undefined;
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

  private result(document: vscode.TextDocument): string {
    const { wordCount, language } = this.analyzer.analyze(document);
    return `Words: ${wordCount} · Language: ${language}`;
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

export class NotebookStatusBar implements vscode.Disposable {
  private readonly documentStats: DocumentStats;
  // A single native item keeps both components adjacent even when other extensions add items.
  private readonly components: readonly StatusComponent[];
  private readonly item: vscode.StatusBarItem;
  private editTimer?: ReturnType<typeof setTimeout>;

  constructor(
    createItem: CreateStatusBarItem = vscode.window.createStatusBarItem,
    private readonly analyzer: Analyzer = new DocumentAnalyzer()
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
    this.documentStats.cancel();
    this.analyzer.recordChanges(event);
    clearTimeout(this.editTimer);
    this.editTimer = setTimeout(() => this.render(document, options), 60);
  }

  render(document: vscode.TextDocument | undefined, options: NotebookStatusOptions): void {
    clearTimeout(this.editTimer);
    this.editTimer = undefined;
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
      parts.push(component.text(document, options, text => {
        parts[index] = text;
        this.item.text = parts.join("  |  ");
      }));
    }
    this.item.text = parts.join("  |  ");
    this.item.show();
  }

  dispose(): void {
    clearTimeout(this.editTimer);
    this.documentStats.cancel();
    this.item.dispose();
  }
}
