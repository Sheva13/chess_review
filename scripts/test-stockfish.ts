import { spawn } from "child_process";
import { env } from "process";

const STOCKFISH_PATH = env.STOCKFISH_PATH;

if (!STOCKFISH_PATH) {
  console.error("STOCKFISH_PATH is not set. Check .env.local or export it.");
  process.exit(1);
}

const sf = spawn(STOCKFISH_PATH, [], { shell: false });

let buffer = "";
let gotUciok = false;
let engineName = "";

sf.stdout.on("data", (chunk: Buffer) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("id name ")) {
      engineName = trimmed.slice("id name ".length);
      console.log(`Engine name: ${engineName}`);
    }
    if (trimmed === "uciok") {
      gotUciok = true;
      console.log("uciok received");
      sf.stdin.write("quit\n");
    }
  }
});

sf.stderr.on("data", (chunk: Buffer) => {
  console.error(`stderr: ${chunk.toString()}`);
});

sf.on("error", (err) => {
  console.error(`Failed to spawn Stockfish: ${err.message}`);
  process.exit(1);
});

sf.on("close", (code) => {
  if (!gotUciok) {
    console.error("Engine did not send uciok before exiting.");
    process.exit(1);
  }
  console.log(`Done. Process exited with code ${code}.`);
});

sf.stdin.write("uci\n");
