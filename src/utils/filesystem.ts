import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";

export function isExistingDirectory(directory: string): boolean {
  if (!path.isAbsolute(directory)) {
    return false;
  }
  try {
    return fs.statSync(directory).isDirectory();
  } catch {
    return false;
  }
}

export function findWorkspaceDirectory(
  directory: string,
  folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders
): vscode.WorkspaceFolder | undefined {
  if (!path.isAbsolute(directory)) {
    return undefined;
  }
  const folder = folders?.find(item => path.relative(item.uri.fsPath, directory) === "");
  return folder && isExistingDirectory(folder.uri.fsPath) ? folder : undefined;
}

function containsPath(directory: string, file: string): boolean {
  const relative = path.relative(directory, file);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

/** Includes the directory itself and its descendants on the same URI origin. */
export function isInDirectory(resource: vscode.Uri, directory: vscode.Uri): boolean {
  return resource.scheme === directory.scheme && resource.authority === directory.authority &&
    containsPath(directory.fsPath, resource.fsPath);
}
