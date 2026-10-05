local fs = require("fs")
local cjson = require("json")
local m_utils = require("utils")

local M = {}

local function get_settings_file()
    local be_path = (m_utils and type(m_utils.get_backend_path) == "function" and m_utils.get_backend_path()) or "backend"
    local data_dir = fs.join(be_path, "data")
    if not fs.exists(data_dir) then
        pcall(fs.create_directories, data_dir)
    end
    return fs.join(data_dir, "settings.json")
end

local function parse_expiration(val)
    if not val then return nil end
    local num = tonumber(val)
    if num then
        return (num > 100000000000) and math.floor(num / 1000) or num
    end
    if type(val) == "string" then
        local Y, M, D, h, m, s = val:match("(%d+)-(%d+)-(%d+)[T ](%d+):(%d+):(%d+)")
        if Y then
            return os.time({ year = tonumber(Y), month = tonumber(M), day = tonumber(D), hour = tonumber(h), min = tonumber(m), sec = tonumber(s) })
        end
    end
    return nil
end

function M.get_active_api_key()
    local path = get_settings_file()
    if not fs.exists(path) then return nil end
    local content = m_utils.read_file(path)
    if not content or content == "" then return nil end

    local ok, data = pcall(cjson.decode, content)
    if not ok or type(data) ~= "table" or not data.api_key or data.api_key == "" then
        return nil
    end

    local expires_epoch = tonumber(data.expires_at_epoch) or parse_expiration(data.api_key_expires_at)
    if expires_epoch and os.time() >= expires_epoch then
        pcall(fs.remove, path)
        return nil
    end

    return tostring(data.api_key)
end

function M.get_settings()
    local path = get_settings_file()
    if not fs.exists(path) then
        return { has_key = false }
    end

    local content = m_utils.read_file(path)
    if not content or content == "" then
        return { has_key = false }
    end

    local ok, data = pcall(cjson.decode, content)
    if not ok or type(data) ~= "table" or not data.api_key or data.api_key == "" then
        return { has_key = false }
    end

    local expires_epoch = tonumber(data.expires_at_epoch) or parse_expiration(data.api_key_expires_at)
    if expires_epoch and os.time() >= expires_epoch then
        pcall(fs.remove, path)
        return { has_key = false, expired = true }
    end

    local key = tostring(data.api_key)
    local masked = #key > 4 and (string.rep("•", #key - 4) .. key:sub(-4)) or string.rep("•", #key)

    return {
        has_key = true,
        masked_key = masked,
        username = data.username,
        daily_usage = data.daily_usage,
        api_key_expires_at = data.api_key_expires_at,
    }
end

function M.save_settings(api_key, stats)
    local path = get_settings_file()
    local settings_data = {
        api_key = tostring(api_key),
        username = stats.username,
        daily_usage = stats.daily_usage,
        api_key_expires_at = stats.api_key_expires_at,
        expires_at_epoch = parse_expiration(stats.api_key_expires_at),
        saved_at = os.time(),
    }
    m_utils.write_file(path, cjson.encode(settings_data))
end

function M.clear_settings()
    local path = get_settings_file()
    if fs.exists(path) then
        pcall(fs.remove, path)
    end
    return true
end

return M
