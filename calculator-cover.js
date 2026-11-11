(() => {
	const cover = document.createElement("iframe");
	cover.id = "calculator-cover";
	cover.title = "Graphing Calculator";
	cover.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:10000;background:white;transition:opacity .2s ease";
	document.body.append(cover);
	cover.src = "calculator.html";
	cover.addEventListener("load", () => {
		let doc;
		try { doc = cover.contentDocument; } catch { return; }
		if (!doc) return;
		const initialize = () => {
			const engine = cover.contentWindow.Desmos;
			if (!engine?.GraphingCalculator) return false;
			if (doc.querySelector(".dcg-expressionitem")) return true;
			const host = doc.createElement("div");
			host.style.cssText = "position:fixed;inset:0;background:white;z-index:100000";
			doc.body.append(host);
			engine.GraphingCalculator(host, { expressions: true, keypad: true, settingsMenu: true });
			return true;
		};
		let attempts = 0;
		const timer = setInterval(() => {
			attempts++;
			if (initialize() || attempts > 60) clearInterval(timer);
		}, 250);
		doc.addEventListener("click", event => {
			const button = event.target.closest("button,[role=button],.dcg-btn-blue");
			if (!button || button.textContent.trim().toLowerCase() !== "all") return;
			const first = doc.querySelector(".dcg-expressionitem");
			const text = first?.querySelector(".dcg-mq-root-block")?.textContent.replace(/\s/g, "").toLowerCase();
			if (text !== "asteria") return;
			cover.style.opacity = "0";
			document.documentElement.classList.add("calculator-unlocked");
			document.getElementById("app")?.classList.add("revealed");
			setTimeout(() => cover.remove(), 220);
		}, true);
	});
})();
