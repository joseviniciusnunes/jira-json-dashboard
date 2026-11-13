import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = Number(process.env.PORT || 6060);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "public")));
app.listen(PORT, () =>
    console.log(`Jira JSON Dashboard: http://localhost:${PORT}`),
);
