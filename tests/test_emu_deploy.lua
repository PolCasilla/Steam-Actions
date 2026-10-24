local helper = require("helper")
local emu_deploy = require("emu_deploy")

-- 1. Test config generation
local configs = emu_deploy.generate_configs("1091500", { buildid = 12345, player_name = "PlayerOne" })

helper.assert(configs["coldloader.ini"] ~= nil, "generates coldloader.ini")
helper.assert(configs["coldloader.ini"]:find("appid = 1091500") ~= nil, "coldloader.ini has appid")
helper.assert(configs["coldloader.ini"]:find("cleanup_delay = 70") ~= nil, "coldloader.ini has cleanup_delay")

helper.assert(configs["steam_settings/steam_appid.txt"] == "1091500\n", "generates steam_appid.txt")
helper.assert(configs["steam_settings/configs.main.ini"]:find("disable_lan_only=1") ~= nil, "configs.main.ini has disable_lan_only")
helper.assert(configs["steam_settings/configs.user.ini"]:find("account_name=PlayerOne") ~= nil, "configs.user.ini has player name")
helper.assert(configs["steam_settings/crack_buildid.txt"] == "12345\n", "records crack_buildid.txt")

helper.finish()
