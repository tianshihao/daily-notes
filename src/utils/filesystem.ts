import * as vscode from "vscode";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export async function isExistingDirectory(directory: string): Promise<boolean> {
  if (!path.isAbsolute(directory)) {
    return false;
  }
  try {
    return (await fs.stat(directory)).isDirectory();
  } catch {
    return false;
  }
}

export function matchWorkspaceDirectory(
  directory: string,
  folders: readonly vscode.WorkspaceFolder[] | undefined = vscode.workspace.workspaceFolders
): vscode.WorkspaceFolder | undefined {
  if (!path.isAbsolute(directory)) {
    return undefined;
  }
  return folders?.find(item => path.relative(item.uri.fsPath, directory) === "");
}

export async function findWorkspaceDirectory(
  directory: string,
  folders?: readonly vscode.WorkspaceFolder[]
): Promise<vscode.WorkspaceFolder | undefined> {
  const folder = matchWorkspaceDirectory(directory, folders);
  return folder && await isExistingDirectory(folder.uri.fsPath) ? folder : undefined;
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

export async function isMarkdownFileInDirectory(resource: vscode.Uri, directory: vscode.Uri): Promise<boolean> {
  if (path.extname(resource.fsPath).toLowerCase() !== ".md" || !isInDirectory(resource, directory)) {
    return false;
  }
  // A link under the notebook may point outside it.
  try {
    const [root, file] = await Promise.all([fs.realpath(directory.fsPath), fs.realpath(resource.fsPath)]);
    return containsPath(root, file);
  } catch {
    return false;
  }
}
