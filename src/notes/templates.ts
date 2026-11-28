import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { configManager } from "../config_manager/config_manager";
import { isMarkdownFileInDirectory } from "../utils/filesystem";
import { defaultNoteTemplates, notePeriods, renderNoteTemplate, type NotePeriod, type NotePlaceholderValues } from "./period";

export async function createNoteContent(
  root: string, period: NotePeriod, variables: Readonly<NotePlaceholderValues>
): Promise<string> {
  const configured = configManager.get("templates")[period];
  if (configured === undefined) {
    return renderNoteTemplate(defaultNoteTemplates[period], variables);
  }
  const filename = await existingTemplate(root, configured);
  try {
    return renderNoteTemplate(await fs.readFile(filename, "utf8"), variables);
  } catch (error) {
    throw new Error(`Template "${configured}": ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function openNoteTemplate(root: string): Promise<void> {
  const choice = await vscode.window.showQuickPick(
    notePeriods.map((period) => ({ label: period.charAt(0).toUpperCase() + period.slice(1), period })),
    { placeHolder: "Choose a note template to edit" }
  );
  if (!choice) {
    return;
  }

  const { period } = choice;
  const configured = configManager.get("templates")[period];
  const relative = configured || `templates/${period}.md`;
  if (configured === undefined) {
    const directory = path.join(root, "templates");
    await fs.mkdir(directory, { recursive: true });
    const actualDirectory = await fs.realpath(directory);
    if (path.relative(await fs.realpath(root), actualDirectory) !== "templates") {
      throw new Error("The templates directory must resolve to the notebook's templates folder.");
    }
    try {
      await fs.writeFile(path.join(root, relative), defaultNoteTemplates[period], { flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }
  }

  const filename = await existingTemplate(root, configured ?? relative);
  const document = await vscode.workspace.openTextDocument(filename);
  if (configured === undefined) {
    const config = vscode.workspace.getConfiguration("dailyNotes");
    const workspaceTemplates = config.inspect<Partial<Record<NotePeriod, string>>>("templates")?.workspaceValue;
    await configManager.update("templates", { ...workspaceTemplates, [period]: relative }, vscode.ConfigurationTarget.Workspace);
  }
  await vscode.window.showTextDocument(document);
}

async function existingTemplate(root: string, relative: string): Promise<string> {
  if (typeof relative !== "string" || path.extname(relative).toLowerCase() !== ".md") {
    throw new Error(`Template path must point to a .md file: "${String(relative)}".`);
  }
  if (path.isAbsolute(relative)) {
    throw new Error(`Template path must be relative to the notebook: "${relative}".`);
  }
  const filename = path.resolve(root, relative);
  const entry = await fs.stat(filename).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      throw new Error(`Template file does not exist: "${relative}".`);
    }
    throw error;
  });
  if (!entry.isFile() || !isMarkdownFileInDirectory(vscode.Uri.file(filename), vscode.Uri.file(root))) {
    throw new Error(`Template must resolve to a regular file inside the notebook: "${relative}".`);
  }
  return filename;
}
