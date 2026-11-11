(() => {
	const canvas = document.createElement("canvas");
	canvas.id = "reactive-paint";
	canvas.setAttribute("aria-hidden", "true");
	document.body.prepend(canvas);
	const context = canvas.getContext("2d");
	if (!context) return;
	const reduced = matchMedia("(prefers-reduced-motion: reduce)");
	const clouds = [{ x: .26, y: .35, hue: 270 }, { x: .7, y: .65, hue: 286 }];
	let pointer;
	let pending;
	let phase = 0;
	function draw() {
		pending = undefined;
		const width = canvas.width, height = canvas.height;
		context.clearRect(0, 0, width, height);
		const radius = Math.min(width * .24, height * .38);
		for (const cloud of clouds) {
			const homeX = cloud.x * width, homeY = cloud.y * height;
			const dx = pointer ? homeX - pointer.x : 0, dy = pointer ? homeY - pointer.y : 0;
			const strength = pointer ? Math.max(0, 1 - Math.hypot(dx, dy) / (radius * 2)) : 0;
			for (let layer = 0; layer < 4; layer++) {
				const angle = phase + layer * 1.6;
				const x = Math.max(radius + 2, Math.min(width - radius - 2, homeX + Math.cos(angle) * strength * radius * .16));
				const y = Math.max(radius + 2, Math.min(height - radius - 2, homeY + Math.sin(angle) * strength * radius * .16));
				const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
				gradient.addColorStop(0, `hsla(${cloud.hue + layer * 3},85%,62%,.22)`);
				gradient.addColorStop(.55, `hsla(${cloud.hue},85%,55%,.09)`);
				gradient.addColorStop(1, "transparent");
				context.fillStyle = gradient;
				context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
			}
		}
	}
	function schedule() {
		if (pending !== undefined) return;
		pending = setTimeout(draw, 100);
	}
	window.addEventListener("pointermove", event => {
		if (reduced.matches || document.hidden || document.body.classList.contains("view-mode") || document.getElementById("calculator-cover")) return;
		pointer = { x: event.clientX / innerWidth * canvas.width, y: event.clientY / innerHeight * canvas.height };
		phase += .04;
		schedule();
	}, { passive: true });
	document.documentElement.addEventListener("pointerleave", () => { pointer = undefined; schedule(); });
	function resize() {
		canvas.width = 192;
		canvas.height = Math.max(64, Math.min(256, Math.round(192 * innerHeight / innerWidth)));
		draw();
	}
	window.addEventListener("resize", resize);
	resize();
})();
