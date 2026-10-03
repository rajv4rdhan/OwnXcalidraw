<a href="https://excalidraw.com/" target="_blank" rel="noopener">
  <picture>
    <img alt="Excalidraw" src="https://res.cloudinary.com/du06umyos/image/upload/v1791035450/Gemini_Generated_Image_pg8kp6pg8kp6pg8k_ramqhc.png" />
  </picture>
</a>

<div align="center">
  <h2>
    A selfhosted, password-protected whiteboard for sketching hand-drawn style diagrams.
    </br>
    A private fork of Excalidraw.
  </h2>
</div>

<br />
<p align="center">
  <a href="./LICENSE">
    <img alt="Released under the MIT license." src="https://img.shields.io/badge/license-MIT-blue.svg" /></a>
</p>

<div align="center">
  <figure>
    <a href="https://excalidraw.com" target="_blank" rel="noopener">
      <img src="https://excalidraw.nyc3.cdn.digitaloceanspaces.com/github%2Fproduct_showcase.png" alt="Product showcase" />
    </a>
    <figcaption>
      <p align="center">
        Create beautiful hand-drawn like diagrams, wireframes, or whatever you like.
      </p>
    </figcaption>
  </figure>
</div>

## What this is

A minimal fork of [Excalidraw](https://github.com/excalidraw/excalidraw) turned into a
**private, single-user drawing board** you can self-host in a few minutes. No sign-ups,
no accounts, no tracking — just a password and your canvas.

- **Password protected** — a single fixed password gate; there is no user system.
- **Multiple boards** — create, rename and switch between named boards.
- **Online storage** — scenes and images are stored in your own Supabase project
  (Postgres + a private Storage bucket).
- **Cross-device** — the server is the source of truth, so the same board opens on
  any device. The browser keeps a local cache for fast loads.
- **Runs on Vercel** — static app + a handful of serverless `/api` functions.

Everything that makes Excalidraw great is still here: infinite canvas, hand-drawn
style, shape libraries, image support, i18n, dark mode, and export to PNG / SVG /
`.excalidraw`.

## Features

- 🔒&nbsp;Password protected, single-user.
- 🗂️&nbsp;Multiple named boards.
- ☁️&nbsp;Online storage via Supabase (scenes + images).
- 🔄&nbsp;Cross-device sync with a local cache.
- 🎨&nbsp;Infinite, canvas-based whiteboard.
- ✍️&nbsp;Hand-drawn like style.
- 🌓&nbsp;Dark mode.
- 📷&nbsp;Image support.
- 😀&nbsp;Shape libraries support.
- 🌐&nbsp;Localization (i18n) support.
- 🖼️&nbsp;Export to PNG, SVG & clipboard.
- 💾&nbsp;Open format — export drawings as an `.excalidraw` json file.
- ⚒️&nbsp;Wide range of tools — rectangle, circle, diamond, arrow, line, free-draw, eraser…
- ➡️&nbsp;Arrow-binding & labeled arrows.
- 🔙&nbsp;Undo / Redo.
- 🔍&nbsp;Zoom and panning support.

## Self-hosting

1. Create a Supabase project and run
   [`supabase/migrations/0001_init.sql`](./supabase/migrations/0001_init.sql)
   in the SQL Editor. Create a **private** Storage bucket named `board-files`.
2. Copy [`.env.example`](./.env.example) to `.env.local` and fill in the secrets.
3. Deploy to Vercel (the build command and `api/` functions are auto-detected).

Full step-by-step instructions are in [TEMPLATE.md](./TEMPLATE.md).

## Local development

```bash
corepack yarn install
corepack yarn start      # http://localhost:3001 — app + /api on one origin
```

The dev server runs the app and the serverless handlers together (a dev-only Vite
plugin), so no Vercel account is needed locally.

## Credits

This project is a fork of **[Excalidraw](https://github.com/excalidraw/excalidraw)**,
an open source virtual hand-drawn style whiteboard. All credit for the editor goes to
the Excalidraw authors and contributors. This fork only adds a private, self-hosted
storage/auth layer around it.

## License

[MIT](./LICENSE)
