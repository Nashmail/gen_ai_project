/** Bundles the frontend into one self-contained HTML file (dist/nash-dhabha.html).
 *  The bundle runs the engine in the browser (offline mode), so it works without the backend. */
const fs = require("fs"), path = require("path");
const F = (p) => fs.readFileSync(path.join(__dirname, "..", "frontend", p), "utf8");
const dataUri = (p) => "data:image/svg+xml;base64," + Buffer.from(F(p)).toString("base64");
let html = F("index.html");
const css = F("css/styles.css");
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/, "").replace(/<meta name="viewport"[^>]*>\s*/, "")
  .replace(/<link rel="icon"[^>]*>\s*/, "")
  .replace('<link rel="stylesheet" href="css/styles.css">', "<style>\n" + css + "\n</style>");
let body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
body = body.replace(/<script src="js\/([^"]+)"><\/script>/g, (m, f) => "<script>\n" + F("js/" + f).replace(/<\/script/g, "<\\/script") + "\n</script>");
body = body.replace(/assets\/logo-mark\.svg/g, dataUri("assets/logo-mark.svg")).replace(/assets\/logo\.svg/g, dataUri("assets/logo.svg"));
const out = '<meta name="claude:viewport-fit-sides" content="cover">\n' + head.trim() + "\n" + body.trim() + "\n";
fs.mkdirSync(path.join(__dirname, "..", "dist"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "..", "dist", "nash-dhabha.html"), out);
console.log("dist/nash-dhabha.html", (out.length / 1024).toFixed(0) + " KB");

// Standalone copy: a normal web page you can open straight in Chrome/Edge (double-click), voice included.
const standalone = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  + '<link rel="icon" href="' + dataUri("assets/logo-mark.svg") + '">\n' + head.trim() + "\n</head>\n<body>\n" + body.trim() + "\n</body>\n</html>\n";
fs.writeFileSync(path.join(__dirname, "..", "dist", "NASH-Dhabha-voice-app.html"), standalone);
console.log("dist/NASH-Dhabha-voice-app.html", (standalone.length / 1024).toFixed(0) + " KB");
