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
	const share = element("button", "ai-share", "screenshare");
	share.type = "button";
	const floating = element("button", "ai-float", "float over tabs");
	floating.type = "button";
	floating.hidden = true;
	heading.append(share, floating);
	let screenStream;
	let screenVideo;
	let floatingWindow;
	function stopSharing() {
		for (const track of screenStream?.getTracks() || []) track.stop();
		screenStream = null;
		screenVideo?.remove();
		screenVideo = null;
		share.textContent = "screenshare";
		floating.hidden = true;
		page.classList.remove("ai-sharing");
		floatingWindow?.close();
		status.textContent = "screenshare stopped";
	}
	share.addEventListener("click", async () => {
		if (screenStream) return stopSharing();
		if (!navigator.mediaDevices?.getDisplayMedia) { status.textContent = "screenshare is unavailable in this browser"; return; }
		try {
			screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "browser" }, audio: false, preferCurrentTab: false, selfBrowserSurface: "exclude", surfaceSwitching: "include" });
			screenVideo = document.createElement("video");
			screenVideo.muted = true;
			screenVideo.srcObject = screenStream;
			await screenVideo.play();
			screenStream.getVideoTracks()[0].addEventListener("ended", stopSharing, { once: true });
			share.textContent = "stop sharing";
			page.classList.add("ai-sharing");
			floating.hidden = !window.documentPictureInPicture;
			status.textContent = "each question sends a screenshot to the ai provider";
		} catch (error) { if (screenStream) stopSharing(); status.textContent = error.name === "NotAllowedError" ? "screen sharing cancelled or denied" : "could not start screenshare"; }
	});
	floating.addEventListener("click", async () => {
		try {
			floatingWindow = await window.documentPictureInPicture.requestWindow({ width: 400, height: 520 });
			const doc = floatingWindow.document;
			for (const sheet of document.querySelectorAll('link[rel="stylesheet"]')) {
				const link = doc.createElement("link");
				link.rel = "stylesheet";
				link.href = sheet.href;
				doc.head.append(link);
			}
			doc.documentElement.dataset.theme = document.documentElement.dataset.theme || "";
			doc.body.className = "ai-pip";
			doc.body.append(main);
			floating.hidden = true;
			floatingWindow.addEventListener("pagehide", () => { page.append(main); floatingWindow = null; floating.hidden = !screenStream; });
		} catch { status.textContent = "could not open floating window"; }
	});
	function screenshot() {
		if (!screenStream) return undefined;
		if (screenStream.getVideoTracks()[0].readyState !== "live" || !screenVideo.videoWidth) throw new Error("screen is unavailable, share the tab again");
		const canvas = document.createElement("canvas");
		const scale = Math.min(1, 1440 / screenVideo.videoWidth);
		canvas.width = Math.round(screenVideo.videoWidth * scale);
		canvas.height = Math.round(screenVideo.videoHeight * scale);
		canvas.getContext("2d").drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
		return canvas.toDataURL("image/jpeg", .78);
	}
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
			const image = screenshot();
			const response = await fetch("https://asteria-ai.realdashvr.workers.dev/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: history, image }), signal: AbortSignal.timeout(95000) });
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
