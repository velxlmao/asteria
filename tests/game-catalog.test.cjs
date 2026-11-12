const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = path.join(__dirname, "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, "game-catalog.js"), "utf8"), context);
const games = context.window.ASTERIA_GAMES;
assert(games.length >= 300);
assert.equal(new Set(games.map(game => game.name.toLowerCase().replace(/[^a-z0-9]/g, ""))).size, games.length);
for (const game of games) {
	assert.equal(game.local, undefined);
	assert.equal(new URL(game.url).protocol, "https:");
	assert.equal(new URL(game.img).protocol, "https:");
	assert(["gn-math", "wasm.rip"].includes(game.source));
}
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(html.indexOf('src="game-catalog.js"') < html.indexOf('src="pages.js'));
assert(html.includes('id="game-count"'));
console.log(games.length + " catalogue entries checked, proxy launch mode and counter wiring passed");
