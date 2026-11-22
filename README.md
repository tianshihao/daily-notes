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

Use **Daily Notes: Insert Timestamp** to mark an entry. The status bar shows a word count for the active note, counting each Chinese character and each run of English letters as one.

If setup prompts again, open the notebook folder itself in VS Code. In **Workspace Settings**, set `dailyNotes.notebookPath` to its full path. The path must match one of the folders open at the root of the workspace.

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
| `dailyNotes.notebookName` | `""` | Notebook name recorded during setup. |
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

Run `npm run compile` for type checking, linting, and bundling. Run `npm test` to compile and execute the extension tests. On first use the runner downloads VS Code 1.90.0, the oldest version this extension supports.

After staging a change, run `npm exec -- cz` to create a commit. The `npm ci` step installs Commitizen and the repository's emoji adapter.

See the [roadmap](ROADMAP.md) for planned features or [open an issue](https://github.com/tianshihao/daily-notes/issues) to report a problem.
