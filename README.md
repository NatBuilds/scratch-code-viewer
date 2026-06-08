# Scratch 3 Code Viewer

A static web app for uploading a Scratch 3 `.sb3` project file and viewing a source-style translation of its scripts.

Supported output languages:

- Python
- C++
- JavaScript
- Java
- C#

## Run Locally

Open `index.html` in a browser, or serve the folder with any static file server.

## Host On GitHub Pages

1. Create a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md` to the repository root.
3. In GitHub, go to `Settings` > `Pages`.
4. Set the source to `Deploy from a branch`.
5. Choose your default branch and `/root`, then save.

The app does all parsing in the browser. Scratch project files are not uploaded to a server.

## Notes

The generated code is intended as readable source-style output. Scratch-specific actions such as `move_steps()`, `say()`, and `broadcast()` are emitted as placeholder runtime calls because Scratch projects depend on the Scratch engine for sprites, sounds, costumes, and stage behavior.
