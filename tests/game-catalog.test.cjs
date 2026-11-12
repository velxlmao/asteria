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
	assert.equal(game.local, true);
	assert(game.url.startsWith("games/imported/"));
	const loader = fs.readFileSync(path.join(root, game.url), "utf8");
	assert(/<base\b[^>]*href\s*=/i.test(loader));
	assert.equal(new URL(game.originalUrl).protocol, "https:");
	assert.equal(new URL(game.img).protocol, "https:");
	assert(["gn-math", "wasm.rip"].includes(game.source));
}
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(html.indexOf('src="game-catalog.js"') < html.indexOf('src="pages.js'));
assert(html.includes('id="game-count"'));
console.log(games.length + " local game loaders, base URLs and counter wiring passed");
