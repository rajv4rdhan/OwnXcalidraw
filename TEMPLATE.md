# OwnXcalidraw — private multi-board template

A single-user, password-protected Excalidraw deployment with online storage
(Supabase) hosted on Vercel.

- **Fixed password** login (served by Vercel serverless functions).
- **Multiple named boards**, each with its own canvas.
- **Online storage**: scenes in Supabase Postgres, images in a private Supabase
  Storage bucket.
- **Cross-device sync**: the server is the source of truth; the browser keeps a
  local cache for fast loads and offline edits.

The Supabase secret key never reaches the browser — all database and storage
access goes through `/api/*` serverless functions.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**. Note the project
   URL (`https://<ref>.supabase.co`).
2. **Storage** → **New bucket** → name `board-files`, keep it **Private**.
3. **SQL Editor** → **New query** → paste the contents of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) →
   **Run**. This creates `boards`, `scenes`, and `board_files` (RLS enabled,
   no public policies).
4. **Settings → API** → copy the **secret key** (`sb_secret_…`).

## 2. Configure environment variables

Copy [`.env.example`](.env.example) to `.env.local` and fill in:

```bash
APP_PASSWORD=<your fixed password>
SESSION_SECRET=<node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))">
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_…
SUPABASE_BUCKET=board-files
```

Add the same five variables in **Vercel → Project → Settings → Environment
Variables** (Production, Preview, and Development).

## 3. Deploy to Vercel

1. Push this repository to GitHub.
2. Vercel → **Import Project**. The build command (`yarn build:app`), output
   directory (`excalidraw-app/build`), and `api/` functions are auto-detected.
3. Deploy. Open the site and enter `APP_PASSWORD`.

## 4. Local development

Serverless functions require the Vercel CLI so that `/api` and the Vite app run
together:

```bash
corepack yarn install
corepack yarn dev        # vercel dev — serves the app + /api on one origin
```

> `yarn start` runs Vite alone and will **not** serve `/api`, so login and
> storage won't work. Use `yarn dev` for local development.

## 5. How it works

```
Browser (static SPA)
  /api/session|login|logout   password gate (signed HttpOnly cookie)
  /api/boards …               board CRUD + scene + files
        │  server-side only
        ▼
Supabase Postgres + private Storage bucket
```

| Area | Files |
|---|---|
| Serverless API | [`api/`](api) |
| Browser API client | [`excalidraw-app/api/`](excalidraw-app/api) |
| Auth UI | [`excalidraw-app/auth/`](excalidraw-app/auth) |
| Board picker | [`excalidraw-app/boards/`](excalidraw-app/boards) |
| Remote sync bridge | [`excalidraw-app/data/remoteStore.ts`](excalidraw-app/data/remoteStore.ts) |
| Schema | [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) |

## Notes

- **Change the password**: edit `APP_PASSWORD` in Vercel and redeploy.
- **Rotate keys**: if the Supabase secret key leaks, roll it in
  Supabase → Settings → API and update `SUPABASE_SECRET_KEY`.
- **Scene size**: scene JSON is saved through a serverless function (4.5 MB
  request limit). Images are uploaded directly to Storage via signed URLs, so
  they are not affected by that limit.
