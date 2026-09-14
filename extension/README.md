# Ambient Dashboard extension

A small Manifest V3 new-tab extension for Microsoft Edge and Chrome. No framework or build step.

## Features

- Replaces the New Tab page.
- Google Tasks: list selection, Today/Upcoming views, add, complete, edit, delete, refresh.
- Search with Google, Bing, or DuckDuckGo.
- Custom shortcuts (right-click one to remove it).
- Local quick notes.
- Light/dark/auto appearance.
- Independent primary and accent colors.
- Glass intensity and background dim controls.
- Optional local background image.

## Load it in Edge

1. Open `edge://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this `extension` folder.

Chrome uses the same process at `chrome://extensions`.

## Connect Google Tasks

Google requires an OAuth client ID for access to private Tasks data. The extension deliberately does not ship somebody else's credential.

1. In Google Cloud Console, create or select a project.
2. Enable **Google Tasks API**.
3. Configure the OAuth consent screen. For personal testing, add your Google account as a test user if Google asks for one.
4. Create an **OAuth 2.0 Client ID** of type **Web application**.
5. Open Ambient Dashboard → Settings and copy the **Authorized redirect URI** shown there.
6. Add that exact URI to the Google OAuth client's **Authorized redirect URIs**.
7. Copy the client ID (`…apps.googleusercontent.com`) into Ambient Dashboard → Settings and save.
8. Press **Connect** in the Tasks card and approve access.

The extension requests only `https://www.googleapis.com/auth/tasks` and calls the official Google Tasks REST API directly. The access token is kept in extension session storage when supported, so it is cleared when the browser session ends. You may need to reconnect after the short-lived Google token expires; this keeps the first version backend-free and small.

## Notes

Microsoft Edge supports `chrome.identity.launchWebAuthFlow`, which is why this extension uses that flow instead of Chrome-only `identity.getAuthToken`.

The existing Ambient website remains untouched; the extension lives entirely in this folder.
