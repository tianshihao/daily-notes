import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { configureSyncRemote } from "../src/widget/git_remote_input";

suite("Git remote input", () => {
  function createBox() {
    const accept = new vscode.EventEmitter<void>();
    const button = new vscode.EventEmitter<vscode.QuickInputButton>();
    const change = new vscode.EventEmitter<string>();
    const hide = new vscode.EventEmitter<void>();
    let visible = false;
    function dismiss() {
      if (visible) {
        visible = false;
        hide.fire();
      }
    }

    const input = {
      value: "",
      enabled: true,
      busy: false,
      onDidAccept: accept.event,
      onDidTriggerButton: button.event,
      onDidChangeValue: change.event,
      onDidHide: hide.event,
      show: () => { visible = true; },
      dispose() {
        dismiss();
        for (const event of [accept, button, change, hide]) {
          event.dispose();
        }
      },
    } as vscode.InputBox;

    return { input, accept, button, dismiss, isVisible: () => visible };
  }

  for (const action of ["Enter", "OK"]) {
    test(`${action} leaves the input visible until Git has configured the remote`, async () => {
      const box = createBox();
      const url = "git@github.com:owner/repository.git";
      let complete!: (success: boolean) => void;
      const apply = new Promise<boolean>(resolve => { complete = resolve; });
      let submissions = 0;
      let finished = false;
      const result = configureSyncRemote(remote => {
        assert.equal(remote, url);
        submissions++;
        return apply;
      }, () => box.input).finally(() => { finished = true; });

      box.input.value = ` ${url} `;
      if (action === "Enter") {
        box.accept.fire();
      } else {
        box.button.fire(box.input.buttons[0]);
      }
      box.accept.fire();
      await Promise.resolve();

      assert.equal(submissions, 1);
      assert.equal(finished, false);
      assert.equal(box.isVisible(), true);
      assert.equal(box.input.busy, true);
      assert.equal(box.input.enabled, false);

      complete(true);
      assert.equal(await result, true);
      assert.equal(box.isVisible(), false);
    });
  }

  test("dismisses the input without running Git before submission", async () => {
    const box = createBox();
    const result = configureSyncRemote(async () => assert.fail("Git should not run"), () => box.input);
    assert.equal(box.isVisible(), true);
    box.dismiss();
    assert.equal(await result, false);
  });
});
