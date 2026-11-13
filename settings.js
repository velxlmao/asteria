"use strict";
(() => {
	const themes = [
		{ id: "", bg: "#100b18", accent: "#a855f7" },
		{ id: "slate", bg: "#130d20", accent: "#8b5cf6" },
		{ id: "forest", bg: "#0e1512", accent: "#5fab84" },
		{ id: "plum", bg: "#14101a", accent: "#a07fc9" },
		{ id: "light", bg: "#eef1f5", accent: "#8b3fd1" },
	];

	const overlay = document.getElementById("settings-overlay");
	const btnSettings = document.getElementById("nav-settings");
	const btnHome = document.getElementById("nav-home");
	const btnClose = document.getElementById("settings-close");
	const swatchWrap = document.getElementById("theme-swatches");

	let current = "";
	try {
		current = localStorage.getItem("asteria-theme") || "";
	} catch (e) {}

	function apply(id) {
		if (id) document.documentElement.dataset.theme = id;
		else delete document.documentElement.dataset.theme;
		try {
			if (id) localStorage.setItem("asteria-theme", id);
			else localStorage.removeItem("asteria-theme");
		} catch (e) {}
		current = id;
		for (const el of swatchWrap.children)
			el.classList.toggle("active", el.dataset.id === id);
	}

	for (const t of themes) {
		const b = document.createElement("button");
		b.className = "swatch";
		b.dataset.id = t.id;
		b.title = t.id || "default";
		b.setAttribute("aria-label", (t.id || "default") + " theme");
		b.style.background = t.bg;
		b.style.borderColor = t.accent;
		b.addEventListener("click", () => apply(t.id));
		swatchWrap.appendChild(b);
	}
	apply(current);

	function makeOverlay(overlayEl, navBtn, closeBtn) {
		let animating = false;
		function open() {
			closeAll(overlayEl);
			overlayEl.hidden = false;
			overlayEl.classList.remove("closing");
			overlayEl.classList.add("open");
			navBtn.classList.add("active");
		}
		function close() {
			if (overlayEl.hidden || animating) return;
			animating = true;
			overlayEl.classList.remove("open");
			overlayEl.classList.add("closing");
			navBtn.classList.remove("active");
			const done = (e) => {
				if (e.target !== overlayEl) return;
				overlayEl.removeEventListener("animationend", done);
				overlayEl.hidden = true;
				overlayEl.classList.remove("closing");
				animating = false;
			};
			overlayEl.addEventListener("animationend", done);
		}
		navBtn.addEventListener("click", () =>
			overlayEl.hidden ? open() : close()
		);
		closeBtn.addEventListener("click", close);
		overlayEl.addEventListener("click", (e) => {
			if (e.target === overlayEl) close();
		});
		return { open, close };
	}

	const overlays = [];
	function closeAll(except) {
		overlays.forEach((o) => o.el !== except && o.ctl.close());
	}

	// lets other scripts (links.js) add panels that behave the same way
	window.__veloOverlay = (el, navBtn, closeBtn) => {
		const ctl = makeOverlay(el, navBtn, closeBtn);
		overlays.push({ el, ctl });
		return ctl;
	};

	const settings = {
		open() {
			closeAll(overlay);
			overlay.hidden = false;
			overlay.classList.remove("closing");
			overlay.classList.add("open");
			btnSettings.classList.add("active");
		},
		close() {
			overlay.hidden = true;
			overlay.classList.remove("open", "closing");
			btnSettings.classList.remove("active");
		},
	};
	btnSettings.addEventListener("click", settings.open);
	btnClose.addEventListener("click", settings.close);
	const notificationsNav=document.createElement("button");
	notificationsNav.type="button";notificationsNav.textContent="notifications";
	notificationsNav.dataset.settingsCategory="notifications";notificationsNav.setAttribute("aria-controls","settings-notifications");notificationsNav.setAttribute("aria-pressed","false");
	const categoryNav=document.querySelector(".settings-categories");
	if(categoryNav)categoryNav.append(notificationsNav);
	const notificationsSection=document.createElement("section");notificationsSection.id="settings-notifications";notificationsSection.className="settings-category";notificationsSection.hidden=true;
	const notificationsTitle=document.createElement("h3");notificationsTitle.id="settings-notifications-title";notificationsTitle.textContent="notifications";notificationsSection.setAttribute("aria-labelledby",notificationsTitle.id);
	const notificationsLabel=document.createElement("label");notificationsLabel.className="setting row";
	const notificationsText=document.createElement("span");notificationsText.className="setting-label";notificationsText.textContent="show chat notifications in the top right";
	const notificationsToggle=document.createElement("input");notificationsToggle.type="checkbox";notificationsToggle.id="chat-notifications-toggle";notificationsToggle.setAttribute("role","switch");
	function readNotifications(){try{return localStorage.getItem("asteria-chat-notifications")!=="off";}catch{return true;}}
	notificationsToggle.checked=readNotifications();
	notificationsToggle.addEventListener("change",()=>{try{localStorage.setItem("asteria-chat-notifications",notificationsToggle.checked?"on":"off");}catch{}window.dispatchEvent(new CustomEvent("asteria-notifications-change",{detail:notificationsToggle.checked}));});
	window.addEventListener("storage",event=>{if(event.key==="asteria-chat-notifications")notificationsToggle.checked=readNotifications();});
	notificationsLabel.append(notificationsText,notificationsToggle);notificationsSection.append(notificationsTitle,notificationsLabel);
	const categoryContent=document.querySelector(".settings-content");
	(categoryContent||document.getElementById("settings-panel")).append(notificationsSection);if(!categoryContent)notificationsSection.hidden=false;
	for (const button of document.querySelectorAll("[data-settings-category]")) {
		button.addEventListener("click", () => {
			for (const category of document.querySelectorAll(".settings-category")) category.hidden = category.id !== button.getAttribute("aria-controls");
			for (const option of document.querySelectorAll("[data-settings-category]")) option.setAttribute("aria-pressed", String(option === button));
		});
	}
	overlays.push({ el: overlay, ctl: settings });

	btnHome.addEventListener("click", () => {
		closeAll(null);
		const view = document.getElementById("view");
		const home = document.getElementById("home");
		if (view && !view.hidden) {
			view.hidden = true;
			home.hidden = false;
			const a = document.getElementById("sj-address");
			if (a) a.value = "";
			document.body.classList.remove("view-mode");
			document.getElementById("sidebar").classList.remove("peek");
		}
	});

	// ---- decoy / panic settings (persisted) ----
	const store = {
		get(k, d) {
			try {
				const v = localStorage.getItem(k);
				return v === null ? d : v;
			} catch (e) {
				return d;
			}
		},
		set(k, v) {
			try {
				localStorage.setItem(k, v);
			} catch (e) {}
		},
	};

	const bindPanic = document.getElementById("bind-panic");
	const panicType = document.getElementById("panic-type");

	// panic key bind
	function keyLabel(k) {
		if (k === " ") return "Space";
		return k.length === 1 ? k : k;
	}
	bindPanic.textContent = keyLabel(store.get("asteria-panic-key", "`"));
	bindPanic.addEventListener("click", () => {
		bindPanic.classList.add("binding");
		bindPanic.textContent = "press a key";
		window.__bindingPanic = true;
		const onKey = (e) => {
			e.preventDefault();
			e.stopPropagation();
			if (e.key === "Escape") {
				// cancel
			} else {
				store.set("asteria-panic-key", e.key);
			}
			bindPanic.textContent = keyLabel(store.get("asteria-panic-key", "`"));
			bindPanic.classList.remove("binding");
			window.__bindingPanic = false;
			window.removeEventListener("keydown", onKey, true);
		};
		window.addEventListener("keydown", onKey, true);
	});

	// panic type
	panicType.value = store.get("asteria-panic-type", "decoy");
	panicType.addEventListener("change", () => {
		store.set("asteria-panic-type", panicType.value);
	});

	// confirm-before-closing (on by default)
	const toggleAnticlose = document.getElementById("toggle-anticlose");
	if (toggleAnticlose) {
		// a NON-empty returnValue is required for the prompt to show
		// reliably; an empty string is spec-allowed to be ignored.
		const beforeUnload = (e) => {
			e.preventDefault();
			e.returnValue = "Leave asteria?";
			return "Leave asteria?";
		};
		const applyAnticlose = () => {
			const on = store.get("asteria-anticlose", "1") !== "0";
			toggleAnticlose.setAttribute("aria-checked", on ? "true" : "false");
			window.removeEventListener("beforeunload", beforeUnload);
			if (on) window.addEventListener("beforeunload", beforeUnload);
		};
		applyAnticlose();
		toggleAnticlose.addEventListener("click", () => {
			const on = toggleAnticlose.getAttribute("aria-checked") === "true";
			store.set("asteria-anticlose", on ? "0" : "1");
			applyAnticlose();
		});
	}

	store.set("asteria-cloak", "0");
	const toggleCloak = document.getElementById("toggle-cloak");
	if (toggleCloak) {
		toggleCloak.setAttribute("aria-checked", "false");
		toggleCloak.disabled = true;
		toggleCloak.title = "disabled";
	}
})();
