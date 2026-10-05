# Steam Actions

A Millennium plugin that adds a native-style **Actions** menu to Steam Store game pages and Steam Library game views.

---

## Features

- **Store Integration**: Injects a native-styled **Actions** button directly into Steam Store pages.
- **Library Integration**: Adds a 3-dots **Actions** button next to the game Manage controls, plus an option in the right-click game context menu.
- **Game Management**: Quick actions to manage library items, add/remove games, view in store, and configure settings.
- **Seamless & Lightweight**: Runs locally via Steam's built-in Millennium framework with LuaJIT backend and React UI.

---

## Prerequisites

- [Millennium](https://steambrew.app/) (Steam Client Modding Framework)

---

## Installation

1. Download the latest `steam-actions.star` package from the [Releases](https://github.com/PolCasilla/Steam-Actions/releases) page.
2. Place `steam-actions.star` inside your Steam plugins folder:
   - **Windows**: `<Steam Install Folder>/plugins/`
3. Restart Steam or reload plugins via the Millennium menu.

---

## Usage

- **From Steam Store**: Browse to any game page on the Store to find the **Actions** button in the actions bar.
- **From Steam Library**: Click the 3-dots **Actions** button on any game details header, or right-click any title in your library list and select **Actions**.
- **Settings**: Open the Actions modal and select **Settings** to configure your API key.

---

## Development & Build

### Prerequisites
- [Bun](https://bun.sh/)
- [Millennium](https://steambrew.app/)

### Setup
```bash
# Install dependencies
bun install

# Pack release bundle (.star)
bun run build

# Watch mode for active development
bun run dev
```

---

## Credits & Acknowledgments

- **[Millennium / SteamBrew](https://steambrew.app/)** – For the Steam client modding platform and the Starlight plugin toolchain.

---

## Disclaimer

This project is an independent community plugin and is not affiliated with, endorsed by, or associated with Valve Corporation or Steam.
