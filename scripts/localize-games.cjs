const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
async function main() {
	const context = { window: {} };
	vm.runInNewContext(await fs.readFile(path.join(root, "game-catalog.js"), "utf8"), context);
	const games = context.window.ASTERIA_GAMES;
	let next = 0;
	const failed = [];
	await Promise.all(Array.from({ length: 6 }, async () => {
		while (next < games.length) {
			const game = games[next++];
			try {
				const response = await fetch(game.url, { signal: AbortSignal.timeout(30000) });
				if (!response.ok) throw new Error("HTTP " + response.status);
				const reader = response.body.getReader();
				const chunks = [];
				let bytes = 0;
				try {
					while (true) {
						const { value, done } = await reader.read();
						if (done) break;
						bytes += value.length;
						if (bytes > 8000000) throw new Error("HTML exceeds local loader size limit");
						chunks.push(Buffer.from(value));
					}
				} finally { await reader.cancel(); }
				let html = Buffer.concat(chunks).toString("utf8");
				if (!/<base\b[^>]*href\s*=/i.test(html)) {
					const base = '<base href="' + new URL(".", game.url).href + '">';
					html = /<head\b[^>]*>/i.test(html) ? html.replace(/<head\b[^>]*>/i, "$&" + base) : base + html;
				}
				const slug = game.source + "-" + new URL(game.url).pathname.replace(/[^a-z0-9]/gi, "-");
				const directory = path.join(root, "games/imported", slug);
				await fs.mkdir(directory, { recursive: true });
				await fs.writeFile(path.join(directory, "index.html"), html);
				game.originalUrl = game.url;
				game.url = "games/imported/" + slug + "/index.html";
				game.local = true;
				game.splash = "load";
			} catch (error) { failed.push({ name: game.name, error: error.message }); }
		}
	}));
	const local = games.filter(game => game.local);
	await fs.writeFile(path.join(root, "game-catalog.js"), "window.ASTERIA_GAMES = " + JSON.stringify(local, null, "\t") + ";\n");
	await fs.writeFile(path.join(root, "scripts/local-games-report.json"), JSON.stringify({ localized: local.length, failed }, null, 2) + "\n");
	console.log(JSON.stringify({ localized: local.length, failed }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
