const states = new WeakMap();
const hopHeaders = new Set(["connection", "keep-alive", "proxy-connection", "transfer-encoding", "upgrade", "host", "content-length"]);
export function requestHeaders(headers) {
	const entries = headers && typeof headers[Symbol.iterator] === "function" ? [...headers] : Object.entries(headers || {});
	const connectionHeaders = new Set(entries.filter(([key]) => key.toLowerCase() === "connection").flatMap(([, value]) => String(value).toLowerCase().split(",").map(value => value.trim())));
	return Object.fromEntries(entries.filter(([key, value]) => !hopHeaders.has(key.toLowerCase()) && !connectionHeaders.has(key.toLowerCase()) && (key.toLowerCase() !== "te" || String(value).toLowerCase() === "trailers")));
}
async function cancellable(request, signal) {
	signal?.throwIfAborted();
	if (!signal) return request();
	let abort;
	try {
		return await Promise.race([
			request().then(response => {
				if (signal.aborted) { response.body?.cancel().catch(() => {}); signal.throwIfAborted(); }
				return response;
			}),
			new Promise((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener("abort", abort, { once: true }); if (signal.aborted) abort(); }),
		]);
	} finally { signal.removeEventListener("abort", abort); }
}
export async function fetchWithFallback(transport, remote, method, body, headers, signal) {
	signal?.throwIfAborted();
	let state = states.get(transport);
	if (!state) { state = { origins: new Set(), client: null }; states.set(transport, state); }
	const options = { method, body: /^(GET|HEAD)$/i.test(method) ? undefined : body, headers: requestHeaders(headers), redirect: "manual" };
	async function compatibleClient() {
		if (!state.client) state.client = import("./http1.mjs").then(async sdk => {
			await sdk.default({ module_or_path: new URL("./http1.wasm", import.meta.url) });
			const options = new sdk.EpoxyClientOptions();
			options.user_agent = navigator.userAgent;
			for (const key of ["wisp_v2", "udp_extension_required", "title_case_headers", "redirect_limit", "header_limit", "buffer_size"]) if (transport.opts[key] != null) options[key] = transport.opts[key];
			return new sdk.EpoxyClient(transport.wisp, options);
		}).catch(error => { state.client = null; throw error; });
		return state.client;
	}
	if (state.origins.has(remote.origin)) {
		const client = await compatibleClient();
		return cancellable(() => client.fetch(remote.href, options), signal);
	}
	try { return await cancellable(() => transport.client.fetch(remote.href, options), signal); }
	catch (error) {
		if (signal?.aborted || !/^(GET|HEAD)$/i.test(method) || !/http2|http\/2|PROTOCOL_ERROR/i.test(String(error))) throw error;
		const client = await compatibleClient();
		const response = await cancellable(() => client.fetch(remote.href, options), signal);
		state.origins.add(remote.origin);
		return response;
	}
}
