# Repository Guidelines

## Project Context

- This repository is a `uTools` plugin project.
- The main source files live in the repository root, including `index.html`, `preload.js`, `floating.html`, `floating_preload.js`, and `style.css`.
- `dist/` is the build output directory used for local plugin testing.

## Working Rules

- After every code change, run `cmd /c build.bat` from the repository root.
- Make sure the latest modified files are copied into `dist/` before finishing work.
- Do not edit files inside `dist/` directly unless the user explicitly asks for it.
- Treat `build.bat` as the standard way to prepare the plugin for testing in this repository.
