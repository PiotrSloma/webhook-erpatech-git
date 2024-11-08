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
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Body:", JSON.stringify(req.body, null, 2));

  // Sprawdzanie podpisu
  const signature = req.headers["x-hub-signature-256"];
  console.log("Otrzymany podpis:", signature);

  const hmac = crypto.createHmac("sha256", process.env.GIT_WEBHOOK_SECRET as string);
  console.log("Secret użyty do HMAC:", process.env.GIT_WEBHOOK_SECRET);

  const digest = "sha256=" + hmac.update(JSON.stringify(req.body)).digest("hex");
  console.log("Wyliczony digest:", digest);

  if (!signature || signature !== digest) {
    console.error("Błąd weryfikacji podpisu");
    console.log("Oczekiwany:", digest);
    console.log("Otrzymany:", signature);
    res.status(401).json({ error: "Nieprawidłowy podpis" });
    return;
  }

  console.log("Podpis zweryfikowany pomyślnie");

  const projectName = req.body.repository.name;
  const projectPath = path.join(__dirname, "..", projectName);

  console.log("Nazwa projektu:", projectName);
  console.log("Ścieżka projektu:", projectPath);

  try {
    console.log("Wykonywanie komend git...");

    // Reset
    console.log("Wykonywanie komendy git reset...");
    const reset = Bun.spawn(["git", "reset", "--hard"], {
      cwd: projectPath,
      stderr: "pipe",
      stdout: "pipe",
    });
    await reset.exited;

    // Pull
    console.log("Wykonywanie komendy git pull...");
    const pull = Bun.spawn(["git", "pull", "origin", "main"], {
      cwd: projectPath,
      stderr: "pipe",
      stdout: "pipe",
    });
    await pull.exited;

    // Build
    console.log("Wykonywanie komendy npm run build...");
    const build = Bun.spawn(["npm", "run", "build"], {
      cwd: projectPath,
      stderr: "pipe",
      stdout: "pipe",
    });
    await build.exited;

    // Restart PM2
    console.log("Wykonywanie komendy pm2 restart all...");
    const restart = Bun.spawn(["pm2", "restart", "all"], {
      stderr: "pipe",
      stdout: "pipe",
    });
    await restart.exited;

    // Zbierz output ze wszystkich komend
    const output = await new Response(restart.stdout).text();
    const errors = await new Response(restart.stderr).text();

    if (errors) {
      console.log("Wynik błędów (stderr):");
      console.log(errors);
    }

    console.log("Wynik standardowego wyjścia:");
    console.log(output);

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
