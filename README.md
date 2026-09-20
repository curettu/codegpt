# CodeGPT

CodeGPT is a public AI coding workspace with Markdown, LaTeX, code blocks, file attachments, persistent chats, and shareable `/chat/<id>` routes.

It uses the official v0 API to generate applications. Each generated app can be published to Vercel or downloaded as a ZIP archive.

The production site uses the official v0 API through the included Vercel serverless API. Visitors do not need VS Code, extensions, or their own API keys. The v0 key is stored only in Vercel Environment Variables.

## Public deployment on Vercel

1. Import this repository into Vercel.
2. In **Settings -> Environment Variables**, add:

   ```text
   V0_API_KEY=your-v0-server-side-key
   ```

3. Deploy and open the generated `*.vercel.app` URL.

Create the key in [v0 settings](https://v0.app/settings/keys). Keep it server-side and never prefix it with `NEXT_PUBLIC_`.

Chats are saved in the browser and have shareable routes such as `/chat/<id>`. Markdown, LaTeX, code blocks, multiple files, and images are supported.

## Important

The chat history is local to the browser profile. Model access and usage limits come from the configured v0 account.
