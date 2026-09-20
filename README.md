# CodeGPT

CodeGPT is a local AI coding workspace for VS Code. It connects a browser chat to the VS Code Language Model API through the included bridge, so authentication stays with GitHub Copilot and no API keys are placed in the website.

## Run

1. Open the repository in VS Code.
2. Press `F5` and run **Run CodeGPT VS Code Bridge**.
3. In the Extension Development Host, make sure GitHub Copilot is signed in.
4. From the repository root, run:

   ```powershell
   node server.mjs
   ```

5. Open <http://127.0.0.1:4173>.

Chats are saved in the browser and have shareable local routes such as `/chat/<id>`. Markdown, LaTeX, code blocks, multiple files, and images are supported.

## Important

The chat history is local to the browser profile. Model access and limits are provided by the signed-in VS Code/Copilot environment. The bridge listens on loopback only.
