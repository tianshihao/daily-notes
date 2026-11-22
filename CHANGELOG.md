# Changelog

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
