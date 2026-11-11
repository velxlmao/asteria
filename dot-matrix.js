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
		for (let y = 16; y < innerHeight; y += 32) {
			for (let x = 16; x < innerWidth; x += 32) {
				const dot = document.createElement("i");
				dot.style.left = x + "px";
				dot.style.top = y + "px";
				matrix.append(dot);
				dots.push({ dot, x, y, moved: false });
			}
		}
	}
	resize();
	window.addEventListener("resize", resize);
	let frame;
	window.addEventListener("pointermove", (event) => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			if (reduced.matches || document.hidden || document.body.classList.contains("view-mode") || document.getElementById("calculator-cover")) return;
			for (const point of dots) {
				const { dot, x, y } = point;
				const dx = x - event.clientX;
				const dy = y - event.clientY;
				if (Math.abs(dx) > 150 || Math.abs(dy) > 150) {
					if (point.moved) { dot.style.translate = "0 0"; point.moved = false; }
					continue;
				}
				const distance = Math.hypot(dx, dy);
				const force = Math.max(0, 1 - distance / 150) ** 2 * 24;
				dot.style.translate = `${dx / (distance || 1) * force}px ${dy / (distance || 1) * force}px`;
				point.moved = true;
			}
		});
	}, { passive: true });
	document.documentElement.addEventListener("pointerleave", () => {
		cancelAnimationFrame(frame);
		for (const { dot } of dots) dot.style.translate = "0 0";
	});
})();
