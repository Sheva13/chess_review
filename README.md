# Chess Review

**A free, local, and private chess game analysis tool powered by Stockfish 19.**

Chess Review is a lightweight, self-hosted chess analysis application inspired by Chess.com's Game Review feature. It helps you understand your games by analyzing individual moves, identifying mistakes, highlighting better alternatives, and visualizing how the game evolves.

Built for personal use with a friend, Chess Review runs locally on your computer without accounts, subscriptions, or public servers.

## Features

- **Game Import** — Import games by pasting PGN, uploading `.pgn` files, or entering a FEN position. Supports selecting individual games from files containing multiple games.
- **Move-by-Move Analysis** — Review your game with Stockfish 19 and see how each move affects the position.
- **Move Classification** — Identify Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, and Blunder moves.
- **Accuracy & Evaluation Graph** — Compare both players' accuracy and explore the evaluation graph to understand critical moments in the game.
- **Best Move Suggestions** — See the engine's recommended moves, principal variations, and position evaluations.
- **Interactive Chessboard** — Navigate through moves using on-screen controls or your keyboard, flip the board, and replay the game automatically.
- **Position Exploration** — Experiment with alternative moves directly on the board and explore different possibilities without changing the original game.
- **Move Annotations** — View move symbols, highlighted squares, and arrows that indicate the last move, recommended moves, and threats to the king.
- **Game History** — Save reviewed games locally, reopen previous analyses, and delete games you no longer need.
- **Review Progress & Cancellation** — Track analysis progress, cancel a running review, and retain partial results.
- **Sound Effects** — Enjoy lightweight synthesized chess sounds, with a persistent mute option.

## Preview

Chess Review uses a dark interface inspired by Chess.com's familiar visual style, with muted panels, green accents, and a classic green-and-ivory chessboard.

The interface is designed to keep the board, move list, evaluation graph, and analysis results easy to follow without unnecessary visual clutter.

## Tech Stack

| Technology | Purpose |
|---|---|
| Next.js | Web application and API |
| React & TypeScript | User interface and application logic |
| Tailwind CSS | Styling and responsive layout |
| Stockfish 19 | Chess position analysis |
| `react-chessboard` | Interactive chessboard |
| `chess.js` | Chess rules, move validation, PGN, and FEN handling |
| SQLite | Local game and analysis storage |
| Server-Sent Events (SSE) | Live review progress updates |
| Lucide | Interface icons |
| Web Audio API | Synthesized sound effects |
| Node.js 22 LTS | Runtime environment |

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js 22 LTS
- npm
- Stockfish 19 compatible with your operating system

Stockfish is distributed separately from this repository. You must obtain a compatible Stockfish 19 binary and configure its path before running the application.

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd chess-review
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the Stockfish binary path using the `STOCKFISH_PATH` environment variable.

   Example for Linux:

   ```bash
   export STOCKFISH_PATH="/path/to/stockfish"
   ```

   Replace the example path with the actual location of your Stockfish 19 binary. Make sure the binary is executable.

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the application in your browser:

   ```text
   http://127.0.0.1:3000
   ```

> **Note:** The exact startup and production commands depend on the scripts configured in `package.json`. Check the project configuration if your setup differs.

## How to Use

1. Open Chess Review in your browser.
2. Import a chess game using PGN, a `.pgn` file, or a FEN position.
3. Navigate through the game using the chessboard, move list, or keyboard controls.
4. Start the review and let Stockfish analyze the positions.
5. Explore move classifications, accuracy scores, recommended moves, and evaluation changes.
6. Click the evaluation graph or select individual moves to revisit important moments.
7. Try alternative moves using exploration mode to see how different decisions affect the position.
8. Reopen saved games from your local history whenever you want.

## Privacy First

Chess Review is designed for local use and personal analysis.

- No account or login is required.
- Games and analysis results are stored in a local SQLite database.
- Chess analysis is performed using a local Stockfish process.
- The application is intended to run on `127.0.0.1`, rather than being exposed as a public service.

Keep the application bound to localhost and avoid exposing its server to untrusted networks unless you have deliberately reviewed and secured the deployment.

## Testing

Run the test suite with:

```bash
npm test
```

The project uses Node.js's built-in test runner with `tsx`. Tests cover important analysis logic, move classification, evaluation handling, and edge cases.

## Documentation

Additional project documentation is available in the `docs/` directory:

- `docs/ARCHITECTURE.md` — Application architecture and review workflow.
- `docs/TECHNICAL_SPEC.md` — Technical implementation details.
- `docs/GAME_REVIEW_SPEC.md` — Move classification and accuracy methodology.
- `docs/DATABASE_SCHEMA.md` — Local database structure.
- `docs/API_SPEC.md` — API endpoints and behavior.
- `docs/decisions/` — Architecture Decision Records (ADRs).

See `CHANGELOG.md` for implementation progress and notable changes.

## Project Status

Chess Review has progressed beyond its initial usable milestone, with the core import, analysis, visualization, and game history workflows implemented.

Current work focuses on **calibration and final polish**, including:

- Comparing move classifications against Chess.com's Game Review across a collection of games.
- Evaluating engine performance, resource usage, and operating temperatures.
- Refining the interface and overall user experience.

Chess Review is not intended to reproduce Chess.com's proprietary analysis algorithm exactly. Its move classifications and accuracy calculations use an independently implemented methodology inspired by common chess evaluation concepts.

## Project Goals

Chess Review aims to make detailed chess game analysis accessible without a paid subscription, while keeping the experience lightweight, private, and easy to use.

It is designed for reviewing completed games—not for playing against a bot, online multiplayer, tournament clock management, or public game hosting.

---

**Built with Next.js, TypeScript, and Stockfish 19.**
