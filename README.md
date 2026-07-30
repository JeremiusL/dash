# dash

A personal command-center dashboard. Pixel-art retro home screen with three tiles:

- **Habits** — daily check-ins with streaks
- **Calendar** — a weekly view of events synced from Google Calendar and/or Apple Calendar
- **Learning Center** — reference links, freeform notes, and a reading list

## Running it

```
npm install
npm run dev
```

This starts the backend on `http://localhost:3001` and the frontend on `http://localhost:5173`. Open the frontend URL in your browser.

Data is stored as JSON files in `backend/data/`. Nothing is sent anywhere except to Google and/or Apple (iCloud), and only for the Calendar feature once you connect it.

## Connecting Google Calendar

The Calendar tile works without any setup — it just shows "not connected" until you do this one-time setup:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project (or pick an existing one).
2. In **APIs & Services > Library**, search for **Google Calendar API** and enable it.
3. In **APIs & Services > OAuth consent screen**, set it up as **External** (or **Internal** if you have a Workspace account), fill in the required app name/support email fields, and add your own Google account as a **test user** if prompted.
4. In **APIs & Services > Credentials**, click **Create Credentials > OAuth client ID**.
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:3001/api/calendar/oauth-callback`
5. Copy the generated **Client ID** and **Client Secret**.
6. Copy `backend/.env.example` to `backend/.env` and fill in:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/calendar/oauth-callback
   ```
7. Restart the backend (`npm run dev` again, or just the backend workspace). Open the Calendar tile and click **Connect Google Calendar**.

Tokens are saved to `backend/data/google-tokens.json` (gitignored) so you only have to connect once.

## Connecting Apple Calendar

Apple Calendar connects over CalDAV using an **app-specific password** — never your real Apple ID password, which CalDAV clients can't use anyway once two-factor is on.

1. Go to [appleid.apple.com](https://appleid.apple.com/), sign in, and under **Sign-In and Security > App-Specific Passwords**, generate one (e.g. named "dash").
2. Copy `backend/.env.example` to `backend/.env` if you haven't already, and fill in:
   ```
   APPLE_ID=you@icloud.com
   APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ```
3. Restart the backend. Unlike Google, there's no separate "Connect" click — once the credentials are in `.env` and valid, the Calendar tile picks it up automatically.

Nothing is stored beyond what's already in `.env`; each request authenticates fresh against `caldav.icloud.com`.

## Project layout

```
backend/    Express + TypeScript API, JSON file storage, Google OAuth
frontend/   Vite + React + TypeScript, pixel-art UI
```
