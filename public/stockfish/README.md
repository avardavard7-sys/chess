# Stockfish WASM Files

Download the Stockfish WASM files and place them here:

1. Go to: https://github.com/lichess-org/stockfish.wasm/releases/latest
2. Download `stockfish.js` and `stockfish.wasm`
3. Place both files in this directory: `public/stockfish/`

Final structure:
```
public/
  stockfish/
    stockfish.js
    stockfish.wasm
    README.md
```

These files enable the AI chess engine. Without them, AI mode won't work.

The vercel.json and next.config.ts are already configured with the required 
Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers for 
SharedArrayBuffer support.
