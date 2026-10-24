local M = {}

-- 37 canonical Steamworks interfaces from the spec
local INTERFACE_PATTERNS = {
    "STEAMAPPS_INTERFACE_VERSION",
    "SteamApps",
    "SteamClient",
    "SteamUser",
    "SteamUtils",
    "STEAMUSERSTATS_INTERFACE_VERSION",
    "SteamUserStats",
    "STEAMFRIENDS_INTERFACE_VERSION",
    "SteamFriends",
    "SteamMatchmaking",
    "SteamMatchmakingServers",
    "STEAMNETWORKING_INTERFACE_VERSION",
    "SteamNetworking",
    "STEAMREMOTESTORAGE_INTERFACE_VERSION",
    "SteamRemoteStorage",
    "STEAMSCREENSHOTS_INTERFACE_VERSION",
    "SteamScreenshots",
    "STEAMHTTP_INTERFACE_VERSION",
    "SteamHTTP",
    "STEAMUNIFIEDMESSAGES_INTERFACE_VERSION",
    "SteamUnifiedMessages",
    "STEAMUGC_INTERFACE_VERSION",
    "SteamUGC",
    "STEAMAPPLIST_INTERFACE_VERSION",
    "SteamAppList",
    "STEAMMUSIC_INTERFACE_VERSION",
    "SteamMusic",
    "STEAMMUSICREMOTE_INTERFACE_VERSION",
    "SteamMusicRemote",
    "STEAMHTMLSURFACE_INTERFACE_VERSION",
    "SteamHTMLSurface",
    "STEAMINVENTORY_INTERFACE_VERSION",
    "SteamInventory",
    "STEAMVIDEO_INTERFACE_VERSION",
    "SteamVideo",
    "SteamParentalSettings",
    "SteamInput",
    "SteamController",
}

-- Checks if a DLL binary sample indicates an emulator wrapper rather than genuine steam_api
function M.is_emulator_dll(bytes)
    if not bytes then return false end
    if bytes:find("steam_settings", 1, true)
       or bytes:find("configs.user.ini", 1, true)
       or bytes:find("coldloader", 1, true)
       or bytes:find("steam_emu.ini", 1, true) then
        return true
    end
    return false
end

-- Scans binary bytes for interface definitions without regex.
-- Returns table mapping base prefix to full interface string (e.g. ["SteamUser"] = "SteamUser021").
function M.scan(bytes)
    if not bytes then return {} end

    local results = {}
    local steamclient_versions = {}

    for _, prefix in ipairs(INTERFACE_PATTERNS) do
        local plen = #prefix
        local cursor = 1

        while true do
            local start_pos, end_pos = bytes:find(prefix, cursor, true)
            if not start_pos then break end

            -- Capture trailing digits (e.g. 021)
            local ver_start = end_pos + 1
            local ver_digits = ""
            for i = ver_start, math.min(#bytes, ver_start + 5) do
                local c = bytes:sub(i, i)
                if c >= "0" and c <= "9" then
                    ver_digits = ver_digits .. c
                else
                    break
                end
            end

            if ver_digits ~= "" then
                local full_interface = prefix .. ver_digits
                if prefix == "SteamClient" then
                    steamclient_versions[full_interface] = true
                else
                    -- Store highest version if multiple appear
                    local current = results[prefix]
                    if not current or full_interface > current then
                        results[prefix] = full_interface
                    end
                end
            end

            cursor = end_pos + 1
        end
    end

    -- Canonical Fallback Exception:
    -- If multiple SteamClient versions are discovered, strictly retain SteamClient017.
    if next(steamclient_versions) then
        if steamclient_versions["SteamClient017"] then
            results["SteamClient"] = "SteamClient017"
        else
            -- If SteamClient017 wasn't explicitly found, sort and pick highest
            local list = {}
            for k in pairs(steamclient_versions) do table.insert(list, k) end
            table.sort(list)
            results["SteamClient"] = list[#list]
        end
    end

    return results
end

-- Generates formatted steam_interfaces.txt string from binary contents
function M.generate_txt(bytes)
    local found = M.scan(bytes)
    local lines = {}

    for _, full in pairs(found) do
        table.insert(lines, full)
    end

    table.sort(lines)
    return table.concat(lines, "\n") .. (lines[1] and "\n" or "")
end

return M
