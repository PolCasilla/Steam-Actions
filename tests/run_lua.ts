import { LuaFactory } from "wasmoon";
import * as fs from "fs";
import * as path from "path";

const testFile = process.argv[2];
if (!testFile) {
  console.error("Usage: bun run tests/run_lua.ts <test_file.lua>");
  process.exit(1);
}

const factory = new LuaFactory();
const lua = await factory.createEngine();

// Mount file system helpers (returning undefined for Lua nil)
lua.global.set("fs_read_file", (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
  } catch {}
  return undefined;
});
lua.global.set("fs_read_bytes", (filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      return Array.from(fs.readFileSync(filePath));
    }
  } catch {}
  return undefined;
});
lua.global.set("fs_exists", (filePath: string) => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
});
lua.global.set("fs_list", (dirPath: string) => {
  try {
    return fs.readdirSync(dirPath).map((f) => ({ name: f, is_dir: fs.statSync(path.join(dirPath, f)).isDirectory() }));
  } catch {
    return [];
  }
});

// Setup Lua package.path and package.preload
const baseDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const backendDir = path.join(baseDir, "backend").replace(/\\/g, "/");
const testsDir = path.join(baseDir, "tests").replace(/\\/g, "/");

lua.global.set("G_BACKEND_DIR", backendDir);
lua.global.set("G_TESTS_DIR", testsDir);

await lua.doString(`
  package.preload["millennium"] = function()
    return {
      steam_path = function() return "C:/Program Files (x86)/Steam" end
    }
  end

  package.preload["fs"] = function()
    return {
      exists = function(p) return fs_exists(p) end,
      join = function(...)
        local parts = {...}
        return (table.concat(parts, "/"):gsub("\\\\", "/"):gsub("/+", "/"))
      end,
      list = function(dir)
        return fs_list(dir)
      end
    }
  end

  package.preload["utils"] = function()
    return {
      read_file = function(p) return fs_read_file(p) end,
      get_backend_path = function() return G_BACKEND_DIR end
    }
  end

  local orig_require = require
  function require(name)
    if package.loaded[name] then return package.loaded[name] end
    if package.preload[name] then
      local res = package.preload[name]()
      package.loaded[name] = res
      return res
    end

    local rel = name:gsub("%.", "/")
    local p1 = G_BACKEND_DIR .. "/" .. rel .. ".lua"
    local c1 = fs_read_file(p1)
    if c1 then
      local fn = assert(load(c1, p1))
      local res = fn()
      package.loaded[name] = res
      return res
    end

    local p2 = G_TESTS_DIR .. "/" .. rel .. ".lua"
    local c2 = fs_read_file(p2)
    if c2 then
      local fn = assert(load(c2, p2))
      local res = fn()
      package.loaded[name] = res
      return res
    end

    return orig_require(name)
  end
`);

const testCode = fs.readFileSync(testFile, "utf-8");
try {
  await lua.doString(testCode);
} catch (err: any) {
  console.error("Test execution failed:", err);
  process.exit(1);
}
