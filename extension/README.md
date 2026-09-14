# Ambient Dashboard extension

A lightweight Manifest V3 new-tab extension for Microsoft Edge / Chromium. No framework, backend, or build step.

## v0.2 features

- Replaces the New Tab page with the glassy dashboard layout from the visual reference.
- Real Google Tasks integration through the official Google Tasks REST API: list switching, Today/Upcoming, add, complete, edit, and delete.
- Ambient sound mixer with Rain, Wind, Café, Thunder, Forest, and White Noise.
- Three quick sound presets and a main play/pause control.
- Focus timer with 25 / 5 / 15 minute modes.
- Local quick notes.
- Search with Google, Bing, or DuckDuckGo.
- Light, dark, and auto appearance.
- Independent primary and accent colors.
- Glass intensity and background dim controls.
- Scenic default imagery plus an optional local background image.

## Load it in Edge

1. Open `edge://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this `extension` folder.
5. After pulling an update, press **Reload** on the extension card.

## Connect Google Tasks

Google does not allow an extension to read private Tasks data anonymously, so a one-time OAuth client setup is required.

1. Open Ambient Dashboard → **Settings → Google Tasks**.
2. Use the **Open Google Cloud Tasks API** link and enable **Google Tasks API** for a Google Cloud project.
3. Configure the OAuth consent screen. For a personal test app, add your own Google account as a test user if Google asks for one.
4. Create an **OAuth 2.0 Client ID** of type **Web application**.
5. Copy the **Authorized redirect URI** shown by Ambient and add that exact URI to the OAuth client's Authorized redirect URIs.
6. Paste the client ID (`…apps.googleusercontent.com`) into Ambient.
7. Press **Connect / test Google Tasks** and approve access.

Once connected, the Tasks card displays and modifies the real lists in your Google account. The extension requests `https://www.googleapis.com/auth/tasks` and talks directly to `tasks.googleapis.com`.

The access token is kept in extension session storage when supported. Google browser access tokens are short-lived, so the extension can occasionally require another Connect click; avoiding that would require adding a backend/refresh-token service, which is intentionally outside this small personal extension.
