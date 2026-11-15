# GastroScript for VS Code

Python with a stomach. Open any `.gs` (or `.gastro`) file.

- **Live squiggles** as you type: `IndigestionError` (variable isn't food), `DietaryViolationError`
  (you broke an imported diet), a 🤢 warning when the stomach is gurgling, and `DiarrheaError`
  on the line that tipped it over.
- **Food colors**: fat is bold red, dairy yellow, spice glows orange, fiber green, remedies cyan.
- **Hover** any food to see its nutrients.
- **Body effects**: the whole program gets chubbier, then bold, as the stomach fills.
- **Status bar**: `🫃 62% BLOATED`. Click it to open the stomach.
- **Stomach panel** (pulse icon in the editor title): a live stomach that fills, bubbles, shakes and rains 💩.
- **Run** (▶ in the editor title, or `Ctrl+Alt+G`): runs the file through `gastric.py` in a terminal.

## Requirements
Python 3.9+. On Windows the `py` launcher is used by default; change it with `gastroscript.pythonPath`.

## Build and install (no Node needed)
```
py vscode-gastroscript/build_vsix.py
code --install-extension vscode-gastroscript/gastroscript-0.1.0.vsix
```
Uninstall: `code --uninstall-extension stupid-ideas.gastroscript`

For development, open `vscode-gastroscript/` in VS Code and press F5.

Note: `.gs` is also used by Google Apps Script. If you have an Apps Script extension, pick
GastroScript from the language picker in the status bar, or use `.gastro`.
