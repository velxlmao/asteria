(() => {
	function element(tag, className, text) {
		const node = document.createElement(tag);
		node.className = className;
		if (text) node.textContent = text;
		return node;
	}
	const button = element("button", "nav-btn", "AI");
	button.id = "nav-ai";
	button.title = "ai";
	button.setAttribute("aria-label", "ai chat");
	document.getElementById("sidebar").append(button);
	const page = element("section", "fullpage ai-page");
	page.id = "ai-page";
	page.hidden = true;
	const aside = element("aside", "ai-sidebar");
	const newChat = element("button", "", "new chat");
	const chatsList = element("div", "ai-chats");
	aside.append(newChat, chatsList);
	const main = element("main", "ai-main");
	const heading = element("header", "", "asteria ai");
	const messages = element("div", "ai-messages");
	const form = element("form", "ai-compose");
	const input = element("textarea", "");
	input.placeholder = "message";
	input.setAttribute("aria-label", "message ai");
	input.maxLength = 12000;
	input.required = true;
	const send = element("button", "", "send");
	send.type = "submit";
	const status = element("p", "ai-status");
	status.setAttribute("role", "status");
	form.append(input, send);
	main.append(heading, messages, status, form);
	page.append(aside, main);
	document.body.append(page);
	let chats;
	try { chats = JSON.parse(localStorage.getItem("asteria-ai-chats") || "[]"); } catch { chats = []; }
	if (!Array.isArray(chats)) chats = [];
	let current = chats[0];
	let busy = false;
	function save() { localStorage.setItem("asteria-ai-chats", JSON.stringify(chats)); }
	function render() {
		messages.replaceChildren();
		chatsList.replaceChildren();
		for (const chat of chats) {
			const row = element("div", "ai-chat-row");
			const open = element("button", chat === current ? "active" : "", chat.messages[0]?.content.slice(0, 35) || "new chat");
			open.disabled = busy;
			open.onclick = () => { current = chat; render(); };
			const remove = element("button", "", "×");
			remove.setAttribute("aria-label", "delete chat");
			remove.disabled = busy;
			remove.onclick = () => { chats = chats.filter(item => item !== chat); if (current === chat) current = chats[0]; save(); render(); };
			row.append(open, remove);
			chatsList.append(row);
		}
		for (const message of current?.messages || []) {
			const row = element("article", "ai-message " + message.role);
			row.append(element("strong", "", message.role === "user" ? "you" : "asteria ai"), element("p", "", message.content));
			messages.append(row);
		}
		messages.scrollTop = messages.scrollHeight;
	}
	newChat.onclick = () => { if (busy) return; current = { id: crypto.randomUUID(), messages: [] }; chats.unshift(current); save(); render(); input.focus(); };
	form.addEventListener("submit", async event => {
		event.preventDefault();
		if (busy || !input.value.trim()) return;
		if (!current) newChat.click();
		const prompt = input.value.trim();
		const history = [...current.messages.slice(-38), { role: "user", content: prompt }];
		current.messages.push({ role: "user", content: prompt });
		input.value = "";
		busy = true;
		send.disabled = newChat.disabled = true;
		status.textContent = "thinking…";
		render();
		try {
			const response = await fetch("https://asteria-ai.realdashvr.workers.dev/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history }), signal: AbortSignal.timeout(95000) });
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || "request failed");
			current.messages.push({ role: "assistant", content: data.content });
			status.textContent = "";
		} catch (error) { current.messages.pop(); input.value = prompt; status.textContent = error.message; }
		finally { busy = false; send.disabled = newChat.disabled = false; save(); render(); }
	});
	input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
	render();
})();
