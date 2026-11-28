import * as vscode from "vscode";
import type { ApplySyncRemote } from "../git_service/git_service";
import { Logger } from "../utils/logger";

export function configureSyncRemote(
  apply: ApplySyncRemote,
  createInputBox = vscode.window.createInputBox,
): Promise<boolean> {
  const input = createInputBox();
  const confirm = { iconPath: new vscode.ThemeIcon("check"), tooltip: "OK" };
  const prompt = "This repository has no Git remote. Enter the address of the repository to sync with.";
  input.title = "Daily Notes: Set Up Git Sync";
  input.prompt = prompt;
  input.placeholder = "git@github.com:owner/repository.git";
  input.ignoreFocusOut = true;
  input.buttons = [confirm];

  return new Promise<boolean>(resolve => {
    let submitting = false;
    let hidden = false;

    function finish(applied: boolean) {
      resolve(applied);
      input.dispose();
    }

    async function submit() {
      if (submitting || hidden) {
        return;
      }
      const url = input.value.trim();
      if (!url) {
        input.validationMessage = "Enter a Git remote address.";
        return;
      }
      submitting = true;
      input.validationMessage = undefined;
      input.enabled = false;
      input.busy = true;
      input.prompt = "Adding Git remote…";

      try {
        finish(await apply(url));
      } catch (error) {
        const detail = Logger.error("Git / Auto Sync Setup", error);
        if (hidden) {
          finish(false);
          return;
        }
        submitting = false;
        input.enabled = true;
        input.busy = false;
        input.prompt = prompt;
        input.validationMessage = detail.split(/\r?\n/, 1)[0];
      }
    }

    input.onDidChangeValue(() => { input.validationMessage = undefined; });
    input.onDidAccept(submit);
    input.onDidTriggerButton(button => {
      if (button === confirm) {
        void submit();
      }
    });
    input.onDidHide(() => {
      hidden = true;
      if (!submitting) {
        finish(false);
      }
    });
    input.show();
  });
}
