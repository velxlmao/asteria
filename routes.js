(() => {
	document.documentElement.classList.add("separate-page");
	const home = document.getElementById("home");
	const pageButtons = ["nav-games", "nav-apps", "nav-chat", "nav-ai", "nav-settings"];
	for (const id of pageButtons) {
		document.getElementById(id).addEventListener("click", () => {
			home.hidden = true;
			if (id === "nav-settings") window.dispatchEvent(new Event("asteria-browser-navigate"));
			else {
				const settings = document.getElementById("settings-overlay");
				settings.hidden = true;
				settings.classList.remove("open", "closing");
			}
			for (const page of document.querySelectorAll(".fullpage")) {
				if (id === "nav-settings") { page.hidden = true; page.classList.remove("open", "closing"); }
			}
		});
	}
	function showHome() {
		home.hidden = false;
		for (const page of document.querySelectorAll(".fullpage")) { page.hidden = true; page.classList.remove("open", "closing"); }
		const settings = document.getElementById("settings-overlay");
		settings.hidden = true;
		settings.classList.remove("open", "closing");
	}
	document.getElementById("nav-home").addEventListener("click", showHome);
	document.getElementById("browser-menu").addEventListener("click", showHome);
	document.getElementById("settings-close").addEventListener("click", showHome);
})();
