# dash

A personal command-center dashboard. Pixel-art retro home screen with three tiles:

- **Habits** — daily check-ins with streaks
- **Calendar** — upcoming events synced from Google Calendar
- **Learning Center** — reference links, freeform notes, and a reading list

## Running it

```
npm install
npm run dev
```

This starts the backend on `http://localhost:3001` and the frontend on `http://localhost:5173`. Open the frontend URL in your browser.

Data is stored as JSON files in `backend/data/`. Nothing is sent anywhere except to Google, and only for the Calendar feature once you connect it.

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

## Project layout

```
backend/    Express + TypeScript API, JSON file storage, Google OAuth
frontend/   Vite + React + TypeScript, pixel-art UI
```
