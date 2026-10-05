# Steam Actions Plugin

Adds a native-style **Actions** menu to Steam Store game pages and Steam Library game views.

---

## Architecture Overview (For Developers)

Millennium plugins bridge three runtime environments:

```
┌────────────────────────────────┐       RPC (FFI)        ┌───────────────────────────────────┐
│     Backend (LuaJIT)           │ ◄────────────────────► │      Frontend (React / Steam UI)  │
│  - backend/main.lua            │                        │  - frontend/index.tsx (patches)   │
│  - backend/rpc_functions.lua   │                        │  - frontend/modals.tsx (modals)   │
│  - backend/installer.lua       │                        │  - frontend/context.ts (fibers)   │
│  - backend/settings.lua        │                        └───────────────────────────────────┘
│  - backend/paths.lua           │
└────────────────────────────────┘
                 ▲
                 │ RPC (window.backend)
                 ▼
┌────────────────────────────────┐
│     Webview (Store Preload)    │
│  - webview/preload.ts          │
│  - webview/application/        │
│  - webview/ui/                 │
└────────────────────────────────┘
```

### 1. `backend/` (LuaJIT)
Runs on the Steam client host process with direct filesystem and OS process capabilities.
- **`main.lua`**: Plugin startup and lifecycle hooks (`on_load`).
- **`rpc_functions.lua`**: Thin router exposing `@ffi` methods callable from frontend/webview.
- **`paths.lua`**: Resolves Steam directory paths (`config/stplug-in/`, `depotcache/`).
- **`settings.lua`**: Manages API key persistence, encryption/masking, and expiration.
- **`installer.lua`**: Handles package downloads, zip extraction, and placing `.manifest`/`.lua` files.

### 2. `frontend/` (React / Steam Client UI)
Injected into the Steam desktop client user interface.
- **`index.tsx`**: Registers Steam desktop window observers (injects the 3-dots Actions button) and context menu patches.
- **`modals.tsx`**: Clean React modals (`ActionsModal`, `AddToLibraryModal`, `RemoveFromLibraryModal`, `SettingsModal`).
- **`context.ts`**: Safely extracts the active game context (`appId`, `title`) from React fiber nodes and DOM attributes.
- **`ui/`**: Shared theme styles (`styles.ts`) and vector icons (`icons.tsx`).

### 3. `webview/` (Store Browser Webview)
Injected into the embedded Chromium webview when browsing the Steam Store.
- Intercepts Store page navigations and injects native-styled action buttons into `.queue_actions_ctn`.

---

## Development & Build

### Prerequisites
- [Bun](https://bun.sh/)
- [Millennium](https://millennium.sh/) installed in Steam

### Setup
```bash
# Install dependencies
bun install

# Build & pack the plugin bundle (compiles directly to Steam plugins)
bun run build

# Watch mode for live development
bun run dev
```
