const fs = require("node:fs/promises");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const normalize = name => name.toLowerCase().replace(/[^a-z0-9]/g, "");
const excluded = /pokemon|pokémon|blooket|roblox|blackjack|roulette|emulator|azahar|soundboard|code editor|chat bot|\[!\]/i;

async function json(url) {
	const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
	if (!response.ok) throw new Error(url + ": " + response.status);
	return response.json();
}

async function check(game) {
	try {
		const responses = await Promise.all([game.url, game.img].map(url => fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) })));
		if (!responses[0].ok || !responses[1].ok) return null;
		if (!responses[0].headers.get("content-type")?.includes("text/html")) return null;
		if (!responses[1].headers.get("content-type")?.startsWith("image/")) return null;
		const response = await fetch(game.url, { signal: AbortSignal.timeout(15000) });
		if (!response.ok) return null;
		const reader = response.body.getReader();
		let html = "";
		const decoder = new TextDecoder();
		try {
			while (html.length < 131072) {
				const { value, done } = await reader.read();
				if (done) break;
				html += decoder.decode(value, { stream: true });
			}
		} finally { await reader.cancel(); }
		const base = new URL(html.match(/<base\b[^>]*href=["']([^"']+)/i)?.[1] || game.url, game.url);
		const assets = [...html.matchAll(/<(?:script|iframe)\b[^>]*\bsrc=["']([^"']+)/gi)]
			.map(match => match[1]).filter(url => !/^(data|blob|javascript):|googletag|google-analytics|doubleclick|googlesyndication/i.test(url)).slice(0, 3);
		const assetsOk = await Promise.all(assets.map(async asset => {
			try {
				const url = new URL(asset, base);
				if (url.protocol !== "https:") return false;
				const result = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(15000) });
				return result.ok;
			} catch { return false; }
		}));
		if (assetsOk.some(ok => !ok)) return null;
		return game;
	} catch { return null; }
}

async function main() {
	const [zones, ports] = await Promise.all([
		json("https://raw.githubusercontent.com/gn-math/assets/main/zones.json"),
		json("https://wasm.rip/games.json"),
	]);
	const candidates = [
		...zones.filter(game => game.id >= 0 && game.url.startsWith("{HTML_URL}/")).slice(0, 550).map(game => ({
			name: game.name,
			url: game.url.replace("{HTML_URL}", "https://gn-math.github.io/html"),
			img: game.cover.replace("{COVER_URL}", "https://raw.githubusercontent.com/gn-math/covers/main"),
			source: "gn-math",
		})),
		...ports.map(game => ({ name: game.name, url: new URL(game.gameUrl, "https://wasm.rip/").href, img: new URL(game.imageUrl, "https://wasm.rip/").href, source: "wasm.rip" })),
	];
	const seen = new Set();
	const unique = candidates.filter(game => {
		const key = normalize(game.name);
		if (excluded.test(game.name) || seen.has(key)) return false;
		seen.add(key);
		return true;
	});
	const results = [];
	let next = 0;
	await Promise.all(Array.from({ length: 8 }, async () => {
		while (next < unique.length) {
			const index = next++;
			results[index] = await check(unique[index]);
			if ((index + 1) % 100 === 0) console.log("checked", index + 1, "of", unique.length);
		}
	}));
	const games = results.filter(Boolean);
	if (games.length < 300) throw new Error("too few reachable games: " + games.length);
	await fs.writeFile(path.join(root, "game-catalog.js"), "window.ASTERIA_GAMES = " + JSON.stringify(games, null, "\t") + ";\n");
	await fs.writeFile(path.join(root, "scripts/game-catalog-report.json"), JSON.stringify({ checkedAt: new Date().toISOString(), checked: unique.length, accepted: games.length, checks: "entry page, cover, and first three external scripts or frames, not gameplay", rejected: unique.filter((game, index) => !results[index]) }, null, 2) + "\n");
	console.log("accepted", games.length, "rejected", unique.length - games.length);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
