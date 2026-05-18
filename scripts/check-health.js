const http = require("node:http");
const https = require("node:https");

const target = process.argv[2];

if (!target) {
  process.exit(1);
}

const client = target.startsWith("https:") ? https : http;
const request = client.get(target, { timeout: 1000 }, (response) => {
  response.resume();
  process.exit(response.statusCode === 200 ? 0 : 1);
});

request.on("timeout", () => {
  request.destroy();
  process.exit(1);
});

request.on("error", () => {
  process.exit(1);
});
