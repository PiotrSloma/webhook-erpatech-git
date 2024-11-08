import express from "express";
import cors from "cors";
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
  console.log("GET / - Test endpoint wywołany");
  res.send("This is a webhook for git.erpatech");
});

app.post("/webhook", async (req, res) => {
  console.log("POST /webhook - Otrzymano webhook");

  // Sprawdzanie podpisu
  const signature = req.headers["x-hub-signature-256"];
  const hmac = crypto.createHmac("sha256", process.env.GIT_WEBHOOK_SECRET as string);
  const digest = "sha256=" + hmac.update(JSON.stringify(req.body)).digest("hex");

  if (!signature || signature !== digest) {
    res.status(401).json({ error: "Nieprawidłowy podpis" });
    return;
  }
  console.log("Podpis zweryfikowany pomyślnie");

  const projectName = req.body.repository.name;
  const projectPath = path.join(__dirname, "..", projectName);

  try {
    console.log("Wykonywanie komend git...");

    // Reset
    const reset = Bun.spawn(["git", "reset", "--hard"], {
      cwd: projectPath,
      stderr: "pipe",
      stdout: "pipe",
    });
    await reset.exited;

    // Pull
    const pull = Bun.spawn(["git", "pull", "origin", "main"], {
      cwd: projectPath,
      stderr: "pipe",
      stdout: "pipe",
    });
    await pull.exited;

    // Delete PM2
    console.log("Wykonywanie komendy pm2 delete ", projectName);
    const restart = Bun.spawn(["pm2", "delete", projectName], {
      stderr: "pipe",
      stdout: "pipe",
    });
    await restart.exited;

    // Command
    const command = req.body.head_commit.message;
    const commandRun = Bun.spawn(["pm2", "start", "--interpreter", `bun ${command}`, "--name", projectName], {
      cwd: projectPath,
      stderr: "pipe",
      stdout: "pipe",
    });
    await commandRun.exited;

    const output = await new Response(commandRun.stdout).text();
    const errors = await new Response(commandRun.stderr).text();
    if (errors) {
      console.log("Wynik błędów (stderr):");
      console.log(errors);
    }

    console.log("Operacja zakończona sukcesem");
    res.status(200).json({ message: output });
  } catch (error) {
    console.error("Błąd wykonania komendy:");
    console.error("Szczegóły:", error);
    res.status(500).json({ error: `Błąd podczas wykonywania komend: ${error}` });
  }
});

app.listen(3100, "0.0.0.0", () => {
  console.log("=================================");
  console.log("Webhook server uruchomiony");
  console.log("Port: 3100");
  console.log("Host: 0.0.0.0");
  console.log("Środowisko:", process.env.NODE_ENV);
  console.log("=================================");
});
