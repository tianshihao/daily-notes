import * as vscode from "vscode";
import type { IConfigurationKeyTypeMap } from "../config_manager/model";
import { getDocumentStats } from "../text_service/text_service";

export type NotebookStatusOptions = Pick<IConfigurationKeyTypeMap,
  "showDocumentStats" | "showGitStatus" | "enableGit" | "autoCommit" | "autoSync"
>;

interface StatusComponent {
  visibilitySetting: "showDocumentStats" | "showGitStatus";
  text(document: vscode.TextDocument, options: NotebookStatusOptions): string;
}

const documentStats: StatusComponent = {
  visibilitySetting: "showDocumentStats",
  text(document) {
    const { wordCount, language } = getDocumentStats(document.getText());
    return `Words: ${wordCount} · Language: ${language}`;
  },
};

const gitStatus: StatusComponent = {
  visibilitySetting: "showGitStatus",
  text(_document, { enableGit, autoCommit, autoSync }) {
    if (!enableGit) {
      return "Git: Off";
    }
    return `Git: On · Auto Commit: ${autoCommit ? "On" : "Off"} · Auto Sync: ${autoSync ? "On" : "Off"}`;
  },
};

// A single native item keeps both components adjacent even when other extensions add items.
const components = [documentStats, gitStatus] as const;

type CreateStatusBarItem = (
  id: string, alignment: vscode.StatusBarAlignment, priority: number
) => vscode.StatusBarItem;

export class NotebookStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(createItem: CreateStatusBarItem = vscode.window.createStatusBarItem) {
    this.item = createItem("dailyNotes.notebookStatus", vscode.StatusBarAlignment.Left, 0);
    this.item.name = "Daily Notes: Notebook Status";
  }

  render(document: vscode.TextDocument | undefined, options: NotebookStatusOptions): void {
    const parts: string[] = [];
    if (document) {
      for (const component of components) {
        if (options[component.visibilitySetting]) {
          parts.push(component.text(document, options));
        }
      }
    }
    if (parts.length === 0) {
      this.item.hide();
      return;
    }
    this.item.text = parts.join("  |  ");
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }
}
