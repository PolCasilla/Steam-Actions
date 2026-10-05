local fs = require("fs")
local m_utils = require("utils")
local paths = require("paths")
local settings = require("settings")

local M = {}

--- Downloads binary file via curl.exe directly to disk.
local function download_file(url, dest_path, api_key)
    local win_dest = dest_path:gsub("/", "\\")
    local cmd = string.format(
        'curl.exe -s -L -w "%%{http_code}" -H "Authorization: Bearer %s" -H "Accept: application/zip" -A "Mozilla/5.0" "%s" -o "%s"',
        api_key, url, win_dest
    )
    local handle = io.popen(cmd)
    if not handle then return false, 0, "Failed to execute curl." end
    local output = handle:read("*a")
    handle:close()

    local http_code = tonumber(output:match("(%d%d%d)")) or 0
    if http_code ~= 200 then
        local err_text = fs.exists(dest_path) and (m_utils.read_file(dest_path) or "") or ""
        return false, http_code, string.format("Server returned HTTP %d: %s", http_code, err_text ~= "" and err_text or "Download failed")
    end

    if not fs.exists(dest_path) then
        return false, 0, "Downloaded file does not exist on disk."
    end

    -- Validate zip signature (magic bytes)
    local f = io.open(dest_path, "rb")
    if f then
        local magic = f:read(4)
        f:close()
        if magic ~= "PK\3\4" and magic ~= "PK\5\6" and magic ~= "PK\7\8" then
            return false, 422, "Downloaded file is not a valid zip archive."
        end
    end

    return true, 200, "OK"
end

--- Extracts zip archive using Windows native tar.
local function extract_zip(zip_path, dest_dir)
    if not fs.exists(dest_dir) then pcall(fs.create_directories, dest_dir) end
    local win_zip = zip_path:gsub("/", "\\")
    local win_dest = dest_dir:gsub("/", "\\")
    local ok = os.execute(string.format('tar -xf "%s" -C "%s"', win_zip, win_dest))
    return ok == 0 or ok == true
end

--- Adds a game package (.manifest + .lua) into Steam.
function M.add_to_library(app_id, title)
    app_id = tostring(app_id)
    title = title or ("App " .. app_id)

    local api_key = settings.get_active_api_key()
    if not api_key then
        return { success = false, status = 401, message = "No valid API key found. Please save your API key in Settings first." }
    end

    local be_path = (m_utils and type(m_utils.get_backend_path) == "function" and m_utils.get_backend_path()) or "backend"
    local download_dir = fs.join(be_path, "data", "downloads")
    if not fs.exists(download_dir) then pcall(fs.create_directories, download_dir) end

    local zip_path = fs.join(download_dir, app_id .. ".zip")
    local url = string.format("https://hubcapmanifest.com/api/v1/manifest/%s", app_id)

    local dl_ok, dl_status, dl_msg = download_file(url, zip_path, api_key)
    if not dl_ok then
        return { success = false, status = dl_status, message = dl_msg }
    end

    local temp_extract_dir = fs.join(be_path, "data", "temp", "extracted_" .. app_id)
    if fs.exists(temp_extract_dir) then pcall(fs.remove_all, temp_extract_dir) end
    pcall(fs.create_directories, temp_extract_dir)

    if not extract_zip(zip_path, temp_extract_dir) then
        pcall(fs.remove_all, temp_extract_dir)
        return { success = false, status = 500, message = "Failed to extract downloaded zip archive." }
    end

    -- Collect manifest and lua files
    local manifest_files = {}
    local lua_files = {}
    local ok_list, entries = pcall(fs.list_recursive, temp_extract_dir)

    if ok_list and entries then
        for _, entry in ipairs(entries) do
            if not entry.is_directory then
                local fname = entry.name or entry.path:match("([^/\\]+)$") or entry.path
                local lower = fname:lower()
                if lower:match("%.manifest$") then
                    table.insert(manifest_files, { name = fname, path = entry.path })
                elseif lower:match("%.lua$") then
                    table.insert(lua_files, { name = fname, path = entry.path })
                end
            end
        end
    end

    if #manifest_files == 0 or #lua_files == 0 then
        return {
            success = false,
            status = 422,
            message = "Validation failed: Zip file must contain both .manifest and .lua files.",
        }
    end

    -- Place files into Steam folders
    local depotcache_dir = fs.join(paths.get_steam_root(), "depotcache")
    local stplugin_dir = paths.get_lua_dir()
    if not fs.exists(depotcache_dir) then pcall(fs.create_directories, depotcache_dir) end
    if not fs.exists(stplugin_dir) then pcall(fs.create_directories, stplugin_dir) end

    for _, f in ipairs(manifest_files) do
        local target = fs.join(depotcache_dir, f.name)
        if not pcall(fs.copy, f.path, target) then
            local data = m_utils.read_file(f.path)
            if data then m_utils.write_file(target, data) end
        end
    end

    for _, f in ipairs(lua_files) do
        local target = fs.join(stplugin_dir, f.name)
        if not pcall(fs.copy, f.path, target) then
            local data = m_utils.read_file(f.path)
            if data then m_utils.write_file(target, data) end
        end
    end

    -- Cleanup
    pcall(fs.remove_all, temp_extract_dir)
    pcall(fs.remove, zip_path)

    return {
        success = true,
        status = 200,
        app_id = app_id,
        title = title,
        manifest_count = #manifest_files,
        lua_count = #lua_files,
        message = string.format("%s was successfully added to your library.", title)
    }
end

--- Removes a game script from Steam config/stplug-in/
function M.remove_from_library(app_id, title)
    app_id = tostring(app_id)
    title = title or ("App " .. app_id)

    local lua_dir = paths.get_lua_dir()
    local standard = fs.join(lua_dir, app_id .. ".lua")
    local disabled = fs.join(lua_dir, app_id .. ".lua.disabled")
    local removed_any = false

    if fs.exists(standard) and pcall(fs.remove, standard) then removed_any = true end
    if fs.exists(disabled) and pcall(fs.remove, disabled) then removed_any = true end

    if removed_any then
        return {
            success = true,
            status = 200,
            app_id = app_id,
            title = title,
            message = string.format("%s was successfully removed from your library.", title)
        }
    end

    return {
        success = false,
        status = 404,
        message = string.format("No library script found for %s (%s).", title, app_id)
    }
end

return M
