local millennium = require("millennium")
require("rpc_functions")

local function on_load()
    millennium.ready()
end

return {
    on_load = on_load,
}
