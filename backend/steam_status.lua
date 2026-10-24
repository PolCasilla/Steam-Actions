-- Reads Steam appmanifest .acf files to determine install and update status.
-- Uses paths.get_steam_root() for the primary library and reads libraryfolders.vdf
-- for any additional libraries the user may have set up.
local vdf = require("vdf")
local paths = require("paths")
local m_utils = require("utils")

local M = {}

-- StateFlags bit meanings (from observed Steam manifests, not official Valve docs).
local FLAG_UPDATE_REQUIRED = 2
local FLAG_FULLY_INSTALLED  = 4

local function has_flag(flags, flag)
    return math.floor(flags / flag) % 2 == 1
end

local function normalize(path)
    return (path:gsub("\\", "/"):gsub("/+$", ""))
end

-- Returns every Steam library root: the main folder first, then any extras
-- listed in steamapps/libraryfolders.vdf. Deduplicates case-insensitively.
local function library_folders()
    local main = normalize(paths.get_steam_root())
    local folders = { main }
    local seen = { [main:lower()] = true }

    local text = m_utils.read_file(main .. "/steamapps/libraryfolders.vdf")
    if text then
        local ok, parsed = pcall(vdf.parse, text)
        if ok and type(parsed.libraryfolders) == "table" then
            -- Collect numeric keys in order so we visit libraries in user-defined order.
            local keys = {}
            for k, entry in pairs(parsed.libraryfolders) do
                if type(entry) == "table" and entry.path then
                    keys[#keys + 1] = k
                end
            end
            table.sort(keys, function(a, b) return (tonumber(a) or 0) < (tonumber(b) or 0) end)
            for _, k in ipairs(keys) do
                local p = normalize(parsed.libraryfolders[k].path)
                if not seen[p:lower()] then
                    seen[p:lower()] = true
                    folders[#folders + 1] = p
                end
            end
        end
    end

    return folders
end

-- Returns { ok, appid, installed, update_pending, name?, buildid, target_buildid?, last_updated, state_flags, installdir?, install_path? }
-- or { ok = false, error = "..." } on a bad appid.
-- When no manifest is found: installed = false, update_pending = false.
function M.get_status(appid)
    appid = tostring(appid)
    if not appid:match("^%d+$") then
        return { ok = false, error = "invalid appid" }
    end

    for _, folder in ipairs(library_folders()) do
        local path = folder .. "/steamapps/appmanifest_" .. appid .. ".acf"
        local text = m_utils.read_file(path)
        if text then
            local ok, parsed = pcall(vdf.parse, text)
            if ok and type(parsed.appstate) == "table" then
                local s = parsed.appstate
                local flags  = tonumber(s.stateflags)   or 0
                local buildid = tonumber(s.buildid)      or 0
                local target  = tonumber(s.targetbuildid) or 0
                local installdir = s.installdir
                local install_path = nil
                if installdir and installdir ~= "" then
                    install_path = normalize(folder .. "/steamapps/common/" .. installdir)
                end
                return {
                    ok            = true,
                    appid         = appid,
                    name          = s.name,
                    installed     = has_flag(flags, FLAG_FULLY_INSTALLED),
                    update_pending = has_flag(flags, FLAG_UPDATE_REQUIRED)
                                    or (target ~= 0 and target ~= buildid),
                    buildid       = buildid,
                    target_buildid = target ~= 0 and target or nil,
                    last_updated  = tonumber(s.lastupdated) or 0,
                    state_flags   = flags,
                    installdir    = installdir,
                    install_path  = install_path,
                }
            end
        end
    end

    return { ok = true, appid = appid, installed = false, update_pending = false }
end

return M
