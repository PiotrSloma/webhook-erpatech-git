import express from "express";
import cors from "cors";
import { exec } from "child_process";
import path from "path";
import { stderr, stdout } from "bun";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get("/", (req, res) => {
  res.send("This is a webhook for git.erpatech");
});

app.post("/webhook", (req, res) => {
  console.log("Otrzymano webhook: ", JSON.stringify(req.body, null, 2));
  const projectName = req.body.repository.name;
  const projectPath = path.join(__dirname, projectName);
  exec("git pull origin main", { cwd: projectPath }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Błąd podczas wywołania git pull: ${error}`);
      res.status(500).send(`Błąd podczas wywołania git pull: ${error}`);
    }

    console.log(`Wynik git pull: ${stdout}`);
    if (stderr) console.error(`Błąd podczas wywołania git pull: ${stderr}`);
    res.status(200).send(stdout);
  });
});

app.listen(443, () => {
  console.log("Server is running on port 443");
});
