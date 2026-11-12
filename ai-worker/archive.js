const uuid = /^[a-f0-9-]{36}$/i;
const browserToken = /^[a-f0-9-]{72}$/i;
export function validateUpload(body) {
	if (body.consent !== "owner-review-v1" || !browserToken.test(body.browser) || !uuid.test(body.id)) throw new Error("invalid consent or identity");
	if (!Number.isInteger(body.offset) || body.offset < 0 || body.offset > 10000 || !Array.isArray(body.messages) || body.messages.length > 40) throw new Error("invalid messages");
	const messages = body.messages.map(message => {
		if (!["user", "assistant"].includes(message.role) || typeof message.content !== "string" || message.content.length > 12000) throw new Error("invalid message");
		return { role: message.role, content: message.content };
	});
	return { id: body.id, offset: body.offset, messages, name: typeof body.name === "string" ? body.name.trim().slice(0, 60) : "" };
}
async function verifyOwner(password) {
	if (typeof password !== "string" || !password || password.length > 200) return false;
	const response = await fetch("https://velocify-public-chat.realdashvr.workers.dev/connect", { headers: { Upgrade: "websocket", Origin: "https://githubraw.com" } });
	const socket = response.webSocket;
	if (!socket) return false;
	socket.accept();
	return new Promise(resolve => {
		let finished = false;
		const finish = value => { if (finished) return; finished = true; clearTimeout(timeout); try { socket.close(1000); } catch {} resolve(value); };
		const timeout = setTimeout(() => finish(false), 8000);
		const token = crypto.randomUUID() + crypto.randomUUID();
		socket.addEventListener("message", event => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === "ban-state") socket.send(JSON.stringify({ type: "name", token, name: "velx", password }));
				if (data.type === "named") finish(data.owner === true);
				if (data.type === "error") finish(false);
			} catch { finish(false); }
		});
		socket.addEventListener("close", () => finish(false));
		socket.addEventListener("error", () => finish(false));
		socket.send(JSON.stringify({ type: "hello", token }));
	});
}
export class ChatArchive {
	constructor(state) { this.storage = state.storage; }
	async fetch(request) {
		const reply = (value, status = 200) => Response.json(value, { status, headers: { "cache-control": "no-store" } });
		try {
			const body = await request.json();
			const action = new URL(request.url).pathname;
			if (action === "/archive/login") {
				if (!await verifyOwner(body.password)) return reply({ error: "owner login failed" }, 403);
				const session = crypto.randomUUID() + crypto.randomUUID();
				await this.storage.put("session:" + session, Date.now() + 1800000);
				return reply({ session });
			}
			if (action === "/archive/upload") {
				const upload = validateUpload(body);
				const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.browser)))].map(byte => byte.toString(16).padStart(2, "0")).join("");
				const key = hash + ":" + upload.id;
				await this.storage.transaction(async storage => {
					const previous = await storage.get("chat:" + key);
					const now = Date.now();
					const records = { ["chat:" + key]: { key, name: upload.name || "browser " + hash.slice(0, 8), created: previous?.created || now, updated: now, count: Math.max(previous?.count || 0, upload.offset + upload.messages.length) } };
					upload.messages.forEach((message, index) => { records["message:" + key + ":" + String(upload.offset + index).padStart(6, "0")] = message; });
					await storage.put(records);
				});
				return reply({ saved: true });
			}
			if (!browserToken.test(body.session) || (await this.storage.get("session:" + body.session) || 0) <= Date.now()) return reply({ error: "owner login required" }, 403);
			if (action === "/archive/list") {
				if (body.after !== undefined && (typeof body.after !== "string" || !/^chat:[a-f0-9]{64}:[a-f0-9-]{36}$/i.test(body.after))) return reply({ error: "invalid cursor" }, 400);
				const rows = await this.storage.list({ prefix: "chat:", limit: 50, ...(body.after ? { startAfter: body.after } : {}) });
				return reply({ chats: [...rows.values()], next: rows.size === 50 ? [...rows.keys()].at(-1) : null });
			}
			if (action === "/archive/read") {
				if (typeof body.key !== "string" || !/^[a-f0-9]{64}:[a-f0-9-]{36}$/i.test(body.key) || !Number.isInteger(body.offset) || body.offset < 0 || body.offset > 10040) return reply({ error: "invalid chat" }, 400);
				const chat = await this.storage.get("chat:" + body.key);
				if (!chat) return reply({ error: "chat not found" }, 404);
				const prefix = "message:" + body.key + ":";
				const rows = await this.storage.list({ prefix, start: prefix + String(body.offset).padStart(6, "0"), limit: 100 });
				return reply({ chat, messages: [...rows.values()], next: body.offset + rows.size < chat.count ? body.offset + rows.size : null });
			}
			return reply({ error: "not found" }, 404);
		} catch { return reply({ error: "could not process archive request" }, 400); }
	}
}
