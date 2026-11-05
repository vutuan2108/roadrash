'use strict';
// ============ Highway Brawl online server ============
// - serves the game files (index.html, js/...)
// - lobby: rooms with a 4-letter code and a waiting list; the host picks the stage and starts when everyone is ready
// - runs every online race authoritatively with the very same js/race.js the browser uses (loaded in a sandbox):
//   clients send their keys every frame, the server answers with snapshots 20 times a second
const http = require('http'), fs = require('fs'), path = require('path'), vm = require('vm');
const { WebSocketServer } = require('ws');

const ROOT = path.join(__dirname, '..');
const PORT = +process.env.PORT || 3000;
const MAX_HUMANS = 8, TICK = 1 / 60, SNAP_EVERY = 3, LOAD_WAIT = 20, RESULTS_AFTER = 3;

// ---------- game logic: the browser scripts run unchanged in a sandbox (no window, no audio, no keyboard) ----------
const sandbox = { console, Math, Date, JSON, addEventListener() {}, window: {} };
vm.createContext(sandbox);
for (const f of ['js/core.js', 'js/track.js', 'js/race.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
}
const G = vm.runInContext('({ Race, THEMES, BIKES, CAR_COLS, CAR_TYPES, decodeInput })', sandbox);
const WEAPON = { club: 1, chain: 2 };

// ---------- static files ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { p = ''; }
  if (p === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  const allowed = (p === '/index.html' || p.startsWith('/js/')) && file.startsWith(path.join(ROOT, path.sep));
  if (!allowed) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------- players and rooms ----------
const rooms = new Map();   // code -> room
const lobby = new Set();   // connected players not in a room (they get the room list)
let nextId = 1;
// HB_LAG=<ms>: testing only - simulates that much round-trip network delay (half each way)
const LAG = +process.env.HB_LAG || 0;
const later = f => LAG ? setTimeout(f, LAG / 2) : f();
const send = (p, m) => {
  const s = typeof m === 'string' ? m : JSON.stringify(m);
  later(() => { if (p.ws.readyState === 1) p.ws.send(s); });
};
const cleanName = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 14) || 'Tay đua';
const clampInt = (v, a, b, d) => Number.isFinite(+v) ? Math.max(a, Math.min(b, Math.round(+v))) : d;

function newCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) { let c = ''; for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)]; if (!rooms.has(c)) return c; }
}
function roomInfo(room) {
  return { t: 'room', code: room.code, host: room.host, theme: room.theme, level: room.level, state: room.state,
    players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, bike: p.bike, ready: p.ready })) };
}
function roomList() {
  return { t: 'list', rooms: [...rooms.values()].map(r => ({ code: r.code, host: r.players.get(r.host).name, n: r.players.size,
    max: MAX_HUMANS, theme: r.theme, state: r.state })) };
}
function pushList() { const m = JSON.stringify(roomList()); for (const p of lobby) send(p, m); }
function pushRoom(room) { const m = JSON.stringify(roomInfo(room)); for (const p of room.players.values()) send(p, m); pushList(); }

function setProfile(p, m) {
  p.name = cleanName(m.name);
  p.bike = clampInt(m.bike, 0, G.BIKES.length - 1, 0);
  p.bikeHp = clampInt(m.bikeHp, 1, G.BIKES[p.bike].dur, G.BIKES[p.bike].dur);
  p.level = clampInt(m.level, 1, 5, 1);
}
function joinRoom(p, room) {
  if (room.players.size >= MAX_HUMANS) return send(p, { t: 'err', msg: 'Phòng đã đủ ' + MAX_HUMANS + ' người.' });
  if (room.state !== 'wait') return send(p, { t: 'err', msg: 'Phòng đang đua, hãy đợi lượt sau.' });
  lobby.delete(p); p.room = room; p.ready = false; room.players.set(p.id, p);
  pushRoom(room);
}
function leaveRoom(p) {
  const room = p.room; if (!room) return;
  room.players.delete(p.id); p.room = null; p.h = null;
  if (room.race) {   // left mid-race: the bike disappears, the others race on
    const h = room.race.humans.find(o => o.id === p.id);
    if (h) { h.gone = true; room.race.retire(h, 'quit'); }
    room.waitLoad.delete(p.id);
  }
  if (!room.players.size) { rooms.delete(room.code); pushList(); return; }
  if (room.host === p.id) room.host = room.players.keys().next().value;
  pushRoom(room);
}

function startRace(room) {
  const ps = [...room.players.values()];
  if (ps.some(p => p.id !== room.host && !p.ready)) return;
  const seed = Math.floor(Math.random() * 1e9);
  const humans = ps.map(p => ({ id: p.id, name: p.name, bikeIdx: p.bike, bikeHp: p.bikeHp }));
  const race = new G.Race({ themeIdx: room.theme, level: room.level, seed, humans, server: true });
  room.race = race; room.state = 'race'; room.running = false; room.tickN = 0; room.loadT = 0;
  room.waitLoad = new Set(ps.map(p => p.id));
  for (const p of ps) { p.h = race.humans.find(h => h.id === p.id); p.q = []; p.ack = 0; p.lastK = 0; p.ev = []; }
  const roster = race.racers.map(r => r.isPlayer ? { id: r.id } : { rv: r.rv, hp: Math.round(r.maxHp) });
  const m = JSON.stringify({ t: 'start', theme: room.theme, level: room.level, seed, humans, roster });
  for (const p of ps) send(p, m);
  pushList();
}

// ---------- the race loop ----------
const r2 = v => Math.round(v * 100) / 100, r3 = v => Math.round(v * 1000) / 1000;
function riderRow(r) {
  return [Math.round(r.z), r3(r.x), Math.round(r.speed), r2(r.lean), r2(r.pitch), Math.round(r.hp),
    (r.crash ? 1 : 0) | (r.finished ? 2 : 0) | (r.gone ? 4 : 0), r.atk ? r.atk.side : 0, r.atk ? r3(r.atk.t) : 0,
    WEAPON[r.weapon] || 0, r2(r.inv), r.rank];
}
function snapshot(room) {
  const race = room.race, idx = new Map(race.racers.map((r, i) => [r, i]));
  const C = race.police;
  const base = {
    t: 's', n: room.tickN, time: r2(race.time), cd: race.state === 'countdown' ? r2(race.count) : -1,
    R: race.racers.map(riderRow),
    P: C ? [race.policeGen].concat(riderRow(C)) : null,
    C: race.cars.map(c => [G.CAR_TYPES.indexOf(c.type), G.CAR_COLS.indexOf(c.col), Math.round(c.z), r3(c.x)]),
    B: race.bodies.map(b => [b.owner === C ? -1 : idx.get(b.owner), Math.round(b.z), r3(b.x), Math.round(b.h), r2(b.rot), b.vz > 50 ? 1 : 0]),
  };
  const head = JSON.stringify(base).slice(0, -1);
  for (const p of room.players.values()) {
    const h = p.h; if (!h) continue;
    const me = [r2(h.leanF), r3(h.pitchV), r2(h.wheelT), Math.round(h.bikeHp), h.kos, h.place || 0, h.done || '', r2(h.crash ? h.crash.t : 0)];
    send(p, head + ',"ack":' + p.ack + ',"me":' + JSON.stringify(me) + ',"ev":' + JSON.stringify(p.ev) + '}');
    p.ev = [];
  }
}
function finishRace(room) {
  const race = room.race;
  const rows = race.results().map(r => ({ name: r.name, id: r.id || null, time: r.time === Infinity ? null : r2(r.time) }));
  for (const p of room.players.values()) {
    const h = p.h; if (!h) continue;
    send(p, { t: 'end', rows, me: { done: h.done, place: h.place || 0, kos: h.kos, bikeHp: Math.round(Math.max(0, h.bikeHp)), level: race.level } });
    p.bikeHp = Math.max(1, Math.round(h.bikeHp)); p.ready = false; p.h = null;
  }
  room.race = null; room.state = 'wait'; room.running = false;
  pushRoom(room);
}
function stepRoom(room) {
  const race = room.race;
  for (const p of room.players.values()) {
    const h = p.h; if (!h) continue;
    // one input per tick; a backlog (network hiccup) is replayed so the client's prediction stays in step
    while (p.q.length > 4) { const m = p.q.shift(); h.input = G.decodeInput(m.k); p.ack = m.s; race.updateHuman(h, TICK); }
    if (p.q.length) { const m = p.q.shift(); h.input = G.decodeInput(m.k); p.ack = m.s; p.lastK = m.k; }
    else h.input = G.decodeInput(p.lastK & ~(32 | 64));   // keep holding the last keys; attacks are one-shot
  }
  race.update(TICK);
  room.tickN++;
  for (const e of race.events) for (const p of room.players.values()) if (!e.to || e.to === p.id) p.ev.push(e);
  race.events.length = 0;
  if (room.tickN % SNAP_EVERY === 0) snapshot(room);
  if (race.over && race.over.t > RESULTS_AFTER) finishRace(room);
}
let last = process.hrtime.bigint(), acc = 0;
setInterval(() => {
  const now = process.hrtime.bigint();
  acc += Math.min(0.25, Number(now - last) / 1e9); last = now;
  while (acc >= TICK) {
    acc -= TICK;
    for (const room of rooms.values()) {
      if (!room.race) continue;
      if (!room.running) {   // wait until every client has built the 3D track (or give up on slow ones)
        room.loadT += TICK;
        if (!room.waitLoad.size || room.loadT > LOAD_WAIT) room.running = true;
        else continue;
      }
      stepRoom(room);
    }
  }
}, 4);

// ---------- messages ----------
function handle(p, m) {
  const room = p.room;
  switch (m.t) {
    case 'list': send(p, roomList()); break;
    case 'create': {
      if (room) leaveRoom(p);
      setProfile(p, m);
      const r = { code: newCode(), host: p.id, players: new Map(), theme: 0, level: p.level, state: 'wait', race: null };
      rooms.set(r.code, r); joinRoom(p, r);
      break;
    }
    case 'join': {
      const r = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!r) { send(p, { t: 'err', msg: 'Không tìm thấy phòng ' + String(m.code || '').toUpperCase() + '.' }); break; }
      if (room === r) { pushRoom(r); break; }
      if (room) leaveRoom(p);
      setProfile(p, m); joinRoom(p, r);
      break;
    }
    case 'profile': if (room && room.state === 'wait') { setProfile(p, m); pushRoom(room); } break;
    case 'leave': if (room) { leaveRoom(p); lobby.add(p); send(p, roomList()); } break;
    case 'ready': if (room && room.state === 'wait') { p.ready = !!m.v; pushRoom(room); } break;
    case 'theme':
      if (room && room.host === p.id && room.state === 'wait') { room.theme = clampInt(m.v, 0, G.THEMES.length - 1, 0); pushRoom(room); }
      break;
    case 'start': if (room && room.host === p.id && room.state === 'wait') startRace(room); break;
    case 'loaded': if (room && room.race) room.waitLoad.delete(p.id); break;
    case 'in':
      if (room && room.race && p.h && Number.isInteger(m.s) && m.s > p.ack) { p.q.push({ s: m.s, k: m.k | 0 }); if (p.q.length > 120) p.q.shift(); }
      break;
    case 'ping': send(p, { t: 'pong', c: m.c }); break;
  }
}

const wss = new WebSocketServer({ server, maxPayload: 4096 });
wss.on('connection', ws => {
  const p = { id: 'p' + (nextId++), ws, name: 'Tay đua', bike: 0, bikeHp: 100, level: 1, room: null, ready: false, q: [], ack: 0, lastK: 0, ev: [] };
  lobby.add(p);
  ws.on('message', data => { let m; try { m = JSON.parse(data); } catch (e) { return; } if (m && typeof m === 'object') later(() => handle(p, m)); });
  ws.on('close', () => { lobby.delete(p); leaveRoom(p); });
  ws.on('error', () => {});
  send(p, { t: 'hi', id: p.id, themes: G.THEMES.map(t => t.name), maxHumans: MAX_HUMANS });
});

server.listen(PORT, () => console.log('Highway Brawl: http://localhost:' + PORT));
