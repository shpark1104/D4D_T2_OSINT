const { requestHandler } = require("../server/index");

function restoreRewrittenApiUrl(req) {
  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "/", `http://${host}`);
  const path = url.searchParams.get("path");

  if (!path) return;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  url.pathname = `/api/${normalizedPath}`;
  url.searchParams.delete("path");
  req.url = `${url.pathname}${url.search}`;
}

module.exports = function handler(req, res) {
  restoreRewrittenApiUrl(req);
  return requestHandler(req, res);
};
