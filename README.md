# Daily Notes Extension

This is the README for the "Daily Notes" extension. This extension allows you to create a daily note with a single command.

## Features

The "Daily Notes" extension provides the following feature:

### Editing

- **Create Daily Note**: With a single command `daily-notes.openTodaysDailyNote`, you can create a new note for the current day. This note is named with today's date and opened in a new editor tab.

- **Insert Date/Time**: You can insert the current date and time into the note with `daily-notes.insertTimestamp`.

### Content Control

Before enable this feature, you need to set the `dailyNotes.enableGit` to `true`. The extension will detect the git repository in the workspace and use it to commit the changes. Make sure the git repository is initialized and connected to a remote repository.

- **Commit**: You can commit the changes to the git repository with `daily-notes.commit`.

- **Sync with Remote**: You can push the changes to the remote repository with `daily-notes.sync`.

- **Auto Commit**: Set `dailyNotes.autoCommit` to `true`. then the extension will automatically commit the changes every `dailyNotes.autoCommitInterval` mintues to the git repository.

## Roadmap

### Editing

| Feature                   | Status |
| ------------------------- | :----: |
| Create daily note         |   ✅   |
| Insert date/time          |   ✅   |
| Templates                 |   💡   |
| Chinese word segmentation |   💡   |
| Insert title              |   💡   |
| Insert weekday            |   💡   |

### Statistics

| Feature                  | Status |
| ------------------------ | :----: |
| Word count on status bar |   💡   |
| Statistics something...  |   💡   |

### Content Control

| Feature                                   | Status |
| ----------------------------------------- | :----: |
| Auto Commit                               |   ✅   |
| Sync with remote                          |   ✅   |
| Toggle auto commit                        |   💡   |
| Force rewrite the remote repository       |   💡   |
| Archive the notes(merge by year or month) |   💡   |

## Requirements

There are no specific requirements or dependencies for this extension.

## Extension Settings

This extension does not contribute any settings through the `contributes.configuration` extension point.

## Known Issues

There are no known issues at the moment. If you encounter any problems, please report them in the [issue tracker](https://github.com/your-github-username/daily-notes/issues).

## Release Notes

### 0.0.1

Initial release of the "Daily Notes" extension.

### 0.0.2

Add support for workspace.

### 0.0.3

Add support for inserting date/time.

### 0.0.4

Add auto commit feature.

---

## Following extension guidelines

This extension follows the [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines).

## Recommended Extensions

We recommend installing the following extensions for an improved experience with this extension:

- [Markdown All in One](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one): All you need for Markdown (keyboard shortcuts, table of contents, auto preview and more).
- [MarkdownLint](https://marketplace.visualstudio.com/items?itemName=DavidAnson.vscode-markdownlint): A linter for Markdown files with a focus on consistency and flexibility.

## For more information

- [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
- [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
