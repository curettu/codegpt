# CodeGPT

CodeGPT is a public AI coding workspace with Markdown, LaTeX, code blocks, file attachments, persistent chats, and shareable `/chat/<id>` routes.

The production site uses the included Vercel serverless API. Visitors do not need VS Code, extensions, or their own API keys. The provider key is stored only in Vercel Environment Variables.

## Public deployment on Vercel

1. Import this repository into Vercel.
2. Add these Environment Variables in the project settings:

   ```text
   AI_API_KEY=your-server-side-key
   AI_BASE_URL=https://api.openai.com/v1
   AI_MODEL_LUNA=your-primary-model
   AI_MODEL_CLAUDE=your-fallback-model
   AI_MODEL_GEMINI=your-last-fallback-model
   ```

3. Deploy and open the generated `*.vercel.app` URL.

`AI_BASE_URL` must expose an OpenAI-compatible `/chat/completions` endpoint. The model names are configured by you; Copilot-only model names cannot be called from a public Vercel function.

## Local development

1. Open the repository in VS Code.
2. Press `F5` and run **Run CodeGPT VS Code Bridge**.
3. In the Extension Development Host, make sure GitHub Copilot is signed in.
4. From the repository root, run:

   ```powershell
   node server.mjs
   ```

5. Open <http://127.0.0.1:4173>.

Chats are saved in the browser and have shareable routes such as `/chat/<id>`. Markdown, LaTeX, code blocks, multiple files, and images are supported.

## Important

The chat history is local to the browser profile. In production, model access and usage limits come from the configured provider account. The optional VS Code bridge is only for local development and listens on loopback only.
