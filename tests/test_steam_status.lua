local helper = require("helper")

-- Mock m_utils.read_file specifically for this test
package.loaded["utils"] = {
    read_file = function(p)
        if p:find("libraryfolders.vdf") then
            return [["libraryfolders" { "0" { "path" "C:\\Program Files (x86)\\Steam" } } ]]
        elseif p:find("appmanifest_1091500.acf") then
            return [["AppState" {
                "appid" "1091500"
                "name" "Cyberpunk 2077"
                "installdir" "Cyberpunk 2077"
                "StateFlags" "4"
                "buildid" "12345"
                "targetbuildid" "12346"
                "LastUpdated" "1697000000"
            }]]
        end
        return nil
    end
}

local steam_status = require("steam_status")

local status = steam_status.get_status("1091500")

helper.eq(status.ok, true, "status.ok is true")
helper.eq(status.appid, "1091500", "status.appid is 1091500")
helper.eq(status.name, "Cyberpunk 2077", "status.name is Cyberpunk 2077")
helper.eq(status.installed, true, "status.installed is true")
helper.eq(status.update_pending, true, "status.update_pending is true because targetbuildid != buildid")
helper.eq(status.buildid, 12345, "status.buildid is 12345")
helper.eq(status.target_buildid, 12346, "status.target_buildid is 12346")
helper.eq(status.installdir, "Cyberpunk 2077", "status.installdir is Cyberpunk 2077")
helper.eq(status.install_path, "C:/Program Files (x86)/Steam/steamapps/common/Cyberpunk 2077", "status.install_path is resolved")

helper.finish()
