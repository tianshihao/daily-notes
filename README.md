# Daily Notes Extension

This is the README for the "Daily Notes" extension. This extension allows you to create a daily note with a single command.

## Features

The "Daily Notes" extension provides the following feature:

### Editing

- **Create Daily Note**: With a single command `daily-notes.openTodaysDailyNote`, you can create a new note for the current day. This note is named with today's date and opened in a new editor tab.

- **Insert Date/Time**: You can insert the current date and time into the note with `daily-notes.insertTimestamp`.

## Statistics

- **Word Count on Status Bar**: The extension shows the word count of the current note on the status bar.

### Content Control

Before enable this feature, you need to set the `dailyNotes.enableGit` to `true`. The extension will detect the git repository in the workspace and use it to commit the changes. Make sure the git repository is initialized and connected to a remote repository.

- **Commit**: You can commit the changes to the git repository with `daily-notes.commit`.

- **Sync with Remote**: You can push the changes to the remote repository with `daily-notes.sync`.

- **Auto Commit**: Set `dailyNotes.autoCommit` to `true`. then the extension will automatically commit the changes every `dailyNotes.autoCommitInterval` mintues to the git repository.

## Roadmap

The [Roadmap](ROADMAP.md).

## Requirements

Install Commitizen globally on your machine using npm. Then you can initialize it in your project to use a cz-emoji-conventional adapter.

```bash
npm install -g commitizen
commitizen init cz-emoji-conventional --save-dev --save-exact --force
```

Now, instead of using `git commit`, you can use `git cz` to commit changes using Commitizen's prompts to generate standardized commit messages. Or you can press `C` instead of `c` if you use lazygit.

## Extension Settings

This extension does not contribute any settings through the `contributes.configuration` extension point.

## Known Issues

There are no known issues at the moment. If you encounter any problems, please report them in the [issue tracker](https://github.com/your-github-username/daily-notes/issues).

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
