(() => {
	const matrix = document.createElement("div");
	matrix.id = "dot-matrix";
	matrix.setAttribute("aria-hidden", "true");
	document.body.prepend(matrix);
	let frame;
	window.addEventListener("pointermove", (event) => {
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			matrix.style.setProperty("--dot-x", event.clientX + "px");
			matrix.style.setProperty("--dot-y", event.clientY + "px");
			matrix.classList.add("reacting");
		});
	}, { passive: true });
	document.documentElement.addEventListener("pointerleave", () => matrix.classList.remove("reacting"));
})();
