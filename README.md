# ⛏️ Mineloot Auto-Miner Bot

An automated on-chain mining bot for [Mineloot](https://mineloot.app) — a grid-based mining game on the **Base** blockchain.

## 🚀 What It Does

- **Listens in real-time** to new mining rounds via Server-Sent Events (SSE) from the Mineloot API.
- **Auto-deploys** ETH to all 25 grid blocks at the start of every new round.
- **Auto-claims** ETH and LOOT rewards when pending balance thresholds are met.
- **Force-claims** rewards when wallet balance runs low to keep the bot running continuously.
- **Logs all activity** to both the terminal and `mineloot-latest-report.txt`.

## 🧱 How It Works

```
SSE Stream (roundTransition) ──► New Round ──► executeDeploy()
                              └► Round Settled ──► checkProfit()
                                                      ├─ claimETH() if pending ≥ 0.0002 ETH
                                                      └─ claimLOOT() if wallet is low
```

- Contract: `0xA8E2F506aDcbBF18733A9F0f32e3D70b1A34d723` (Base Mainnet)
- Deploys `0.00025 ETH` per round (0.00001 ETH × 25 blocks)
- Claims ETH automatically when pending ≥ 0.0002 ETH

## 📋 Requirements

- Node.js >= 18
- An [Alchemy](https://alchemy.com) API key for Base Mainnet RPC
- An EVM wallet with some ETH on Base Mainnet

## ⚙️ Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/verisimb/mineloot.git
   cd mineloot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env_example .env
   ```
   Then edit `.env` and fill in your values:
   ```env
   ALCHEMY_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_API_KEY_HERE
   PRIVATE_KEY=your_private_key_here
   ```

4. **Run the bot**
   ```bash
   ./start.sh
   ```

## 📁 Project Structure

```
mineloot/
├── bot.js                    # Main bot logic
├── start.sh                  # Startup script
├── .env_example              # Environment variable template
├── package.json              # Node.js dependencies
└── mineloot-latest-report.txt  # Auto-generated activity log
```

## 🔑 Environment Variables

| Variable      | Description                               |
|---------------|-------------------------------------------|
| `ALCHEMY_URL` | Base Mainnet RPC URL from Alchemy         |
| `PRIVATE_KEY` | Private key of your EVM wallet (with `0x`) |

> ⚠️ **Never commit your `.env` file.** It contains your private key. Only `.env_example` is safe to share.

## 📄 Logs

The bot logs all activity with timestamps to:
- **Terminal** — live output when running `./start.sh`
- **`mineloot-latest-report.txt`** — persistent log file (appended on each run)

## ⚠️ Disclaimer

This bot interacts directly with a smart contract on Base Mainnet using real ETH. Use at your own risk. Always secure your private key and never share it.

## 📜 License

ISC
