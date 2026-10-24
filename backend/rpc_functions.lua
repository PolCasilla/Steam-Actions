local fs = require("fs")
local cjson = require("json")
local m_http = require("http")
local paths = require("paths")
local settings = require("settings")
local installer = require("installer")
local steam_status = require("steam_status")
local game_exe = require("game_exe")
local emu_toolchain = require("emu_toolchain")
local emu_deploy = require("emu_deploy")

local function extract_game_args(param1, param2)
    local is_tbl = type(param1) == "table"
    local aid = is_tbl and (param1.app_id or param1.appId or param1.appid) or param1
    local title = is_tbl and (param1.title or param1.name) or param2
    return aid and tostring(aid) or nil, type(title) == "string" and title or nil
end

---@ffi
--- Returns list of game app IDs with installed lua scripts.
---@return string[]
function getInstalledAppIds()
    local appIds = {}
    local ok, files = pcall(fs.list, paths.get_lua_dir())
    if ok and files then
        for _, entry in ipairs(files) do
            local aid = (entry.name or ""):match("^(%d+)%.lua")
            if aid then table.insert(appIds, aid) end
        end
    end
    return appIds
end

---@ffi
--- Checks if a specific game script exists.
---@param appid string
---@return boolean
function hasGameLua(appid)
    if not appid or appid == "" then return false end
    local dir = paths.get_lua_dir()
    return fs.exists(fs.join(dir, appid .. ".lua")) or fs.exists(fs.join(dir, appid .. ".lua.disabled"))
end

---@ffi
--- Validates API key and saves user stats upon success.
---@param api_key string
---@return string
function validateApiKey(api_key)
    local target_key = api_key
    if not target_key or target_key == "" then
        target_key = settings.get_active_api_key()
    end

    if not target_key or target_key == "" then
        return cjson.encode({ status = 400 })
    end

    local resp = m_http.get("https://hubcapmanifest.com/api/v1/user/stats", {
        headers = {
            ["Authorization"] = "Bearer " .. tostring(target_key),
            ["Accept"] = "application/json",
        },
        timeout = 15,
    })

    local status = (resp and tonumber(resp.status)) or 0
    if status ~= 200 then
        return cjson.encode({ status = status })
    end

    local parsed = {}
    if resp.body and resp.body ~= "" then
        local ok, dec = pcall(cjson.decode, resp.body)
        if ok and type(dec) == "table" then parsed = dec end
    end

    settings.save_settings(target_key, parsed)

    return cjson.encode({
        status = 200,
        username = parsed.username,
        daily_usage = parsed.daily_usage,
        daily_limit = parsed.daily_limit,
        api_key_expires_at = parsed.api_key_expires_at,
    })
end

---@ffi
--- Gets saved settings with masked key.
---@return string
function getSettings()
    return cjson.encode(settings.get_settings())
end

---@ffi
--- Clears saved settings.
---@return string
function clearSettings()
    settings.clear_settings()
    return cjson.encode({ success = true })
end

---@ffi
--- Downloads and adds game package to library.
---@param param1 any
---@param param2 any
---@return string
function addToLibrary(param1, param2)
    local app_id, title = extract_game_args(param1, param2)
    if not app_id then
        return cjson.encode({ success = false, status = 400, message = "Missing App ID." })
    end
    return cjson.encode(installer.add_to_library(app_id, title))
end

---@ffi
--- Removes game script from library.
---@param param1 any
---@param param2 any
---@return string
function removeFromLibrary(param1, param2)
    local app_id, title = extract_game_args(param1, param2)
    if not app_id then
        return cjson.encode({ success = false, status = 400, message = "Missing App ID." })
    end
    return cjson.encode(installer.remove_from_library(app_id, title))
end

---@ffi
--- Returns unified Steam install, update-pending, and offline emulator crack status for a game.
---@param appid string
---@return string
function getGameStatus(appid)
    local ok, status = pcall(steam_status.get_status, appid)
    if not ok then
        return cjson.encode({ ok = false, error = tostring(status) })
    end

    local emu_info = {
        toolchain_ready = false,
        missing_dlls = {},
        is_cracked = false,
        needs_recrack = false,
        has_backup = false,
        crack_buildid = nil,
        exe_path = nil,
        exe_name = nil,
        rel_dir = nil,
        arch = nil,
        is_unreal = false,
        steam_api_path = nil,
        steam_api_exists = false,
        steam_api_is_emu = false,
    }

    local tc_ok, tc_ready, missing = pcall(emu_toolchain.toolchain_ready)
    if tc_ok then
        emu_info.toolchain_ready = tc_ready
        emu_info.missing_dlls = missing or {}
    end

    if status.ok and status.installed and status.install_path then
        local exe_ok, exe_data = pcall(game_exe.find_game_exe, status.install_path)
        if exe_ok and exe_data then
            emu_info.exe_path = exe_data.exe_path
            emu_info.exe_name = exe_data.exe_name
            emu_info.rel_dir = exe_data.rel_dir
            emu_info.arch = exe_data.arch
            emu_info.is_unreal = exe_data.is_unreal

            local target_dir = exe_data.rel_dir ~= ""
                and (status.install_path .. "/" .. exe_data.rel_dir)
                or status.install_path

            local cs_ok, crack_data = pcall(game_exe.check_crack_status, target_dir)
            if cs_ok and crack_data then
                emu_info.is_cracked = crack_data.is_cracked
                emu_info.crack_buildid = crack_data.crack_buildid
                emu_info.has_backup = crack_data.has_backup
                if crack_data.is_cracked and crack_data.crack_buildid and status.buildid then
                    if crack_data.crack_buildid ~= status.buildid then
                        emu_info.needs_recrack = true
                    end
                end
            end

            local api_ok, api_data = pcall(game_exe.find_steam_api, status.install_path, exe_data.rel_dir, exe_data.arch)
            if api_ok and api_data then
                emu_info.steam_api_path = api_data.path
                emu_info.steam_api_exists = api_data.exists
                emu_info.steam_api_is_emu = api_data.is_emulator
            end
        end
    end

    status.emu = emu_info
    return cjson.encode(status)
end

---@ffi
--- Deploys offline emulator crack into target game directory.
---@param param1 any
---@param param2 any
---@return string
function deployEmulator(param1, param2)
    local app_id = extract_game_args(param1, param2)
    if not app_id then
        return cjson.encode({ success = false, message = "Missing App ID." })
    end
    local ok, res = pcall(emu_deploy.deploy, app_id)
    if not ok then
        return cjson.encode({ success = false, message = tostring(res) })
    end
    return cjson.encode(res)
end

---@ffi
--- Restores original game files from .bak and removes emulator configuration.
---@param param1 any
---@param param2 any
---@return string
function restoreOriginal(param1, param2)
    local app_id = extract_game_args(param1, param2)
    if not app_id then
        return cjson.encode({ success = false, message = "Missing App ID." })
    end
    local ok, res = pcall(emu_deploy.restore_original, app_id)
    if not ok then
        return cjson.encode({ success = false, message = tostring(res) })
    end
    return cjson.encode(res)
end

---@ffi
--- Exports standalone offline crack files to a ZIP archive.
---@param param1 any
---@param dest_path any
---@return string
function exportEmulatorZip(param1, dest_path)
    local app_id = extract_game_args(param1)
    if not app_id then
        return cjson.encode({ success = false, message = "Missing App ID." })
    end
    local ok, res = pcall(emu_deploy.export_zip, app_id, dest_path)
    if not ok then
        return cjson.encode({ success = false, message = tostring(res) })
    end
    return cjson.encode(res)
end

---@ffi
--- Downloads and caches the required emulator toolchain files.
---@return string
function downloadEmulatorToolchain()
    local ok, res = pcall(emu_toolchain.ensure_toolchain, true)
    if not ok then
        return cjson.encode({ success = false, message = tostring(res) })
    end
    return cjson.encode(res)
end
