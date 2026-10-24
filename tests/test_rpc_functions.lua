local helper = require("helper")

-- Setup mock cjson
package.preload["json"] = function()
    return {
        encode = function(t)
            -- Simple serializer for tests
            local items = {}
            for k, v in pairs(t) do
                table.insert(items, string.format('"%s":%s', tostring(k), type(v) == "string" and ('"' .. v .. '"') or tostring(v)))
            end
            return "{" .. table.concat(items, ",") .. "}"
        end,
        decode = function(str) return {} end,
    }
end

package.preload["http"] = function() return {} end
package.preload["settings"] = function() return {} end
package.preload["installer"] = function() return {} end

require("rpc_functions")

-- Verify global functions are registered
helper.assert(type(_G.getGameStatus) == "function", "getGameStatus is defined")
helper.assert(type(_G.deployEmulator) == "function", "deployEmulator is defined")
helper.assert(type(_G.restoreOriginal) == "function", "restoreOriginal is defined")
helper.assert(type(_G.exportEmulatorZip) == "function", "exportEmulatorZip is defined")
helper.assert(type(_G.downloadEmulatorToolchain) == "function", "downloadEmulatorToolchain is defined")

helper.finish()
