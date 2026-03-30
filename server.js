const http = require("http");
const fs = require("fs");
const path = require("path");
const { createBareServer } = require("@tomphttp/bare-server-node");
const { uvPath } = require("@titaniumnetwork-dev/ultraviolet");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";

const ROOT_DIR = __dirname;
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
const bare = createBareServer("/bare/", {
  connectionLimiter: {
    maxConnectionsPerIP: 1000,
    windowDuration: 30,
    blockDuration: 5
  }
});

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".mjs": "application/javascript; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".map": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".txt": "text/plain; charset=UTF-8"
};

const ROUTED_FILES = {
  "/sw.js": path.join(uvPath, "sw.js"),
  "/uv.bundle.js": path.join(uvPath, "uv.bundle.js"),
  "/uv.config.js": path.join(uvPath, "uv.config.js"),
  "/uv.client.js": path.join(uvPath, "uv.client.js"),
  "/uv.handler.js": path.join(uvPath, "uv.handler.js"),
  "/uv.sw.js": path.join(uvPath, "uv.sw.js"),
  "/baremux/index.mjs": path.join(ROOT_DIR, "node_modules", "@mercuryworkshop", "bare-mux", "dist", "index.mjs"),
  "/baremux/worker.js": path.join(ROOT_DIR, "node_modules", "@mercuryworkshop", "bare-mux", "dist", "worker.js"),
  "/baremod/index.mjs": path.join(ROOT_DIR, "node_modules", "@mercuryworkshop", "bare-as-module3", "dist", "index.mjs")
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" });
        res.end("Not found");
        return;
      }

      res.writeHead(500, { "Content-Type": "text/plain; charset=UTF-8" });
      res.end("Server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const headers = { "Content-Type": contentType };
    if (path.basename(filePath) === "sw.js") {
      headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
      headers["Service-Worker-Allowed"] = "/";
    }

    res.writeHead(200, headers);
    res.end(content);
  });
}

function safePublicPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const normalized = path.normalize(decoded).replace(/^([/\\])+/g, "");
  const candidate = path.resolve(PUBLIC_DIR, normalized);

  if (!candidate.startsWith(PUBLIC_DIR)) {
    return null;
  }

  return candidate;
}

const server = http.createServer((req, res) => {
  if (bare.shouldRoute(req)) {
    bare.routeRequest(req, res);
    return;
  }

  const parsed = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = parsed.pathname;

  if (ROUTED_FILES[pathname]) {
    sendFile(res, ROUTED_FILES[pathname]);
    return;
  }

  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = safePublicPath(requested);

  if (!filePath) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=UTF-8" });
    res.end("Forbidden");
    return;
  }

  sendFile(res, filePath);
});

server.on("upgrade", (req, socket, head) => {
  if (bare.shouldRoute(req)) {
    bare.routeUpgrade(req, socket, head);
    return;
  }

  socket.end();
});

server.listen(PORT, HOST, () => {
  console.log(`ClassroomSpot running at http://localhost:${PORT}`);
  console.log("Ultraviolet + Bare routes active: /service/ and /bare/");
});
