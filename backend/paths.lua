local fs = require("fs")
local millennium = require("millennium")

local M = {}

local cached_lua_dir = nil
local cached_steam_dir = nil

--- Resolves the Steam config/stplug-in directory where lua scripts live.
function M.get_lua_dir()
    if cached_lua_dir and fs.exists(cached_lua_dir) then
        return cached_lua_dir
    end

    local ok, base = pcall(millennium.steam_path)
    if ok and base and base ~= "" then
        base = base:gsub("\\", "/")
        local dir = fs.join(base, "config", "stplug-in")
        if fs.exists(dir) then
            cached_lua_dir = dir
            return dir
        end

        local alt = base:match("Program Files %(x86%)") and base:gsub("Program Files %(x86%)", "Program Files")
                 or base:gsub("Program Files", "Program Files (x86)")
        local alt_dir = fs.join(alt, "config", "stplug-in")
        if fs.exists(alt_dir) then
            cached_lua_dir = alt_dir
            return alt_dir
        end
    end

    local fallback = "C:/Program Files (x86)/Steam/config/stplug-in"
    cached_lua_dir = fallback
    return fallback
end

--- Resolves the root Steam install directory (containing depotcache/).
function M.get_steam_root()
    if cached_steam_dir and fs.exists(cached_steam_dir) then
        return cached_steam_dir
    end

    local ok, base = pcall(millennium.steam_path)
    if ok and base and base ~= "" then
        base = base:gsub("\\", "/")
        if fs.exists(base) then
            cached_steam_dir = base
            return base
        end
    end

    local lua_dir = M.get_lua_dir()
    local parent = lua_dir:match("^(.-)/config/stplug%-in$")
    if parent and fs.exists(parent) then
        cached_steam_dir = parent
        return parent
    end

    cached_steam_dir = "C:/Program Files (x86)/Steam"
    return cached_steam_dir
end

return M
