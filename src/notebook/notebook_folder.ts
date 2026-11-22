import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { configManager } from "../config_manager/config_manager";

export function getNotebookFolder(): vscode.WorkspaceFolder | undefined {
  const notebookPath = configManager.get("notebookPath");
  if (!notebookPath || !path.isAbsolute(notebookPath)) {
    return undefined;
  }
  const folder = vscode.workspace.workspaceFolders?.find(
    (item) => path.relative(item.uri.fsPath, notebookPath) === ""
  );
  return folder && fs.existsSync(folder.uri.fsPath) ? folder : undefined;
}

/** Match the URI origin and directory components, including in remote workspaces. */
export function isNotebookDocument(document: vscode.TextDocument, folder: vscode.WorkspaceFolder): boolean {
  if (document.uri.scheme !== folder.uri.scheme || document.uri.authority !== folder.uri.authority) {
    return false;
  }
  const relative = path.relative(folder.uri.fsPath, document.uri.fsPath);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}
