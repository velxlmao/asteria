(() => {
	const cover = document.createElement("iframe");
	cover.title = "Graphing Calculator";
	cover.style.cssText = "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:10000;background:white;transition:opacity .2s ease";
	document.body.append(cover);
	fetch("calculator.html").then(response => {
		if (!response.ok) throw new Error("calculator unavailable");
		return response.text();
	}).then(html => {
		cover.srcdoc = html.replace("<head>", '<head><base href="https://www.desmos.com/">');
	}).catch(() => { cover.src = "https://www.desmos.com/calculator"; });
	cover.addEventListener("load", () => {
		let doc;
		try { doc = cover.contentDocument; } catch { return; }
		if (!doc) return;
		doc.addEventListener("click", event => {
			const button = event.target.closest("button,[role=button],.dcg-btn-blue");
			if (!button || button.textContent.trim().toLowerCase() !== "all") return;
			const first = doc.querySelector(".dcg-expressionitem");
			const text = first?.querySelector(".dcg-mq-root-block")?.textContent.replace(/\s/g, "").toLowerCase();
			if (text !== "asteria") return;
			cover.style.opacity = "0";
			document.getElementById("app")?.classList.add("revealed");
			setTimeout(() => cover.remove(), 220);
		}, true);
	});
})();
