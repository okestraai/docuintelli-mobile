import { PDFJS_LIB_B64, PDFJS_WORKER_B64 } from './pdfjsAssets';

// Loads pdf.js into a WebView from the app BUNDLE (base64 constants), not a CDN — so PDF viewing
// works offline and carries no third-party runtime dependency. The library is executed via a
// data: script URL (runs in the WebView's global scope, defining window.pdfjsLib), and the worker
// is turned into a blob URL from its bundled source. Verified rendering a real PDF in a browser.

/** Script tags that load the bundled pdf.js library. Place inside the WebView document's <head>. */
export const PDFJS_SCRIPT_TAGS =
  `<script src="data:text/javascript;base64,${PDFJS_LIB_B64}"></script>` +
  `<script id="pdfjsw" type="text/plain">${PDFJS_WORKER_B64}</script>`;

/** JS run before using pdfjsLib: point the worker at the bundled source via a blob URL. */
export const PDFJS_WORKER_INIT =
  `pdfjsLib.GlobalWorkerOptions.workerSrc=URL.createObjectURL(new Blob([atob(document.getElementById('pdfjsw').textContent)],{type:'application/javascript'}));`;
