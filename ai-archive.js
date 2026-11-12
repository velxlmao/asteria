(() => {
	const endpoint = "https://asteria-ai.realdashvr.workers.dev/archive/";
	const pending = new Map();
	const uploaded = new Map();
	let uploading = false, retryTimer, session = "", owner = false, loggingIn = false, activeChat = null, cursor = null;
	function node(tag, text) { const el = document.createElement(tag); if (text) el.textContent = text; return el; }
	const syncStatus = node("p");
	syncStatus.className = "ai-archive-status";
	syncStatus.setAttribute("role", "status");
	document.querySelector(".ai-sidebar").append(syncStatus);
	async function request(path, body) {
		const response = await fetch(endpoint + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000), cache: "no-store" });
		const data = await response.json();
		if (!response.ok) { const error = new Error(data.error || "chat archive unavailable"); error.status = response.status; throw error; }
		return data;
	}
	async function upload() {
		if (uploading || !pending.size) return;
		clearTimeout(retryTimer);
		uploading = true;
		try {
			let browser = localStorage.getItem("asteria-ai-archive-browser");
			if (!/^[a-f0-9-]{72}$/i.test(browser || "")) { browser = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem("asteria-ai-archive-browser", browser); }
			while (pending.size) {
				const [id, chat] = pending.entries().next().value;
				const name = localStorage.getItem("asteria-chat-name") || "";
				const fingerprint = JSON.stringify([name, chat.messages]);
				if (uploaded.get(id) !== fingerprint) {
					syncStatus.textContent = "syncing chats for owner review…";
					for (let offset = 0; offset < Math.max(1, chat.messages.length); offset += 40) {
						await request("upload", { consent: "owner-review-v1", browser, name, id, offset, messages: chat.messages.slice(offset, offset + 40) });
					}
					uploaded.set(id, fingerprint);
				}
				if (pending.get(id) === chat) pending.delete(id);
			}
			syncStatus.textContent = "chats synced for owner review";
		} catch {
			syncStatus.textContent = "chat sync failed. retrying shortly…";
			retryTimer = setTimeout(upload, 30000);
		} finally { uploading = false; }
	}
	window.addEventListener("asteria-ai-sync", event => {
		for (const chat of event.detail) pending.set(chat.id, { id: chat.id, messages: chat.messages.map(({ role, content }) => ({ role, content })) });
		upload();
	});
	const open = node("button", "ai chats");
	open.type = "button";
	open.hidden = true;
	document.querySelector(".chat-channel-sidebar").append(open);
	const viewer = node("dialog");
	viewer.className = "ai-terms ai-archive-viewer";
	viewer.setAttribute("aria-labelledby", "ai-archive-title");
	const title = node("h2", "owner ai chat archive");
	title.id = "ai-archive-title";
	const note = node("p", "saved names are unverified. chat copies remain here when deleted locally.");
	const state = node("p");
	state.setAttribute("role", "status");
	const list = node("div");
	const refresh = node("button", "refresh");
	const more = node("button", "load more");
	const close = node("button", "close");
	for (const button of [refresh, more, close]) button.type = "button";
	more.hidden = true;
	close.onclick = () => viewer.close();
	viewer.append(title, note, state, refresh, more, close, list);
	document.body.append(viewer);
	let reading = false;
	async function load(append = false) {
		if (!owner || !session || reading) return;
		reading = true;
		refresh.disabled = more.disabled = true;
		state.textContent = "loading…";
		try {
			if (activeChat) {
				const data = await request("read", { session, key: activeChat, offset: append ? cursor : 0 });
				if (!owner || !viewer.open) return;
				if (!append) list.replaceChildren();
				title.textContent = data.chat.name + " · ai chat";
				for (const message of data.messages) {
					const row = node("article");
					row.className = "ai-archive-message";
					row.append(node("strong", message.role === "user" ? data.chat.name : "asteria ai"), node("p", message.content));
					list.append(row);
				}
				cursor = data.next;
			} else {
				const data = await request("list", { session, ...(append && cursor ? { after: cursor } : {}) });
				if (!owner || !viewer.open) return;
				if (!append) list.replaceChildren();
				title.textContent = "owner ai chat archive";
				for (const chat of data.chats.sort((a, b) => b.updated - a.updated)) {
					const button = node("button", chat.name + " · " + chat.count + " messages · " + new Date(chat.updated).toLocaleString());
					button.type = "button";
					button.className = "ai-archive-chat";
					button.onclick = () => { activeChat = chat.key; cursor = null; load(); };
					list.append(button);
				}
				cursor = data.next;
			}
			more.hidden = cursor === null;
			state.textContent = list.childElementCount ? "" : "no uploaded chats yet";
		} catch (error) { state.textContent = error.status === 403 ? "owner session expired. sign in again in public chat." : error.message; }
		finally { reading = false; refresh.disabled = more.disabled = false; }
	}
	refresh.onclick = () => { activeChat = null; cursor = null; load(); };
	more.onclick = () => load(true);
	open.onclick = () => { if (!owner) return; viewer.showModal(); activeChat = null; cursor = null; if (session) load(); else state.textContent = "sign in again as owner in public chat to reconnect the archive"; };
	window.addEventListener("velx-owner-state", async event => {
		owner = event.detail === true;
		open.hidden = !owner;
		if (!owner) { session = ""; list.replaceChildren(); viewer.close(); return; }
		if (session || loggingIn) return;
		loggingIn = true;
		open.disabled = true;
		open.textContent = "connecting ai archive…";
		try {
			const data = await request("login", { password: document.getElementById("chat-password").value });
			if (owner) session = data.session;
		} catch { open.textContent = "ai archive login failed"; }
		finally { loggingIn = false; open.disabled = false; if (session) open.textContent = "ai chats"; }
	});
	setInterval(() => { if (viewer.open && owner && !document.hidden) load(); }, 10000);
})();
