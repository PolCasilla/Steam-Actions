local helper = require("helper")
local game_exe = require("game_exe")

-- 1. Test detect_pe_arch with constructed byte strings
local function make_dummy_pe(machine_low, machine_high)
    local t = {}
    -- Fill 0x40 bytes
    for i = 1, 64 do t[i] = 0 end
    -- MZ at 1, 2
    t[1] = string.byte("M")
    t[2] = string.byte("Z")
    -- PE offset at 61 (0x3C) -> 0x80 (128)
    t[61] = 128
    t[62] = 0
    t[63] = 0
    t[64] = 0
    -- Pad up to 128
    for i = 65, 128 do t[i] = 0 end
    -- PE\0\0 at 129..132
    t[129] = string.byte("P")
    t[130] = string.byte("E")
    t[131] = 0
    t[132] = 0
    -- Machine bytes at 133, 134
    t[133] = machine_low
    t[134] = machine_high
    for i = 135, 140 do t[i] = 0 end

    local chars = {}
    for i = 1, #t do chars[i] = string.char(t[i]) end
    return table.concat(chars)
end

-- 0x8664 -> low: 0x64 (100), high: 0x86 (134)
local pe_x64 = make_dummy_pe(0x64, 0x86)
-- 0x014C -> low: 0x4C (76), high: 0x01 (1)
local pe_x86 = make_dummy_pe(0x4C, 0x01)

helper.eq(game_exe.detect_pe_arch(pe_x64), "x64", "detects x64 PE machine type")
helper.eq(game_exe.detect_pe_arch(pe_x86), "x86", "detects x86 PE machine type")
helper.eq(game_exe.detect_pe_arch("random non-pe string"), nil, "rejects non-PE content")
helper.eq(game_exe.detect_pe_arch(make_dummy_pe(0x00, 0x00)), nil, "rejects unknown machine type")

-- 2. Test executable filtering and Unreal Shipping priority
local mock_files = {
    { path = "C:/Games/CyberGame/CrashReportClient.exe", rel = "CrashReportClient.exe", is_exe = true },
    { path = "C:/Games/CyberGame/CyberGame.exe", rel = "CyberGame.exe", is_exe = true },
    { path = "C:/Games/CyberGame/Binaries/Win64/CyberGame-Win64-Shipping.exe", rel = "Binaries/Win64/CyberGame-Win64-Shipping.exe", is_exe = true },
}

local chosen = game_exe.select_best_exe(mock_files)
helper.assert(chosen ~= nil, "found a chosen exe")
helper.eq(chosen.rel, "Binaries/Win64/CyberGame-Win64-Shipping.exe", "prioritizes Unreal Shipping binary")
helper.eq(chosen.is_unreal, true, "marks is_unreal as true")

-- 3. Test blacklist filtering
helper.eq(game_exe.is_blacklisted("UnityCrashHandler64.exe"), true, "blacklists crash handler")
helper.eq(game_exe.is_blacklisted("unins000.exe"), true, "blacklists uninstaller")
helper.eq(game_exe.is_blacklisted("dxsetup.exe"), true, "blacklists directx setup")
helper.eq(game_exe.is_blacklisted("Game.exe"), false, "does not blacklist game executable")

helper.finish()
