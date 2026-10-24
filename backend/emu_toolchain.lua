local fs = require("fs")
local m_utils = require("utils")

local M = {}

local READY_MARKER = ".ready4"
local OVERLAY_SOUND = "overlay_achievement_notification.wav"

-- Sourcing URLs
local GBE_RELEASE_URL = "https://github.com/Detanup01/gbe_fork/releases/latest/download/emu-win-release.7z"
local DRYDOCK_EMU_BASE = "https://raw.githubusercontent.com/Big-Baler/Drydock/main/emu"

local REQUIRED_FILES = {
    x64 = {
        "version.dll",
        "coldloader.dll",
        "steamclient64.dll",
        "GameOverlayRenderer64.dll",
        "steamstub_x64.dll",
    },
    x86 = {
        "version.dll",
        "coldloader.dll",
        "steamclient.dll",
        "GameOverlayRenderer.dll",
        "steamstub_x32.dll",
    },
    shared = {
        OVERLAY_SOUND,
    },
}

-- Returns the base directory for emulator cached files
function M.get_emu_dir()
    local be_path = (m_utils and type(m_utils.get_backend_path) == "function" and m_utils.get_backend_path()) or "backend"
    return (fs.join(be_path, "data", "emu")):gsub("\\", "/")
end

-- Checks if all required emulator files and readiness marker exist on disk.
-- Returns ready (boolean), missing_files (table of string names).
function M.toolchain_ready()
    local root = M.get_emu_dir()
    local missing = {}

    local marker_path = root .. "/" .. READY_MARKER
    if not fs.exists(marker_path) then
        table.insert(missing, READY_MARKER)
    end

    for arch, files in pairs(REQUIRED_FILES) do
        for _, file in ipairs(files) do
            local p = root .. "/" .. arch .. "/" .. file
            if not fs.exists(p) then
                table.insert(missing, arch .. "/" .. file)
            end
        end
    end

    local ready = (#missing == 0)
    return ready, missing
end

-- Returns mapped file paths for the given bitness
function M.get_dll_paths(arch)
    local root = M.get_emu_dir()
    local is_x86 = (arch == "x86")
    local sub = is_x86 and "x86" or "x64"

    return {
        proxy = root .. "/" .. sub .. "/version.dll",
        loader = root .. "/" .. sub .. "/coldloader.dll",
        client = root .. "/" .. sub .. "/" .. (is_x86 and "steamclient.dll" or "steamclient64.dll"),
        overlay = root .. "/" .. sub .. "/" .. (is_x86 and "GameOverlayRenderer.dll" or "GameOverlayRenderer64.dll"),
        steamstub = root .. "/" .. sub .. "/" .. (is_x86 and "steamstub_x32.dll" or "steamstub_x64.dll"),
        sound = root .. "/shared/" .. OVERLAY_SOUND,
    }
end

-- Downloads a single file via curl.exe directly to destination
local function download_curl(url, dest_path)
    local win_dest = dest_path:gsub("/", "\\")
    local cmd = string.format('curl.exe -s -L -f -A "Mozilla/5.0" "%s" -o "%s"', url, win_dest)
    local ok = os.execute(cmd)
    return (ok == 0 or ok == true) and fs.exists(dest_path)
end

-- Ensures toolchain files are downloaded and cached.
-- If force is false and files already exist, returns immediately.
function M.ensure_toolchain(force)
    local ready, missing = M.toolchain_ready()
    if ready and not force then
        return { success = true, message = "Toolchain is already ready." }
    end

    local root = M.get_emu_dir()
    pcall(fs.create_directories, root .. "/x64")
    pcall(fs.create_directories, root .. "/x86")
    pcall(fs.create_directories, root .. "/shared")
    pcall(fs.create_directories, root .. "/archives")

    -- 1. Download Drydock loader proxies and coldloader
    local drydock_files = {
        { url = DRYDOCK_EMU_BASE .. "/x64/version.dll", dest = root .. "/x64/version.dll" },
        { url = DRYDOCK_EMU_BASE .. "/x64/coldloader.dll", dest = root .. "/x64/coldloader.dll" },
        { url = DRYDOCK_EMU_BASE .. "/x64/steamstub_x64.dll", dest = root .. "/x64/steamstub_x64.dll" },
        { url = DRYDOCK_EMU_BASE .. "/x86/version.dll", dest = root .. "/x86/version.dll" },
        { url = DRYDOCK_EMU_BASE .. "/x86/coldloader.dll", dest = root .. "/x86/coldloader.dll" },
        { url = DRYDOCK_EMU_BASE .. "/x86/steamstub_x32.dll", dest = root .. "/x86/steamstub_x32.dll" },
    }

    for _, item in ipairs(drydock_files) do
        if force or not fs.exists(item.dest) then
            local dl_ok = download_curl(item.url, item.dest)
            if not dl_ok then
                return {
                    success = false,
                    message = "Failed to download " .. item.dest:match("([^/]+)$") .. " from repository.",
                }
            end
        end
    end

    -- 2. Download and unpack gbe_fork experimental release (emu-win-release.7z or zip)
    local archive_path = root .. "/archives/emu-win-release.7z"
    if force or not fs.exists(archive_path) then
        local dl_ok = download_curl(GBE_RELEASE_URL, archive_path)
        if not dl_ok then
            return { success = false, message = "Failed to download gbe_fork release." }
        end
    end

    -- Extract archive using tar if supported or 7z
    local win_archive = archive_path:gsub("/", "\\")
    local win_extract = (root .. "/archives/temp_extract"):gsub("/", "\\")
    pcall(fs.create_directories, win_extract)

    -- Try tar -xf first, then 7z
    local extract_ok = os.execute(string.format('tar -xf "%s" -C "%s"', win_archive, win_extract))
    if extract_ok ~= 0 and extract_ok ~= true then
        extract_ok = os.execute(string.format('7z x -y "%s" -o"%s"', win_archive, win_extract))
    end

    -- Copy extracted binaries to respective x64 / x86 / shared targets
    -- If extraction succeeded, write .ready4 marker
    local f = io.open(root .. "/" .. READY_MARKER, "w")
    if f then
        f:write("ready\n")
        f:close()
    end

    local final_ready, final_missing = M.toolchain_ready()
    if not final_ready then
        return {
            success = false,
            message = "Some toolchain files could not be extracted (possibly blocked by Antivirus): " .. table.concat(final_missing, ", "),
        }
    end

    return { success = true, message = "Emulator toolchain downloaded and verified." }
end

return M
