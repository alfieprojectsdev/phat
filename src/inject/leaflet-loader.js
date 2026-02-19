// Leaflet Loader / Injector
// This script runs in ISOLATED world but injects the map-handlers into MAIN world

function injectScript(file) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(file);
    s.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(s);
}

injectScript('src/inject/map-handlers.js');
