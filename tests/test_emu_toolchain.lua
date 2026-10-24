local helper = require("helper")

-- Set up mock fs state for test
local mock_files = {}

package.loaded["fs"] = {
    exists = function(p)
        p = (p:gsub("\\", "/"):gsub("/+", "/"))
        return mock_files[p] == true
    end,
    join = function(...)
        local parts = {...}
        return (table.concat(parts, "/"):gsub("\\", "/"):gsub("/+", "/"))
    end,
    create_directories = function(p) return true end,
}

local emu_toolchain = require("emu_toolchain")

local emu_dir = emu_toolchain.get_emu_dir()
helper.assert(emu_dir ~= nil and emu_dir ~= "", "get_emu_dir returns valid path")

-- 1. Initially nothing exists -> toolchain_ready must be false
local ready, missing = emu_toolchain.toolchain_ready()
helper.eq(ready, false, "initially toolchain_ready is false")
helper.assert(#missing > 0, "lists missing files")

-- 2. Populate all required files
local required = {
    emu_dir .. "/.ready4",
    emu_dir .. "/x64/version.dll",
    emu_dir .. "/x64/coldloader.dll",
    emu_dir .. "/x64/steamclient64.dll",
    emu_dir .. "/x64/GameOverlayRenderer64.dll",
    emu_dir .. "/x64/steamstub_x64.dll",
    emu_dir .. "/x86/version.dll",
    emu_dir .. "/x86/coldloader.dll",
    emu_dir .. "/x86/steamclient.dll",
    emu_dir .. "/x86/GameOverlayRenderer.dll",
    emu_dir .. "/x86/steamstub_x32.dll",
    emu_dir .. "/shared/overlay_achievement_notification.wav",
}

for _, p in ipairs(required) do
    mock_files[p] = true
end

local ready2, missing2 = emu_toolchain.toolchain_ready()
helper.eq(ready2, true, "toolchain_ready is true when all files exist")
helper.eq(#missing2, 0, "no missing files")

-- 3. Simulate Antivirus quarantine: Windows Defender deletes steamclient64.dll
mock_files[emu_dir .. "/x64/steamclient64.dll"] = nil
local ready3, missing3 = emu_toolchain.toolchain_ready()
helper.eq(ready3, false, "toolchain_ready is false after defender quarantine")
helper.eq(missing3[1], "x64/steamclient64.dll", "identifies quarantined DLL")

-- 4. Test dll path mapping
local paths_x64 = emu_toolchain.get_dll_paths("x64")
helper.eq(paths_x64.client, emu_dir .. "/x64/steamclient64.dll", "resolves x64 client dll")
local paths_x86 = emu_toolchain.get_dll_paths("x86")
helper.eq(paths_x86.client, emu_dir .. "/x86/steamclient.dll", "resolves x86 client dll")

helper.finish()
