-- XR18 Studio : pont fichier dans REAPER. Lit request.lua, écrit response.json dans <ressources>/XR18Studio.
-- Ne touche à aucun fichier de ReaCue : il lit seulement le fichier .concert.lua du projet ouvert.
local r = reaper
local SEP = package.config:sub(1, 1)
local DIR = r.GetResourcePath() .. SEP .. "XR18Studio"
r.RecursiveCreateDirectory(DIR, 0)
local REQ, RES, BEAT = DIR .. SEP .. "request.lua", DIR .. SEP .. "response.json", DIR .. SEP .. "heartbeat.txt"
local VERSION = "1.0.0"

local function jstr(s)
  return '"' .. tostring(s):gsub('[%z\1-\31\\"]', function(c)
    if c == '"' then return '\\"' elseif c == "\\" then return "\\\\" end
    return string.format("\\u%04x", c:byte())
  end) .. '"'
end
local function json(v)
  local t = type(v)
  if v == nil then return "null"
  elseif t == "boolean" then return tostring(v)
  elseif t == "number" then if v ~= v or v == math.huge or v == -math.huge then return "0" end return string.format("%.6f", v)
  elseif t == "string" then return jstr(v)
  elseif t == "table" then
    if #v > 0 or next(v) == nil then local o = {} for i, x in ipairs(v) do o[i] = json(x) end return "[" .. table.concat(o, ",") .. "]" end
    local o = {} for k, x in pairs(v) do o[#o + 1] = jstr(k) .. ":" .. json(x) end
    return "{" .. table.concat(o, ",") .. "}"
  end
  return "null"
end
local function write_atomic(path, text)
  local tmp = path .. ".tmp"
  local f = assert(io.open(tmp, "w")); f:write(text); f:close()
  os.remove(path); assert(os.rename(tmp, path))
end
local function read_file(path)
  local f = io.open(path, "r"); if not f then return nil end
  local s = f:read("*a"); f:close(); return s
end
local function track_name(tr) local _, n = r.GetTrackName(tr); return n end

-- mêmes rôles que ReaCue : on reconnaît ses pistes par leur nom
local ROLE_WORDS = {
  { "vocals", { "chant", "voix", "vocal", "lead vox" } }, { "drums", { "batterie", "drum" } }, { "bass", { "basse", "bass" } },
  { "lead_guitar", { "guitare solo", "lead guitar", "lead gtr" } }, { "guitars", { "guitare", "guitar" } },
  { "keys", { "clavier", "keys", "piano" } }, { "other", { "autres", "other" } },
}
local function is_rec(name) return name:sub(1, 4) == "REC " end
local function role_of(name)
  if is_rec(name) then return nil end
  local n = name:lower()
  for _, e in ipairs(ROLE_WORDS) do for _, w in ipairs(e[2]) do if n:find(w, 1, true) then return e[1] end end end
  return nil
end
local function each_track(fn) for i = 0, r.CountTracks(0) - 1 do fn(r.GetTrack(0, i), i) end end
local function find_track(name)
  for i = 0, r.CountTracks(0) - 1 do local t = r.GetTrack(0, i); if track_name(t) == name then return t end end
end

local function concert_of(project)
  if project == "" then return nil end
  local src = read_file((project:gsub("%.[Rr][Pp][Pp]$", "")) .. ".concert.lua")
  if not src then return nil end
  local chunk = load(src, "concert", "t", {})
  if not chunk then return nil end
  local ok, d = pcall(chunk)
  if ok and type(d) == "table" and type(d.songs) == "table" and #d.songs > 0 then return d end
end
local function regions()
  local out, _, nm, nr = {}, r.CountProjectMarkers(0)
  for i = 0, nm + nr - 1 do
    local _, isrgn, pos, stop, name = r.EnumProjectMarkers(i)
    if isrgn then out[#out + 1] = { start = pos, stop = stop, name = name } end
  end
  return out
end
local function items_of(tr)
  local out = {}
  for i = 0, r.CountTrackMediaItems(tr) - 1 do
    local it = r.GetTrackMediaItem(tr, i)
    local active, takes = r.GetActiveTake(it), {}
    for k = 0, r.CountTakes(it) - 1 do
      local t = r.GetTake(it, k)
      local file = ""
      if t and not r.TakeIsMIDI(t) then file = r.GetMediaSourceFileName(r.GetMediaItemTake_Source(t), "") end
      takes[#takes + 1] = { index = k, name = t and r.GetTakeName(t) or "", file = file, active = t == active }
    end
    out[#out + 1] = { pos = r.GetMediaItemInfo_Value(it, "D_POSITION"), length = r.GetMediaItemInfo_Value(it, "D_LENGTH"), takes = takes }
  end
  return out
end

local H = {}
function H.state()
  local _, project = r.EnumProjects(-1, "")
  local tracks = {}
  each_track(function(tr, i)
    local name = track_name(tr)
    tracks[#tracks + 1] = { index = i, name = name, rec = is_rec(name), role = role_of(name),
      mute = r.GetMediaTrackInfo_Value(tr, "B_MUTE") == 1, solo = r.GetMediaTrackInfo_Value(tr, "I_SOLO") ~= 0,
      armed = r.GetMediaTrackInfo_Value(tr, "I_RECARM") == 1, items = items_of(tr) }
  end)
  local c, songs = concert_of(project), {}
  if c then for i, s in ipairs(c.songs) do songs[i] = { title = s.title or s.name or ("Morceau " .. i), start = s.start, countin = s.countin or s.start, stop = s.stop } end end
  local play = r.GetPlayState()
  local a, b = r.GetSet_LoopTimeRange(false, true, 0, 0, false)
  return { version = VERSION, project = project, concert = c and (c.name or "") or nil, songs = songs, regions = regions(), tracks = tracks,
    pos = (play & 1) == 1 and r.GetPlayPosition() or r.GetCursorPosition(), playing = (play & 1) == 1, recording = (play & 4) == 4,
    loop = { on = r.GetSetRepeat(-1) == 1, start = a, stop = b }, length = r.GetProjectLength(0) }
end
function H.goto_pos(a) r.SetEditCurPos(a.pos, true, true); return { pos = a.pos } end
function H.set_loop(a)
  if a.on then r.GetSet_LoopTimeRange(true, true, a.start, a.stop, false) end
  r.GetSetRepeat(a.on and 1 or 0)
  return { on = a.on == true }
end
function H.track_mute(a)
  local t = assert(find_track(a.name), "piste introuvable")
  r.SetMediaTrackInfo_Value(t, a.solo and "I_SOLO" or "B_MUTE", a.on and 1 or 0)
  return { name = a.name }
end
-- Choisit la prise n sur toutes les pistes REC, dans la plage donnée. Possible pendant la lecture.
function H.select_take(a)
  local changed = 0
  each_track(function(tr)
    if is_rec(track_name(tr)) then
      for i = 0, r.CountTrackMediaItems(tr) - 1 do
        local it = r.GetTrackMediaItem(tr, i)
        local p = r.GetMediaItemInfo_Value(it, "D_POSITION")
        if p + r.GetMediaItemInfo_Value(it, "D_LENGTH") > a.start and p < a.stop and a.take < r.CountTakes(it) then
          r.SetActiveTake(r.GetTake(it, a.take)); changed = changed + 1
        end
      end
    end
  end)
  r.UpdateArrange()
  return { changed = changed }
end
-- Écoute « original » : pistes REC coupées, stems rallumés. Sinon retour à la présence du jour.
function H.apply_mutes(a)
  each_track(function(tr)
    local name = track_name(tr)
    local v = a.names[name]
    if v == nil and role_of(name) then v = a.roles[role_of(name)] end
    if v ~= nil then r.SetMediaTrackInfo_Value(tr, "B_MUTE", v and 1 or 0) end
  end)
  return { ok = true }
end
-- Ajoute les pistes REC manquantes en fin de projet, sans jamais toucher aux pistes ReaCue.
function H.apply_presence(a)
  r.Undo_BeginBlock()
  for _, t in ipairs(a.rec) do
    local tr = find_track(t.name)
    if not tr then
      local n = r.CountTracks(0); r.InsertTrackAtIndex(n, false); tr = r.GetTrack(0, n)
      r.SetTrackStateChunk(tr, t.chunk, false)
    end
    r.SetMediaTrackInfo_Value(tr, "I_RECARM", 1)
  end
  for _, name in ipairs(a.unarm) do local tr = find_track(name); if tr then r.SetMediaTrackInfo_Value(tr, "I_RECARM", 0) end end
  H.apply_mutes({ names = {}, roles = a.roles })
  r.Undo_EndBlock("XR18 Studio : qui est là", -1)
  return { ok = true }
end

local function handle(src)
  local chunk = load("return " .. src, "request", "t", {})
  if not chunk then return { ok = false, error = "Requête illisible" } end
  local okr, req = pcall(chunk)
  if not okr or type(req) ~= "table" then return { ok = false, error = "Requête invalide" } end
  local fn = H[req.cmd]
  if not fn then return { id = req.id, ok = false, error = "Commande inconnue" } end
  local ok, res = pcall(fn, req.args or {})
  if ok then return { id = req.id, ok = true, result = res } end
  return { id = req.id, ok = false, error = tostring(res) }
end
XR18_BRIDGE = { handle = handle, H = H, json = json, role_of = role_of }

local beat = 0
local function loop()
  local now = r.time_precise()
  if now - beat > 2 then beat = now; pcall(write_atomic, BEAT, tostring(os.time())) end
  local src = read_file(REQ)
  if src then os.remove(REQ); pcall(write_atomic, RES, json(handle(src))) end
  r.defer(loop)
end
if not XR18_BRIDGE_NO_LOOP then
  r.atexit(function() os.remove(BEAT) end)
  loop()
end
