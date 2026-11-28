# Changelog

## 1.0.0 (2026-11-28)

- Open weekly, monthly, quarterly, and yearly notes by their period start date. Weekly filenames include the ISO week number.
- Navigate between existing notes of the same period in source or Markdown preview.
- Open the existing daily note for the same date last year, including from Markdown preview.
- Create and edit a Markdown template for each note period with **Open Note Template**. Templates support date placeholders and report invalid paths or unknown placeholders in the Daily Notes output channel.
- Click the status bar to toggle display and automation settings. The Git integration switch preserves automatic commit and sync preferences.
- Require at least three minutes between automatic commits. Existing two-minute intervals run at three minutes.
- Use **Sync and Quit** to exit VS Code after a successful notebook sync.
- Save notebook settings before opening the notebook in another window, preserving existing settings and comments.

## 0.0.11 (2026-11-28)

- Add Previous Daily Note and Next Daily Note commands that skip dates with no entry.
- Keep adjacent notes in Markdown preview when navigating from the preview.

## 0.0.10 (2026-11-22)

- Show the notebook name, document statistics, and Git settings together when editing Markdown notes in the notebook. Document Stats and Git Status can each be toggled from the Command Palette.
- Count Han characters and English words in mixed-language notes. Word counts update incrementally as you edit, and language detection runs locally. Hiding Document Stats pauses analysis.
- Limit Git commits to the notebook folder and sync the current branch with its configured upstream. Sync fast-forwards or pushes when possible and reports diverging histories for manual resolution.
- Add a book icon for the extension.

## 0.0.9 (2024-07-30)

- Opening today's note now prompts for notebook setup when the configured folder is missing from the workspace.

## 0.0.8 (2024-07-17)

- Show notebook status items when editing files in the notebook folder.
- Sync on startup when Git, automatic commits, and automatic sync are all enabled.

## 0.0.7 (2024-07-05)

- Show the detected language alongside the word count in the status bar.
