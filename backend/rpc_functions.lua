local fs = require("fs")
local cjson = require("json")
local m_http = require("http")
local paths = require("paths")
local settings = require("settings")
local installer = require("installer")

--- Resolves standard arguments whether passed as table, json string, or multiple arguments.
local function extract_game_args(param1, param2)
    local app_id, title = nil, nil
    if type(param1) == "table" then
        app_id = param1.app_id or param1.appId or param1.appid
        title = param1.title or param1.name
    elseif type(param1) == "string" and param1:sub(1, 1) == "{" then
        local ok, parsed = pcall(cjson.decode, param1)
        if ok and type(parsed) == "table" then
            app_id = parsed.app_id or parsed.appId or parsed.appid
            title = parsed.title or parsed.name
        end
    else
        app_id = param1
        if type(param2) == "string" then title = param2 end
    end
    return app_id and tostring(app_id) or nil, title
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
    if not api_key or api_key == "" then
        return cjson.encode({ status = 400 })
    end

    local resp = m_http.get("https://hubcapmanifest.com/api/v1/user/stats", {
        headers = {
            ["Authorization"] = "Bearer " .. tostring(api_key),
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

    settings.save_settings(api_key, parsed)

    return cjson.encode({
        status = 200,
        username = parsed.username,
        daily_usage = parsed.daily_usage,
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
