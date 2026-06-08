# Scratch 3 Code Viewer

A static web app for uploading a Scratch 3 `.sb3` project file and viewing a source-style translation of its scripts.

The purpose of this tool is to help learners understand how Scratch’s visual block-based logic can relate to traditional programming languages.

It is not designed to run the generated code. It is designed to show what Scratch blocks could look like if they were written as code.

## Live App

The app is hosted on GitHub Pages.

[https://natbuilds.github.io/scratch-code-viewer/](https://natbuilds.github.io/scratch-code-viewer/)

## Supported Output Languages

* Python
* C++
* JavaScript
* Java
* C#

## Purpose

Scratch is great for learning programming fundamentals, but it hides a lot of the source-code structure that appears in traditional programming languages.

This tool helps bridge that gap.

It takes the blocks from a Scratch 3 project and displays them as readable source-style code, making it easier to understand concepts such as:

* Variables
* Loops
* Conditions
* Events
* Functions
* Sprite behaviour
* Broadcast messages
* Basic control flow

The generated output is intended for learning and inspection, not for direct execution.

## How It Works

Scratch 3 projects are saved as `.sb3` files.

An `.sb3` file is essentially a ZIP file containing the project data, including sprites, scripts, costumes, sounds, and stage information.

This app reads the `.sb3` file directly in the browser, extracts the Scratch block data, and converts the scripts into readable source-style code.

No files are uploaded to a server.

## Privacy

The app runs entirely in the browser.

Scratch project files are:

* Not uploaded
* Not stored
* Not sent to a server
* Not shared anywhere

Everything is processed locally on the user’s device.

## Usage

1. Open the hosted app in your browser.
2. Choose a Scratch 3 `.sb3` project file.
3. Select the output language.
4. View the generated source-style code.
5. Copy or download the output if needed.

## Local Development

You can also run the app locally.

Open `index.html` directly in a browser, or serve the folder using any static file server.

For example, using Python:

```bash
python -m http.server
```

Then open:

```text
http://localhost:8000
```

## Project Files

The app is made up of the following files:

```text
index.html
styles.css
app.js
README.md
```

## AI-Assisted Development

This project was developed with AI-assisted coding using OpenCode.

AI was used to help generate, structure, and refine parts of the codebase. The project direction, behaviour, testing, and final implementation decisions were reviewed and guided by the maintainer.

In plain English: AI helped write the code, but it did not decide what the app should be.

## Notes

The generated code is intended as readable source-style output.

It is not designed to be copied, compiled, and run as a complete program.

Scratch projects depend on the Scratch engine for sprites, costumes, sounds, events, broadcasts, positioning, timing, and stage behaviour.

Scratch-specific actions such as:

* `move_steps()`
* `say()`
* `broadcast()`

are emitted as placeholder runtime calls to make the logic easier to understand.

In short: this tool shows how Scratch blocks translate conceptually into code. It does not recreate the full Scratch runtime.

## Limitations

This tool does not fully recreate Scratch.

It does not provide:

* A Scratch runtime
* Sprite rendering
* Costume handling
* Sound playback
* Stage simulation
* Collision handling
* Full event execution
* Perfect one-to-one language conversion

The output should be treated as an educational approximation of the project logic.

## Why This Exists

This project was created as a learning tool for students moving from Scratch into text-based programming.

Scratch teaches the fundamentals well, but many learners eventually ask:

> What would these blocks look like as actual code?

This app attempts to answer that question in a simple, readable way.
