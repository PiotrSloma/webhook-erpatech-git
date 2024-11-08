import express from "express";
import cors from "cors";
import { exec } from "child_process";
import path from "path";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config({ path: path.join(__dirname, ".env") });
// import { stderr, stdout } from "bun";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req, res) => {
  res.send("This is a webhook for git.erpatech");
});

app.post("/webhook", (req, res) => {
  console.log("Otrzymano webhook: ", JSON.stringify(req.body, null, 2));

  const signature = req.headers["x-hub-signature-256"];
  const hmac = crypto.createHmac("sha256", process.env.GIT_WEBHOOK_SECRET as string);
  const digest = "sha256=" + hmac.update(JSON.stringify(req.body)).digest("hex");
  if (!signature || signature !== digest) {
    res.status(401).json({ error: "Nieprawidłowy podpis" });
    return;
  }

  const projectName = req.body.repository.name;
  const projectPath = path.join(__dirname, "..", projectName);
  exec(
    "git reset --hard && git pull origin main && npm run build && pm2 restart all",

    {
      cwd: projectPath,
    },
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Błąd podczas wywołania git pull: ${error}`);
        res.status(500).json({ error: `Błąd podczas wywołania git pull: ${error}` });
      }

      console.log(`Wynik git pull: ${stdout}`);
      if (stderr) console.error(`Błąd podczas wywołania git pull: ${stderr}`);
      res.status(200).json({ message: stdout });
    }
  );
});

app.listen(3100, "0.0.0.0", () => {
  console.log("Server is running on port 3100");
});
("");
