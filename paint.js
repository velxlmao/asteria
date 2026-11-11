(() => {
	const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
	const canvas = document.createElement("canvas");
	canvas.id = "reactive-paint";
	canvas.setAttribute("aria-hidden", "true");
	document.body.prepend(canvas);
	const context = canvas.getContext("2d", { alpha: true });
	if (!context) return;
	let width, height, velocityX, velocityY, nextX, nextY, dye, nextDye, pressure, nextPressure, divergence, pixels;
	let pointer;
	let lastFrame = 0;
	const sources = [[.22, .35], [.75, .65], [.48, .82]];
	function resize() {
		width = 96;
		height = Math.max(32, Math.min(160, Math.round(width * innerHeight / innerWidth)));
		canvas.width = width;
		canvas.height = height;
		const size = width * height;
		[velocityX, velocityY, nextX, nextY, dye, nextDye, pressure, nextPressure, divergence] = Array.from({ length: 9 }, () => new Float32Array(size));
		pixels = context.createImageData(width, height);
		for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
			for (const [sx, sy] of sources) dye[y * width + x] += Math.exp(-((x - sx * width) ** 2 + (y - sy * height) ** 2) / 160) * .55;
		}
		pointer = undefined;
		render();
	}
	function sample(field, x, y) {
		x = Math.max(0, Math.min(width - 1.001, x));
		y = Math.max(0, Math.min(height - 1.001, y));
		const left = Math.floor(x), top = Math.floor(y), fx = x - left, fy = y - top;
		const index = top * width + left;
		return (field[index] * (1 - fx) + field[index + 1] * fx) * (1 - fy) + (field[index + width] * (1 - fx) + field[index + width + 1] * fx) * fy;
	}
	function simulate(time) {
		for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
			const i = y * width + x;
			velocityX[i] += Math.sin(y * .12 + time * .00015) * .012;
			velocityY[i] += Math.cos(x * .1 - time * .00012) * .012;
			nextX[i] = sample(velocityX, x - velocityX[i], y - velocityY[i]) * .986;
			nextY[i] = sample(velocityY, x - velocityX[i], y - velocityY[i]) * .986;
		}
		[velocityX, nextX] = [nextX, velocityX];
		[velocityY, nextY] = [nextY, velocityY];
		pressure.fill(0);
		for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
			const i = y * width + x;
			divergence[i] = -.5 * (velocityX[i + 1] - velocityX[i - 1] + velocityY[i + width] - velocityY[i - width]);
		}
		for (let pass = 0; pass < 12; pass++) {
			for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
				const i = y * width + x;
				nextPressure[i] = (divergence[i] + pressure[i - 1] + pressure[i + 1] + pressure[i - width] + pressure[i + width]) * .25;
			}
			[pressure, nextPressure] = [nextPressure, pressure];
		}
		for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
			const i = y * width + x;
			velocityX[i] -= .5 * (pressure[i + 1] - pressure[i - 1]);
			velocityY[i] -= .5 * (pressure[i + width] - pressure[i - width]);
			nextDye[i] = sample(dye, x - velocityX[i], y - velocityY[i]) * .998;
			for (const [sx, sy] of sources) nextDye[i] += Math.exp(-((x - sx * width) ** 2 + (y - sy * height) ** 2) / 100) * .0015;
		}
		[dye, nextDye] = [nextDye, dye];
	}
	function render() {
		for (let i = 0; i < dye.length; i++) {
			const density = Math.min(1, dye[i]);
			pixels.data[i * 4] = 130 + density * 45;
			pixels.data[i * 4 + 1] = 50;
			pixels.data[i * 4 + 2] = 240;
			pixels.data[i * 4 + 3] = density * 100;
		}
		context.putImageData(pixels, 0, 0);
	}
	function frame(time) {
		requestAnimationFrame(frame);
		if (document.hidden || document.body.classList.contains("view-mode") || reducedMotion.matches || time - lastFrame < 33) return;
		lastFrame = time;
		simulate(time);
		render();
	}
	window.addEventListener("pointermove", event => {
		if (reducedMotion.matches || document.body.classList.contains("view-mode")) return;
		const x = event.clientX / innerWidth * width, y = event.clientY / innerHeight * height;
		if (pointer) {
			const dx = Math.max(-3, Math.min(3, x - pointer.x)), dy = Math.max(-3, Math.min(3, y - pointer.y));
			for (let row = Math.max(1, Math.floor(y - 9)); row < Math.min(height - 1, y + 9); row++) {
				for (let column = Math.max(1, Math.floor(x - 9)); column < Math.min(width - 1, x + 9); column++) {
					const weight = Math.exp(-((column - x) ** 2 + (row - y) ** 2) / 25);
					const i = row * width + column;
					velocityX[i] += dx * weight * .7;
					velocityY[i] += dy * weight * .7;
				}
			}
		}
		pointer = { x, y };
	}, { passive: true });
	document.documentElement.addEventListener("pointerleave", () => { pointer = undefined; });
	window.addEventListener("resize", resize);
	resize();
	requestAnimationFrame(frame);
})();
