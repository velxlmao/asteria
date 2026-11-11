(() => {
	const routes = { "nav-home": "index.html", "nav-games": "games.html", "nav-apps": "apps.html", "nav-chat": "chat.html", "nav-ai": "ai.html", "nav-settings": "settings.html" };
	const current = location.pathname.split("/").pop() || "index.html";
	let initializing = true;
	document.addEventListener("click", event => {
		if (initializing) return;
		const target = event.target.closest("button");
		if (!target) return;
		const destination = routes[target.id] || (target.matches("[data-close], #settings-close, #browser-menu") ? "index.html" : undefined);
		if (!destination) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		if (destination !== current) location.assign(destination);
	}, true);
	const active = Object.keys(routes).find(id => routes[id] === current);
	if (active && current !== "index.html") {
		document.documentElement.classList.add("separate-page");
		document.getElementById("home").hidden = true;
		document.getElementById(active)?.click();
	}
	initializing = false;
})();
