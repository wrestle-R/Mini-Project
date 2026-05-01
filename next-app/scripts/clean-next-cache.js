const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");

fs.rmSync(nextDir, { recursive: true, force: true });
console.log("Removed .next cache");
