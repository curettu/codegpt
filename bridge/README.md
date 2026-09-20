# CodeGPT VS Code Bridge

This extension exposes a local-only bridge at `http://127.0.0.1:3210`.
It uses the VS Code Language Model API, so authentication is handled by your installed GitHub Copilot extension. No API key is stored by CodeGPT.

## Run locally

1. Open this repository in VS Code.
2. Press `F5` and choose **VS Code Extension Development Host**.
3. In the new window, make sure GitHub Copilot is signed in.
4. Serve the project root with `node server.mjs`.
5. Open `http://127.0.0.1:4173`.

The bundled server also rewrites `/chat/<id>` to the app, so saved chat links can be opened directly or shared locally.

The bridge also answers `GET /health`. Its port can be changed with `codegptBridge.port` in VS Code settings.

The bridge only binds to loopback and only permits the local CodeGPT origin. It does not accept API keys or expose them to the browser.