(() => {
	if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
	const canvas = document.createElement("canvas");
	canvas.id = "reactive-paint";
	canvas.setAttribute("aria-hidden", "true");
	document.body.prepend(canvas);
	const context = canvas.getContext("2d");
	if (!context) return;
	const particles = [];
	let frame = 0;
	let lastTime = 0;
	let lastPointer;
	function resize() {
		canvas.width = Math.ceil(innerWidth / 2);
		canvas.height = Math.ceil(innerHeight / 2);
	}
	function draw(time) {
		frame = 0;
		const elapsed = Math.min((time - lastTime) / 16.67 || 1, 3);
		lastTime = time;
		context.clearRect(0, 0, canvas.width, canvas.height);
		for (let index = particles.length - 1; index >= 0; index--) {
			const particle = particles[index];
			particle.life -= .009 * elapsed;
			if (particle.life <= 0) { particles.splice(index, 1); continue; }
			particle.angle += .035 * elapsed;
			particle.x += (Math.cos(particle.angle) * .7 + particle.vx) * elapsed;
			particle.y += (Math.sin(particle.angle) * .7 + particle.vy) * elapsed;
			particle.vx *= .96;
			particle.vy *= .96;
			const radius = 24 + (1 - particle.life) * 26;
			const gradient = context.createRadialGradient(particle.x, particle.y, 0, particle.x, particle.y, radius);
			gradient.addColorStop(0, `hsla(${particle.hue}, 85%, 58%, ${particle.life * .1})`);
			gradient.addColorStop(1, "transparent");
			context.fillStyle = gradient;
			context.fillRect(particle.x - radius, particle.y - radius, radius * 2, radius * 2);
		}
		if (particles.length && !document.hidden) frame = requestAnimationFrame(draw);
	}
	window.addEventListener("pointermove", (event) => {
		if (document.body.classList.contains("view-mode")) return;
		const x = event.clientX / 2;
		const y = event.clientY / 2;
		const dx = lastPointer ? x - lastPointer.x : 0;
		const dy = lastPointer ? y - lastPointer.y : 0;
		lastPointer = { x, y };
		particles.push({ x, y, vx: Math.max(-3, Math.min(3, dx * .12)), vy: Math.max(-3, Math.min(3, dy * .12)), angle: Math.atan2(dy, dx) + Math.PI / 2, hue: 270 + Math.random() * 25, life: 1 });
		if (particles.length > 80) particles.shift();
		if (!frame) { lastTime = performance.now(); frame = requestAnimationFrame(draw); }
	}, { passive: true });
	document.documentElement.addEventListener("pointerleave", () => { lastPointer = undefined; });
	window.addEventListener("resize", resize);
	resize();
})();
