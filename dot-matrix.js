(() => {
	const canvas = document.createElement("canvas");
	canvas.id = "dot-matrix";
	canvas.setAttribute("aria-hidden", "true");
	document.body.prepend(canvas);
	const context = canvas.getContext("2d");
	if (!context) return;
	const reduced = matchMedia("(prefers-reduced-motion: reduce)");
	let pointer;
	let pending = false;
	function draw() {
		pending = false;
		context.clearRect(0, 0, canvas.width, canvas.height);
		context.fillStyle = "rgb(199, 164, 245)";
		context.globalAlpha = .75;
		for (let y = 16; y < canvas.height; y += 36) for (let x = 16; x < canvas.width; x += 36) {
			let offsetX = 0, offsetY = 0;
			if (pointer && !reduced.matches) {
				const dx = x - pointer.x, dy = y - pointer.y;
				const distance = Math.hypot(dx, dy);
				const force = Math.max(0, 1 - distance / 140) ** 2 * 18;
				offsetX = dx / (distance || 1) * force;
				offsetY = dy / (distance || 1) * force;
			}
			context.fillRect(Math.max(1, Math.min(canvas.width - 2, x + offsetX)), Math.max(1, Math.min(canvas.height - 2, y + offsetY)), 2, 2);
		}
	}
	function schedule() {
		if (pending) return;
		pending = true;
		setTimeout(draw, 65);
	}
	window.addEventListener("pointermove", event => {
		if (document.hidden || document.body.classList.contains("view-mode") || document.getElementById("calculator-cover")) return;
		pointer = { x: event.clientX, y: event.clientY };
		schedule();
	}, { passive: true });
	document.documentElement.addEventListener("pointerleave", () => { pointer = undefined; schedule(); });
	function resize() { canvas.width = innerWidth; canvas.height = innerHeight; draw(); }
	window.addEventListener("resize", resize);
	resize();
})();
