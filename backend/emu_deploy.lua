local fs = require("fs")
local paths = require("paths")
local m_utils = require("utils")
local steam_status = require("steam_status")
local game_exe = require("game_exe")
local steam_interfaces = require("steam_interfaces")
local emu_toolchain = require("emu_toolchain")

local M = {}

-- Generates map of relative path -> string contents for all configuration files
function M.generate_configs(app_id, options)
    options = options or {}
    local player_name = options.player_name or "Player"
    local language = options.language or "english"
    local buildid = options.buildid or 0

    local configs = {}

    -- coldloader.ini
    configs["coldloader.ini"] = string.format("[settings]\nappid = %s\ncleanup_delay = 70\n", tostring(app_id))

    -- steam_settings/steam_appid.txt
    configs["steam_settings/steam_appid.txt"] = string.format("%s\n", tostring(app_id))

    -- steam_settings/configs.app.ini
    configs["steam_settings/configs.app.ini"] = "[app::dlcs]\nunlock_all = 0\n"

    -- steam_settings/depots.txt
    configs["steam_settings/depots.txt"] = ""

    -- steam_settings/supported_languages.txt
    configs["steam_settings/supported_languages.txt"] = string.format("%s\n", language)

    -- steam_settings/configs.user.ini
    configs["steam_settings/configs.user.ini"] = string.format(
        "[user::general]\naccount_name=%s\nlanguage=%s\n",
        player_name, language
    )

    -- steam_settings/configs.overlay.ini
    configs["steam_settings/configs.overlay.ini"] = "[overlay::general]\nenable_experimental_overlay = 0\n"

    -- steam_settings/configs.main.ini
    configs["steam_settings/configs.main.ini"] = "[main::connectivity]\ndisable_lan_only=1\n"

    -- steam_settings/crack_buildid.txt
    if buildid and tonumber(buildid) and tonumber(buildid) > 0 then
        configs["steam_settings/crack_buildid.txt"] = string.format("%d\n", tonumber(buildid))
    end

    return configs
end

local function copy_file_binary(src, dest)
    local win_src = src:gsub("/", "\\")
    local win_dest = dest:gsub("/", "\\")
    local ok = os.execute(string.format('copy /y "%s" "%s" >nul 2>&1', win_src, win_dest))
    return ok == 0 or ok == true
end

-- Deploys the complete offline emulator crack into the game directory
function M.deploy(appid, options)
    options = options or {}
    local status = steam_status.get_status(appid)
    if not status.ok or not status.installed or not status.install_path then
        return { success = false, message = "Game is not installed on disk." }
    end

    local exe_info = game_exe.find_game_exe(status.install_path)
    if not exe_info then
        return { success = false, message = "Could not locate the game executable in " .. status.install_path }
    end

    local target_dir = exe_info.rel_dir ~= ""
        and (status.install_path .. "/" .. exe_info.rel_dir)
        or status.install_path

    -- Verify toolchain is cached
    local ready, missing = emu_toolchain.toolchain_ready()
    if not ready then
        local dl = emu_toolchain.ensure_toolchain(false)
        if not dl.success then
            return { success = false, message = dl.message }
        end
    end

    local dll_paths = emu_toolchain.get_dll_paths(exe_info.arch)
    local api_info = game_exe.find_steam_api(status.install_path, exe_info.rel_dir, exe_info.arch)

    -- Generate steam_interfaces.txt from genuine steam_api if present
    local interfaces_txt = nil
    if api_info and api_info.exists and not api_info.is_emulator then
        local f = io.open(api_info.path, "rb")
        if f then
            local bytes = f:read("*a")
            f:close()
            interfaces_txt = steam_interfaces.generate_txt(bytes)
        end
    end

    -- Create .bak backups of any existing DLLs before overwrite
    local files_to_deploy = {
        { src = dll_paths.proxy, dest = target_dir .. "/version.dll" },
        { src = dll_paths.loader, dest = target_dir .. "/coldloader.dll" },
        { src = dll_paths.client, dest = target_dir .. "/" .. (exe_info.arch == "x86" and "steamclient.dll" or "steamclient64.dll") },
    }

    local deployed = {}
    for _, item in ipairs(files_to_deploy) do
        if fs.exists(item.dest) and not fs.exists(item.dest .. ".bak") then
            pcall(copy_file_binary, item.dest, item.dest .. ".bak")
        end
        copy_file_binary(item.src, item.dest)
        table.insert(deployed, item.dest:match("([^/]+)$"))
    end

    -- Write steam_interfaces.txt
    if interfaces_txt and interfaces_txt ~= "" then
        local if_path = target_dir .. "/steam_interfaces.txt"
        local f = io.open(if_path, "w")
        if f then
            f:write(interfaces_txt)
            f:close()
            table.insert(deployed, "steam_interfaces.txt")
        end
    end

    -- Write configuration files
    local configs = M.generate_configs(appid, {
        buildid = status.buildid,
        player_name = options.player_name,
        language = options.language,
    })

    pcall(fs.create_directories, target_dir .. "/steam_settings")
    for rel_path, content in pairs(configs) do
        local full_path = target_dir .. "/" .. rel_path
        local f = io.open(full_path, "w")
        if f then
            f:write(content)
            f:close()
            table.insert(deployed, rel_path)
        end
    end

    -- Deploy steamstub loader dll under steam_settings/load_dlls/
    if fs.exists(dll_paths.steamstub) then
        pcall(fs.create_directories, target_dir .. "/steam_settings/load_dlls")
        local stub_name = (exe_info.arch == "x86") and "steamstub_x32.dll" or "steamstub_x64.dll"
        copy_file_binary(dll_paths.steamstub, target_dir .. "/steam_settings/load_dlls/" .. stub_name)
    end

    -- Deploy achievement audio notification under steam_settings/sounds/
    if fs.exists(dll_paths.sound) then
        pcall(fs.create_directories, target_dir .. "/steam_settings/sounds")
        copy_file_binary(dll_paths.sound, target_dir .. "/steam_settings/sounds/overlay_achievement_notification.wav")
    end

    return {
        success = true,
        message = "Offline emulator crack deployed successfully.",
        deployed_files = deployed,
        target_dir = target_dir,
        exe_name = exe_info.exe_name,
        arch = exe_info.arch,
    }
end

-- Restores original files from .bak and removes emulator configuration
function M.restore_original(appid)
    local status = steam_status.get_status(appid)
    if not status.ok or not status.install_path then
        return { success = false, message = "Game install directory not found." }
    end

    local exe_info = game_exe.find_game_exe(status.install_path)
    if not exe_info then
        return { success = false, message = "Game executable not found." }
    end

    local target_dir = exe_info.rel_dir ~= ""
        and (status.install_path .. "/" .. exe_info.rel_dir)
        or status.install_path

    local restored = {}

    -- Restore .bak files if present
    local candidates = {
        "steam_api64.dll",
        "steam_api.dll",
        "version.dll",
        "winmm.dll",
    }

    for _, name in ipairs(candidates) do
        local bak = target_dir .. "/" .. name .. ".bak"
        local orig = target_dir .. "/" .. name
        if fs.exists(bak) then
            pcall(copy_file_binary, bak, orig)
            pcall(os.remove, bak:gsub("/", "\\"))
            table.insert(restored, name)
        end
    end

    -- Clean up deployed crack files
    local emu_files = {
        target_dir .. "/coldloader.ini",
        target_dir .. "/coldloader.dll",
        target_dir .. "/version.dll",
        target_dir .. "/steamclient.dll",
        target_dir .. "/steamclient64.dll",
        target_dir .. "/GameOverlayRenderer.dll",
        target_dir .. "/GameOverlayRenderer64.dll",
        target_dir .. "/steam_interfaces.txt",
    }
    for _, f in ipairs(emu_files) do
        if fs.exists(f) then pcall(os.remove, f:gsub("/", "\\")) end
    end

    -- Clean steam_settings folder
    local settings_dir = target_dir .. "/steam_settings"
    if fs.exists(settings_dir) then
        pcall(os.execute, string.format('rmdir /s /q "%s" >nul 2>&1', settings_dir:gsub("/", "\\")))
    end

    return {
        success = true,
        message = "Original files restored and emulator crack removed.",
        restored_files = restored,
    }
end

-- Packages the emulator files into a standalone ZIP archive
function M.export_zip(appid, dest_zip_path)
    local status = steam_status.get_status(appid)
    if not status.ok or not status.install_path then
        return { success = false, message = "Game install directory not found." }
    end

    local exe_info = game_exe.find_game_exe(status.install_path)
    if not exe_info then
        return { success = false, message = "Game executable not found." }
    end

    local be_path = (m_utils and type(m_utils.get_backend_path) == "function" and m_utils.get_backend_path()) or "backend"
    local stage_dir = fs.join(be_path, "data", "temp", "crack_export_" .. appid):gsub("\\", "/")
    pcall(fs.create_directories, stage_dir)

    dest_zip_path = dest_zip_path or fs.join(be_path, "data", "downloads", "crack_" .. appid .. ".zip")

    -- Stage crack files inside stage_dir
    local dll_paths = emu_toolchain.get_dll_paths(exe_info.arch)
    copy_file_binary(dll_paths.proxy, stage_dir .. "/version.dll")
    copy_file_binary(dll_paths.loader, stage_dir .. "/coldloader.dll")
    copy_file_binary(dll_paths.client, stage_dir .. "/" .. (exe_info.arch == "x86" and "steamclient.dll" or "steamclient64.dll"))

    -- Configs
    local configs = M.generate_configs(appid, { buildid = status.buildid })
    pcall(fs.create_directories, stage_dir .. "/steam_settings")
    for rel_path, content in pairs(configs) do
        local f = io.open(stage_dir .. "/" .. rel_path, "w")
        if f then
            f:write(content)
            f:close()
        end
    end

    -- Zip stage_dir using tar or powershell
    local win_zip = dest_zip_path:gsub("/", "\\")
    local win_stage = stage_dir:gsub("/", "\\")
    local cmd = string.format('tar -a -cf "%s" -C "%s" *', win_zip, win_stage)
    local ok = os.execute(cmd)
    if ok ~= 0 and ok ~= true then
        cmd = string.format('powershell -Command "Compress-Archive -Path \'%s\\*\' -DestinationPath \'%s\' -Force"', win_stage, win_zip)
        ok = os.execute(cmd)
    end

    pcall(os.execute, string.format('rmdir /s /q "%s" >nul 2>&1', win_stage))

    if not fs.exists(dest_zip_path) then
        return { success = false, message = "Failed to create crack ZIP archive." }
    end

    return { success = true, message = "Standalone crack ZIP exported successfully.", zip_path = dest_zip_path }
end

return M
