local helper = require("helper")
local steam_interfaces = require("steam_interfaces")

-- 1. Test scanning mock binary contents
local dummy_dll = "xxxSTEAMAPPS_INTERFACE_VERSION008yyySteamUser021zzzSteamClient012...SteamClient017...SteamUtils010qqq"

local found = steam_interfaces.scan(dummy_dll)

helper.eq(found["SteamUser"], "SteamUser021", "extracts SteamUser021")
helper.eq(found["SteamUtils"], "SteamUtils010", "extracts SteamUtils010")
helper.eq(found["STEAMAPPS_INTERFACE_VERSION"], "STEAMAPPS_INTERFACE_VERSION008", "extracts STEAMAPPS_INTERFACE_VERSION008")

-- 2. Test Canonical SteamClient017 exception:
-- When both SteamClient012 and SteamClient017 are present, it MUST retain SteamClient017
helper.eq(found["SteamClient"], "SteamClient017", "retains SteamClient017 over SteamClient012")

-- 3. Test generate_txt output
local txt = steam_interfaces.generate_txt(dummy_dll)
helper.assert(txt:find("SteamClient017") ~= nil, "txt contains SteamClient017")
helper.assert(txt:find("SteamClient012") == nil, "txt does NOT contain SteamClient012")
helper.assert(txt:find("SteamUser021") ~= nil, "txt contains SteamUser021")

-- 4. Test emulator detection
local emu_stub = "xxxsteam_settings/configs.user.ini...coldloader..."
helper.eq(steam_interfaces.is_emulator_dll(emu_stub), true, "detects emulator dll stub")
helper.eq(steam_interfaces.is_emulator_dll(dummy_dll), false, "genuine dll is not marked emulator")

helper.finish()
