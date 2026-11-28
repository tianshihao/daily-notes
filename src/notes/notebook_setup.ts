import * as fs from "node:fs/promises";
import * as path from "node:path";
import { applyEdits, modify, parseTree, type ParseError } from "jsonc-parser";
import * as vscode from "vscode";
import { configManager } from "../config_manager/config_manager";
import { findWorkspaceDirectory } from "../utils/filesystem";

interface NotebookFolder {
  path: string;
  name: string;
}

export async function setUpNotebook(): Promise<string | undefined> {
  try {
    const notebook = await selectNotebook();
    if (!notebook) {
      return;
    }

    const destination = await vscode.window.showQuickPick([
      { label: "Current", description: "Open the notebook in the current window" },
      { label: "New", description: "Open the notebook in a new window" },
    ], { placeHolder: "Choose where to open the notebook" });
    if (!destination) {
      return;
    }

    if (notebook.create) {
      await fs.mkdir(notebook.path);
    }

    if (destination.label === "New" || !vscode.workspace.workspaceFolders?.length) {
      await saveNotebookFolderSettings(notebook);
      await vscode.commands.executeCommand("vscode.openFolder", vscode.Uri.file(notebook.path), {
        forceNewWindow: destination.label === "New",
      });
      return;
    }

    await addNotebookToWorkspace(notebook.path);
    await configManager.update("notebookPath", notebook.path, vscode.ConfigurationTarget.Workspace);
    await configManager.update("notebookName", notebook.name, vscode.ConfigurationTarget.Workspace);
    return notebook.path;
  } catch (error) {
    void vscode.window.showErrorMessage(`Could not set up the notebook. ${String(error)}`);
  }
}

async function selectNotebook(): Promise<(NotebookFolder & { create: boolean }) | undefined> {
  const action = await vscode.window.showQuickPick([
    { label: "Create", description: "Create a new notebook folder" },
    { label: "Update", description: "Use an existing notebook folder" },
  ], { placeHolder: "Set up the notebook folder" });
  if (!action) {
    return;
  }

  let name: string | undefined;
  if (action.label === "Create") {
    name = (await vscode.window.showInputBox({
      prompt: "Enter the notebook name",
      validateInput: input => {
        const value = input.trim();
        return !value || value === "." || value === ".." || /[\\/:]/.test(value)
          ? "Enter a single folder name."
          : undefined;
      },
    }))?.trim();
    if (!name) {
      return;
    }
  }

  const selection = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
  });
  if (!selection?.[0]) {
    return;
  }

  const folder = selection[0].fsPath;
  if (!name) {
    return { path: folder, name: path.basename(folder), create: false };
  }
  return { path: path.join(folder, name), name, create: true };
}

async function addNotebookToWorkspace(directory: string): Promise<void> {
  if (findWorkspaceDirectory(directory)) {
    return;
  }
  const folders = vscode.workspace.workspaceFolders ?? [];
  await new Promise<void>((resolve, reject) => {
    const listener = vscode.workspace.onDidChangeWorkspaceFolders(() => {
      if (findWorkspaceDirectory(directory)) {
        clearTimeout(timer);
        listener.dispose();
        resolve();
      }
    });
    const timer = setTimeout(() => {
      listener.dispose();
      reject(new Error("VS Code did not open the notebook folder."));
    }, 5000);
    if (!vscode.workspace.updateWorkspaceFolders(folders.length, 0, { uri: vscode.Uri.file(directory) })) {
      clearTimeout(timer);
      listener.dispose();
      reject(new Error("VS Code rejected the workspace folder update."));
    }
  });
}

export async function saveNotebookFolderSettings(notebook: NotebookFolder): Promise<void> {
  const directory = path.join(notebook.path, ".vscode");
  const filename = path.join(directory, "settings.json");
  let original = "";
  try {
    original = await fs.readFile(filename, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
  const errors: ParseError[] = [];
  const root = parseTree(original, errors, { allowTrailingComma: true, allowEmptyContent: true });
  if (errors.length || (root && root.type !== "object")) {
    throw new Error("The notebook's .vscode/settings.json must contain a valid settings object.");
  }

  const options = { formattingOptions: { insertSpaces: true, tabSize: 2 } };
  const withPath = applyEdits(original, modify(original, ["dailyNotes.notebookPath"], notebook.path, options));
  const contents = applyEdits(withPath, modify(withPath, ["dailyNotes.notebookName"], notebook.name, options));
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(filename, contents);
}
