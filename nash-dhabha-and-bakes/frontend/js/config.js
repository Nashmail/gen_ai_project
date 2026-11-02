/* Where the backend API lives.
   ""  = same origin (when the backend serves this frontend, e.g. http://localhost:4000 or your Render URL).
   For GitHub Pages, set it to your deployed backend, e.g. "https://nash-dhabha-api.onrender.com".
   If the backend can't be reached, the app switches to offline mode and runs the same engine in the browser. */
window.NASH_CONFIG = window.NASH_CONFIG || { apiBase: "" };
