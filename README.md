# Daily Notes

Open today's Markdown note in VS Code with a single command. Run it again later to pick up where you left off. Each note is a regular file in the folder you choose.

## Features

| Feature | What it does |
| --- | --- |
| Daily notes | Open today's `YYYY-MM-DD.md`. A new note starts with the date and weekday as its heading. |
| Timestamps | Insert the current local date and time at the cursor. |
| Writing statistics | See the word count and detected language in the status bar as you type. |
| Git history | Commit notebook changes manually or on a schedule you choose. |
| Remote sync | Sync the current branch with its configured upstream on demand or after a commit. |

## Write your first note

1. Open a folder in VS Code so Daily Notes can save its workspace settings. With the extension loaded, open the Command Palette and run **Daily Notes: Open Today's Daily Note**. To load it from source, follow [Local development](#local-development).
2. On first use, choose **Create** to make a notebook folder or **Update** to select an existing folder. Choose **Current** to use that folder in the current workspace.
3. Start writing. For example, on November 22, 2026, the command opens `2026-11-22.md` in the notebook folder. A new note starts with the heading `# 2026-11-22 Sun`.

Use **Daily Notes: Insert Timestamp** to mark an entry.

If setup prompts again, open the notebook folder itself in VS Code. In **Workspace Settings**, set `dailyNotes.notebookPath` to its full path. The path must match one of the folders open at the root of the workspace.

## Status bar

The Daily Notes status bar appears only for Markdown (`.md`) files in the configured notebook folder or its subfolders. It shows **Document Stats** followed by **Git Status** in one entry. If you set `dailyNotes.notebookName`, the name appears before the first visible component, for example `Journal  |  Git: Off`.

1. **Document Stats** shows the word count and detected language, for example `Words: 42 · Language: zh`. Each Han ideograph counts as one, including in mixed text. English uses word boundaries, so `Meeting notes: 讨论` counts as four and `don't` counts as one. Standalone numbers and HTML tags are excluded. Language detection runs locally on a sample of the note and shows `und` when there is too little evidence.
2. **Git Status** shows `Git: Off` when Git integration is disabled. Enabling Git expands it to show both automation settings, for example `Git: On · Auto Commit: On · Auto Sync: Off`.

Run **Daily Notes: Toggle Document Stats Visibility** or **Daily Notes: Toggle Git Status Visibility** in the Command Palette to show or hide either component. Each command saves its setting in the current workspace, or in User Settings if the window has no workspace. Git operations continue according to your Git settings when the indicator is hidden. Hiding both components hides the entire entry.

Only the active Markdown note is analyzed. Hiding Document Stats stops both counting and language detection. Showing it again reuses the saved result if the document is unchanged. Large documents show `…` while the initial count runs in short, interruptible steps. Ordinary edits update the affected lines, and consecutive keystrokes share a status bar refresh.

On VS Code 1.90, a newly opened file must fit within 52,428,800 UTF-16 code units for VS Code to expose its text to extensions. An ordinary Han character uses one unit and a supplementary character such as `𠮷` uses two. This limit applies to each file individually. [VS Code text model](https://github.com/microsoft/vscode/blob/1.90.0/src/vs/editor/common/model/textModel.ts)

## Optional Git sync

Use an existing Git repository or initialize one in the notebook folder. Run **Daily Notes: Toggle Enable Git** to enable Git, start automatic commits, and leave automatic sync off. Switching notebooks in the same window also switches the repository used by these commands.

- **Daily Notes: Commit** saves open, modified documents under the notebook folder and commits changes within it, including new and deleted files. Files already staged elsewhere in the same repository stay staged.
- **Daily Notes: Sync** first commits notebook changes locally, then fetches the checked-out branch's upstream (for example, `origin/main`). It fast-forwards a branch that is behind or pushes one that is ahead. If both sides have new commits, it stops so you can reconcile them in Git. Sync applies to the whole branch, including any earlier local commits. Use `git branch -vv` to see which upstream your branch tracks.
- Use **Daily Notes: Toggle Auto Commit** to switch between manual and scheduled commits, and **Daily Notes: Toggle Auto Sync** to sync after commits.

## Settings

Open VS Code Settings and search for `dailyNotes`.

| Setting | Default | Purpose |
| --- | --- | --- |
| `dailyNotes.notebookPath` | `""` | Full path to the notebook folder. |
| `dailyNotes.notebookName` | `""` | Optional name shown at the start of the notebook's status bar entry. |
| `dailyNotes.showDocumentStats` | `true` | Show document stats for Markdown notes. |
| `dailyNotes.showGitStatus` | `true` | Show the Git status item for Markdown notes. |
| `dailyNotes.enableGit` | `false` | Enable Git integration for the notebook. |
| `dailyNotes.autoCommit` | `false` | Schedule local commits. |
| `dailyNotes.autoCommitInterval` | `10` | Minutes between automatic commits. The interval command accepts 2–600. |
| `dailyNotes.commitMessage` | `Auto commited by Daily Notes` | Prefix for commit messages. The extension appends a timestamp. |
| `dailyNotes.autoSync` | `false` | Sync with the remote after a commit. |

## Local development

1. Start with desktop VS Code (1.90 or later in the 1.x series), Node.js 24 with npm, and Git. Clone the repository and install its dependencies.

   ```sh
   git clone https://github.com/tianshihao/daily-notes.git
   cd daily-notes
   npm ci
   ```

2. Open the cloned folder in VS Code. In Extensions, search for `@recommended` and enable **esbuild Problem Matchers**. The default debug task uses it to detect when the bundle is ready. The [workspace recommendations](.vscode/extensions.json) also include editor, Git, and appearance tools.
3. In **Run and Debug**, select **Run Extension** and press **F5**. Keep the source window open. A second window titled **Extension Development Host** loads your local build.
4. Open a folder for test notes in the **development host**. In the **source window**, set a breakpoint on the first statement in `openTodaysDailyNote()` in [src/extension.ts](src/extension.ts). Run **Daily Notes: Open Today's Daily Note** in the development host. The debugger pauses in the source window. Press **F5** to continue.
5. Edit and save a TypeScript file. The watch tasks rebuild it. Run **Developer: Reload Window** in the development host and invoke the command again to try the change.

The extension code lives in `src/` and its test suites and fixtures live in `test/`. Run `npm run compile` for type checking, linting, and bundling. Run `npm test` to compile and execute the extension tests. On first use the runner downloads VS Code 1.90.0, the oldest version this extension supports.

After staging a change, run `npm exec -- cz` to create a commit. The `npm ci` step installs Commitizen and the repository's emoji adapter.

See the [roadmap](ROADMAP.md) for planned features or [open an issue](https://github.com/tianshihao/daily-notes/issues) to report a problem.
