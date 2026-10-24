local M = {}

local passed = 0
local failed = 0

function M.eq(actual, expected, label)
    if actual == expected then
        passed = passed + 1
    else
        failed = failed + 1
        print(string.format("FAIL [%s]: expected %s, got %s", tostring(label), tostring(expected), tostring(actual)))
    end
end

function M.assert(condition, label)
    if condition then
        passed = passed + 1
    else
        failed = failed + 1
        print(string.format("FAIL [%s]: condition was false", tostring(label)))
    end
end

function M.finish()
    print(string.format("\nResults: %d passed, %d failed", passed, failed))
    if failed > 0 then
        error(string.format("%d test(s) failed", failed))
    end
end

return M
