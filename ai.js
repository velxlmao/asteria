(() => {
	function element(tag, className, text) {
		const node = document.createElement(tag);
		node.className = className;
		if (text) node.textContent = text;
		return node;
	}
	const button = element("button", "nav-btn");
	const robot = document.createElementNS("http://www.w3.org/2000/svg", "svg");
	robot.setAttribute("viewBox", "0 0 24 24");
	robot.setAttribute("fill", "none");
	robot.setAttribute("stroke", "currentColor");
	robot.setAttribute("stroke-width", "1.7");
	robot.setAttribute("stroke-linecap", "round");
	robot.setAttribute("stroke-linejoin", "round");
	robot.setAttribute("aria-hidden", "true");
	const robotPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
	robotPath.setAttribute("d", "M12 3v3M9 3h3M5 8h14v12H5zM2 12v4m20-4v4M9 12v2m6-2v2m-6 3h6");
	robot.append(robotPath);
	button.append(robot);
	button.id = "nav-ai";
	button.title = "ai";
	button.setAttribute("aria-label", "ai chat");
	document.getElementById("sidebar").insertBefore(button, document.getElementById("nav-settings"));
	const page = element("section", "fullpage ai-page");
	page.id = "ai-page";
	page.hidden = true;
	const aside = element("aside", "ai-sidebar");
	const newChat = element("button", "", "new chat");
	const chatsList = element("div", "ai-chats");
	aside.append(newChat, chatsList);
	const main = element("main", "ai-main");
	const heading = element("header", "ai-heading");
	const wordmark = element("h1", "ai-wordmark", "asteria ai");
	const share = element("button", "ai-share", "screenshare");
	share.type = "button";
	const floating = element("button", "ai-float", "float over tabs");
	floating.type = "button";
	floating.hidden = true;
	heading.append(wordmark);
	const screenTools = element("div", "ai-screen-tools");
	screenTools.append(share, floating);
	let screenStream;
	let screenVideo;
	let floatingWindow;
	let choosingScreen = false;
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
		if (choosingScreen) return;
		if (screenStream) return stopSharing();
		if (!navigator.mediaDevices?.getDisplayMedia) { status.textContent = "screenshare is unavailable in this browser"; return; }
		try {
			choosingScreen = true;
			share.disabled = true;
			share.textContent = "choose a tab…";
			const controller = window.CaptureController ? new window.CaptureController() : undefined;
			controller?.setFocusBehavior?.("focus-captured-surface");
			screenStream = await navigator.mediaDevices.getDisplayMedia({ controller, video: { displaySurface: "browser" }, audio: false, preferCurrentTab: false, selfBrowserSurface: "exclude", surfaceSwitching: "include" });
			const track = screenStream.getVideoTracks()[0];
			if (!track || track.readyState !== "live") throw new Error("capture ended");
			track.addEventListener("ended", stopSharing, { once: true });
			screenVideo = document.createElement("video");
			screenVideo.muted = true;
			screenVideo.playsInline = true;
			screenVideo.srcObject = screenStream;
			await screenVideo.play();
			if (track.readyState !== "live") throw new Error("capture ended");
			share.textContent = "stop sharing";
			page.classList.add("ai-sharing");
			floating.hidden = Boolean(floatingWindow) || !window.documentPictureInPicture;
			status.textContent = "each question sends a screenshot to the ai provider";
			if (window.documentPictureInPicture) await openFloating();
		} catch (error) { stopSharing(); status.textContent = error.name === "NotAllowedError" ? "screen sharing cancelled or denied" : "could not start screenshare"; }
		finally { choosingScreen = false; share.disabled = false; }
	});
	async function openFloating() {
		if (!screenStream) return;
		if (floatingWindow && !floatingWindow.closed) { floatingWindow.focus(); return; }
		try {
			floatingWindow = await window.documentPictureInPicture.requestWindow({ width: 400, height: 520 });
			if (!screenStream) { floatingWindow.close(); floatingWindow = null; return; }
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
		} catch { floating.hidden = false; status.textContent = "sharing started. click float over tabs to open the ai window"; }
	}
	floating.addEventListener("click", openFloating);
	function screenshot() {
		if (!screenStream) return undefined;
		if (screenStream.getVideoTracks()[0]?.readyState !== "live" || !screenVideo?.videoWidth) throw new Error("screen is unavailable, share the tab again");
		const canvas = document.createElement("canvas");
		const scale = Math.min(1, 1440 / screenVideo.videoWidth);
		canvas.width = Math.round(screenVideo.videoWidth * scale);
		canvas.height = Math.round(screenVideo.videoHeight * scale);
		canvas.getContext("2d").drawImage(screenVideo, 0, 0, canvas.width, canvas.height);
		return canvas.toDataURL("image/jpeg", .78);
	}
	const messages = element("div", "ai-messages");
	const welcome = element("section", "ai-welcome");
	const greeting = element("h2", "", "what can i ");
	const greetingPhrases = ["help with?", "do for you?", "imagine?", "improve?", "create?", "explain?", "explore?", "build?"];
	const greetingPhrase = element("span", "ai-greeting-phrase", greetingPhrases[0]);
	greeting.append(greetingPhrase);
	let greetingIndex = 0;
	setInterval(async () => {
		if (welcome.hidden || main.ownerDocument.hidden) return;
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
		if (!reducedMotion) await greetingPhrase.animate([{ opacity: 1, transform: "translateY(0)" }, { opacity: 0, transform: "translateY(-8px)" }], { duration: 180, easing: "ease-in", fill: "forwards" }).finished;
		greetingIndex = (greetingIndex + 1) % greetingPhrases.length;
		greetingPhrase.textContent = greetingPhrases[greetingIndex];
		if (!reducedMotion) greetingPhrase.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 260, easing: "ease-out", fill: "forwards" });
	}, 2000);
	welcome.append(greeting);
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
	main.append(heading, welcome, messages, status, form, screenTools);
	page.append(aside, main);
	document.body.append(page);
	let chats;
	try { chats = JSON.parse(localStorage.getItem("asteria-ai-chats") || "[]"); } catch { chats = []; }
	if (!Array.isArray(chats)) chats = [];
	let current = chats[0];
	let busy = false;
	function save() { localStorage.setItem("asteria-ai-chats", JSON.stringify(chats)); }
	function render() {
		const hasMessages = Boolean(current?.messages.length);
		main.classList.toggle("has-messages", hasMessages);
		welcome.hidden = hasMessages;
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
