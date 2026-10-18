-- Parses Valve KeyValues text (appmanifest .acf, libraryfolders.vdf).
-- Keys are lowercased because Steam treats them as case-insensitive.
local M = {}

local ESCAPES = { n = "\n", t = "\t", ["\\"] = "\\", ['"'] = '"' }

local function tokenize(text)
    local tokens = {}
    local i, n = 1, #text
    while i <= n do
        local c = text:sub(i, i)
        if c:match("%s") then
            i = i + 1
        elseif c == "/" and text:sub(i + 1, i + 1) == "/" then
            local nl = text:find("\n", i, true)
            i = nl and nl + 1 or n + 1
        elseif c == "{" or c == "}" then
            tokens[#tokens + 1] = { kind = c }
            i = i + 1
        elseif c == '"' then
            local buf, closed = {}, false
            i = i + 1
            while i <= n do
                local ch = text:sub(i, i)
                if ch == "\\" then
                    buf[#buf + 1] = ESCAPES[text:sub(i + 1, i + 1)] or text:sub(i + 1, i + 1)
                    i = i + 2
                elseif ch == '"' then
                    closed = true
                    i = i + 1
                    break
                else
                    buf[#buf + 1] = ch
                    i = i + 1
                end
            end
            if not closed then error("vdf: unterminated string") end
            tokens[#tokens + 1] = { kind = "string", value = table.concat(buf) }
        else
            error("vdf: unexpected character '" .. c .. "' at pos " .. i)
        end
    end
    return tokens
end

local function parse_block(tokens, pos, expect_close)
    local result = {}
    while pos <= #tokens do
        local tok = tokens[pos]
        if tok.kind == "}" then
            if not expect_close then error("vdf: unexpected '}'") end
            return result, pos + 1
        end
        if tok.kind ~= "string" then error("vdf: expected a key") end
        local key = tok.value:lower()
        local nxt = tokens[pos + 1]
        if not nxt then error("vdf: key '" .. key .. "' has no value") end
        if nxt.kind == "string" then
            result[key] = nxt.value
            pos = pos + 2
        elseif nxt.kind == "{" then
            local child
            child, pos = parse_block(tokens, pos + 2, true)
            result[key] = child
        else
            error("vdf: key '" .. key .. "' has no value")
        end
    end
    if expect_close then error("vdf: missing closing '}'") end
    return result, pos
end

function M.parse(text)
    return parse_block(tokenize(text), 1, false)
end

return M
