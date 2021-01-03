// This adds the "preload" extension to htmx.  By default, this will 
// preload the targets of any tags with `href` or `hx-get` attributes 
// if they also have a `preload` attribute as well.  See documentation
// for more detauls
htmx.defineExtension("preload", {

	onEvent: function(name, event) {

		// Only take actions on "htmx:processedNode"
		if (name !== "htmx:processedNode") {
			return;
		}

		// SOME HELPER FUNCTIONS WE'LL NEED ALONG THE WAY

		// config gets the closest non-empty value from the preload="" attribute. (default = "mousedown")
		var config = function(node) {
			if (node == undefined) {return undefined;}
			return node.getAttribute("preload") || node.getAttribute("data-preload") || config(node.parentElement) || "mousedown"
		}
		
		// load handles the actual HTTP fetch, and uses htmx.ajax in cases where we're 
		// preloading an htmx resource (this sends the same HTTP headers as a regular htmx request)
		var load = function(node) {

			return function() {

				// If this value has already been loaded, then do not try again.
				if (node.preloadState !== "READY") {
					return;
				}

				// This is used after a successful AJAX request, to mark the
				// content as loaded (and prevent additional AJAX calls.)
				var done = function() {
					node.preloadState = "DONE"
				}

				// Special handling for HX-GET - use built-in htmx.ajax function
				// so that headers match other htmx requests, then set 
				// node.preloadState = TRUE so that requests are not duplicated
				// in the future
				if (node.getAttribute("hx-get")) {
					htmx.ajax("GET", node.getAttribute("hx-get"), {handler:done});
					return;
				}

				// Otherwise, perform a standard xhr request, then set 
				// node.preloadState = TRUE so that requests are not duplicated 
				// in the future.
				if (node.getAttribute("href")) {
					var r = new XMLHttpRequest();
					r.open("GET", node.getAttribute("href"));
					r.onload = done;
					r.send();
					return;
				}
			}
		}

		// This function processes a specific node and sets up event handlers.
		// We'll search for nodes and use it below.
		var init = function(node) {

			// If this node DOES NOT include a "GET" transaction, then there's nothing to do here.
			if (node.getAttribute("href") + node.getAttribute("hx-get") + node.getAttribute("data-hx-get") == "") {
				return;
			}

			// Guarantee that we only initialize each node once.
			if (node.preloadState !== undefined) {
				return;
			}
			
			// Get event name from config.
			var on = config(node)
						
			// FALL THROUGH to here means we need to add an EventListener
	
			// Apply the listener to the node
			node.addEventListener(on, function(evt) {
				if (node.preloadState === "PAUSE") { // Only add one event listener
					node.preloadState = "READY"; // Requred for the `load` function to trigger

					// Special handling for "mouseover" events.  Wait 100ms before triggering load.
					if (on === "mouseover") {
						window.setTimeout(load(node), 100);
					} else {
						load(node)() // all other events trigger immediately.
					}
				}
			})

			// Special handling for certain built-in event handlers
			switch (on) {

				case "mouseover":
					// Mirror `touchstart` events (fires immediately)
					node.addEventListener("touchstart", load(node));

					// WHhen the mouse leaves, immediately disable the preload
					node.addEventListener("mouseout", function(evt) {
						if ((evt.target === node) && (node.preloadState === "READY")) {
							node.preloadState = "PAUSE";
						}
					})
					break;

				case "mousedown":
					 // Mirror `touchstart` events (fires immediately)
					node.addEventListener("touchstart", load(node));
					break;
			}

			// Mark the node as ready to run.
			node.preloadState = "PAUSE";
			htmx.trigger(node, "preload:init") // This event can be used to load content immediately.
		}

		// Search for all child nodes that have a "preload" attribute
		event.target.querySelectorAll("[preload]").forEach(function(node) {

			// Initialize the node with the "preload" attribute
			init(node)

			// Initialize all child elements that are anchors or have `hx-get` (use with care)
			node.querySelectorAll("a,[hx-get],[data-hx-get").forEach(init)
		})
	}
})