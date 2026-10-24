local fs = require("fs")

local M = {}

local BLACKLIST_PATTERNS = {
    "crashreport",
    "crash_report",
    "cefsubprocess",
    "unins",
    "setup",
    "redist",
    "vcredist",
    "dxsetup",
    "dotnet",
    "easyanticheat",
    "battleye",
    "unitycrashhandler",
    "error_report",
    "feedback",
}

function M.is_blacklisted(filename)
    local lower = (filename or ""):lower()
    for _, pattern in ipairs(BLACKLIST_PATTERNS) do
        if lower:find(pattern) then
            return true
        end
    end
    return false
end

-- Inspects DOS/PE binary headers from a byte string.
-- Returns "x64", "x86", or nil.
function M.detect_pe_arch(bytes)
    if not bytes or #bytes < 64 then return nil end
    if bytes:sub(1, 2) ~= "MZ" then return nil end

    -- PE header offset at 0x3C (1-based: bytes 61..64)
    local b1 = bytes:byte(61)
    local b2 = bytes:byte(62)
    local b3 = bytes:byte(63)
    local b4 = bytes:byte(64)
    if not b1 or not b2 or not b3 or not b4 then return nil end

    local pe_offset = b1 + b2 * 256 + b3 * 65536 + b4 * 16777216
    if #bytes < pe_offset + 6 then return nil end

    -- PE\0\0 signature
    if bytes:sub(pe_offset + 1, pe_offset + 4) ~= "PE\0\0" then return nil end

    -- Machine type at pe_offset + 4 (bytes pe_offset + 5 and + 6)
    local m1 = bytes:byte(pe_offset + 5)
    local m2 = bytes:byte(pe_offset + 6)
    if not m1 or not m2 then return nil end

    local machine = m1 + m2 * 256
    if machine == 0x8664 then -- 34404 (AMD64 / x64)
        return "x64"
    elseif machine == 0x014C then -- 332 (i386 / x86)
        return "x86"
    end

    return nil
end

-- Helper to pick the best executable candidate from a list of files
function M.select_best_exe(file_entries)
    local candidates = {}

    for _, entry in ipairs(file_entries) do
        local rel = entry.rel or entry.path or ""
        local name = rel:match("([^/\\]+)$") or rel
        if name:lower():match("%.exe$") and not M.is_blacklisted(name) then
            local is_unreal = false
            local lower_rel = rel:lower():gsub("\\", "/")
            if (lower_rel:find("binaries/win64/") or lower_rel:find("binaries/win32/"))
               and lower_rel:find("-shipping%.exe$") then
                is_unreal = true
            end

            table.insert(candidates, {
                path = entry.path,
                rel = rel:gsub("\\", "/"),
                name = name,
                is_unreal = is_unreal,
                depth = select(2, lower_rel:gsub("/", "/")),
            })
        end
    end

    if #candidates == 0 then return nil end

    -- Sort candidates: Unreal Shipping first, then shortest path depth, then name
    table.sort(candidates, function(a, b)
        if a.is_unreal ~= b.is_unreal then
            return a.is_unreal
        end
        if a.depth ~= b.depth then
            return a.depth < b.depth
        end
        return a.name < b.name
    end)

    return candidates[1]
end

local function scan_dir_recursive(root_path, current_rel, depth_limit, results)
    if depth_limit < 0 then return end
    local current_full = current_rel ~= "" and (root_path .. "/" .. current_rel) or root_path

    local ok, list = pcall(fs.list, current_full)
    if not ok or not list then return end

    for _, item in ipairs(list) do
        local name = item.name or ""
        local rel = current_rel ~= "" and (current_rel .. "/" .. name) or name
        local full = root_path .. "/" .. rel

        if item.is_dir then
            scan_dir_recursive(root_path, rel, depth_limit - 1, results)
        else
            table.insert(results, {
                path = full,
                rel = rel,
                name = name,
            })
        end
    end
end

-- Finds the primary game executable under install_path.
-- Returns { exe_path, exe_name, rel_dir, arch, is_unreal } or nil.
function M.find_game_exe(install_path)
    if not install_path or not fs.exists(install_path) then return nil end

    local files = {}
    scan_dir_recursive(install_path, "", 6, files)

    local best = M.select_best_exe(files)
    if not best then return nil end

    -- Read binary header to determine architecture
    local arch = "x64" -- sensible default
    local f = io.open(best.path, "rb")
    if f then
        local header = f:read(1024)
        f:close()
        local detected = M.detect_pe_arch(header)
        if detected then arch = detected end
    end

    local rel_dir = best.rel:match("^(.-)/[^/]+$") or ""

    return {
        exe_path = best.path,
        exe_name = best.name,
        rel_dir = rel_dir,
        arch = arch,
        is_unreal = best.is_unreal,
    }
end

-- Checks for steam_api(64).dll in the executable directory.
function M.find_steam_api(install_path, rel_dir, arch)
    local target_dir = rel_dir and rel_dir ~= "" and (install_path .. "/" .. rel_dir) or install_path
    local expected_dll = (arch == "x86") and "steam_api.dll" or "steam_api64.dll"
    local full_path = target_dir .. "/" .. expected_dll
    local backup_path = full_path .. ".bak"

    local exists = fs.exists(full_path)
    local has_backup = fs.exists(backup_path)

    local is_emulator = false
    if exists then
        local f = io.open(full_path, "rb")
        if f then
            local sample = f:read(8192) or ""
            f:close()
            if sample:find("steam_settings") or sample:find("configs.user.ini") or sample:find("coldloader") then
                is_emulator = true
            end
        end
    end

    return {
        path = full_path,
        filename = expected_dll,
        exists = exists,
        is_emulator = is_emulator,
        has_backup = has_backup,
    }
end

-- Checks if a target directory currently has emulator crack files installed.
function M.check_crack_status(target_dir)
    if not target_dir or not fs.exists(target_dir) then
        return { is_cracked = false, crack_buildid = nil, has_backup = false }
    end

    local has_coldloader = fs.exists(target_dir .. "/coldloader.ini")
    local has_settings = fs.exists(target_dir .. "/steam_settings")
    local has_version = fs.exists(target_dir .. "/version.dll")
    local has_backup = fs.exists(target_dir .. "/steam_api64.dll.bak") or fs.exists(target_dir .. "/steam_api.dll.bak")

    local is_cracked = has_coldloader or has_settings or has_version

    local crack_buildid = nil
    local buildid_path = target_dir .. "/steam_settings/crack_buildid.txt"
    if fs.exists(buildid_path) then
        local f = io.open(buildid_path, "r")
        if f then
            local content = f:read("*a") or ""
            f:close()
            crack_buildid = tonumber(content:match("%d+"))
        end
    end

    return {
        is_cracked = is_cracked,
        crack_buildid = crack_buildid,
        has_backup = has_backup,
    }
end

return M
