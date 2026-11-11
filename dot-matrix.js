(() => {
	const matrix = document.createElement("div");
	matrix.id = "dot-matrix";
	matrix.setAttribute("aria-hidden", "true");
	document.body.prepend(matrix);
	const dots = [];
	const reduced = matchMedia("(prefers-reduced-motion: reduce)");
	function resize() {
		matrix.replaceChildren();
		dots.length = 0;
		for (let y = 13; y < innerHeight; y += 26) {
			for (let x = 13; x < innerWidth; x += 26) {
				const dot = document.createElement("i");
				dot.style.left = x + "px";
				dot.style.top = y + "px";
				matrix.append(dot);
				dots.push({ dot, x, y });
			}
		}
	}
	resize();
	window.addEventListener("resize", resize);
	let frame;
	window.addEventListener("pointermove", (event) => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			if (reduced.matches) return;
			for (const { dot, x, y } of dots) {
				const dx = x - event.clientX;
				const dy = y - event.clientY;
				const distance = Math.hypot(dx, dy);
				const force = Math.max(0, 1 - distance / 150) ** 2 * 24;
				dot.style.translate = `${dx / (distance || 1) * force}px ${dy / (distance || 1) * force}px`;
			}
		});
	}, { passive: true });
	document.documentElement.addEventListener("pointerleave", () => {
		cancelAnimationFrame(frame);
		for (const { dot } of dots) dot.style.translate = "0 0";
	});
})();
