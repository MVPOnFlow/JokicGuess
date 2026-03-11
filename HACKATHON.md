# MVP on Flow — Consumer DeFi Hackathon Submission

## 🏀 What is MVP on Flow?

**MVP on Flow** is a consumer DeFi platform that turns NBA fandom into on-chain financial participation. It wraps DeFi primitives — token swaps, a DAO-governed treasury, prediction markets, and NFT-backed tokenomics — into an experience that feels like a fan app, not a financial terminal.

Users connect a Flow wallet and immediately unlock a token economy powered by Nikola Jokić NBA TopShot moments — no jargon, no manual steps, no transaction fatigue.

**Live at**: [https://mvponflow.cc](https://mvponflow.cc)

---

## 🧩 How It Fits the Consumer DeFi Track

| Consumer DeFi Principle | How MVP on Flow Delivers |
|---|---|
| **Intuitive financial actions** | Users "swap moments for $MVP" — a one-click NFT→fungible-token exchange. No AMM UI, no slippage settings. |
| **Walletless-friendly onboarding** | Flow's Dapper wallet + FCL handles auth. Users sign in like any web app. |
| **Sponsored gas** | Moment transfers use Dapper's hybrid custody — gas is invisible to the user. |
| **Automated on-chain settlement** | Backend verifies the on-chain transfer, looks up the moment tier, calculates $MVP, and sends tokens automatically — all within seconds. |
| **Strong, invisible security** | HybridCustody (parent-child account linking) ensures the app never holds user keys. Replay protection prevents double-claiming. |
| **Real-time treasury transparency** | DAO treasury stats are fetched on-chain and displayed in human-readable dashboards — backed supply, surplus, tokens in the wild. |

---

## ✨ Key Features

### 1. Moment ↔ $MVP Swap (Core DeFi Primitive)
Users send Jokić TopShot moments to the DAO treasury and receive **$MVP fungible tokens** in return — an on-chain NFT-to-token exchange with tiered pricing:

| Tier | Sell to Treasury | Redeem from Treasury |
|------|-----------------|---------------------|
| Common / Fandom | 1.5 $MVP | 2 $MVP |
| Rare | 75 $MVP | 100 $MVP |
| Top Shot Debut | 375 $MVP | 500 $MVP |
| Legendary | 1,500 $MVP | 2,000 $MVP |

The 75% buy / 100% redeem spread creates a sustainable treasury model — users always know their moments have a floor value.

**Technical flow:**
1. User selects moments in the Swap UI → signs a single FCL transaction
2. Cadence transfers NFTs from the user's Dapper child account to the DAO treasury
3. Backend verifies the on-chain transaction, resolves moment tiers (DB + TopShot API fallback)
4. `$MVP` tokens are sent from the Flow treasury to the user's wallet automatically via `flow_py_sdk`
5. A progress modal guides the user through each step in real time

### 2. DAO Treasury Dashboard
Real-time on-chain treasury analytics showing:
- **Tokens in the Wild** — circulating $MVP supply
- **Backed Supply** — calculated from moment inventory (Common×2 + Rare×100 + TSD×500 + Legendary×2000)
- **Treasury Surplus** — backed supply minus circulating tokens
- **Moment Holdings** — breakdown by tier

Users can verify the token economy is solvent at any time — full transparency, no trust required.

### 3. FastBreak Prediction Markets
Community contests where users stake $MVP on NBA game outcomes. Multi-token support (FLOW, TSHOT, BETA, FROTH, JUICE) with on-chain settlement via Cadence transactions.

### 4. Triple-Double Watch (TD Watch)
Live tracking of Jokić's triple-double progress against the all-time leaderboard, synced from Basketball Reference. Drives community engagement and token distribution tied to real-world sports events.

### 5. 3D Museum
An immersive WebGL gallery (React Three Fiber) where users explore Jokić TopShot editions in a navigable 3D corridor. Performance-optimized with distance-based culling, capped video textures, and procedural surfaces.

### 6. $MVP Balance in Wallet
Connected users see their live $MVP balance in the navbar — queried directly from the Flow blockchain via Cadence script, refreshing every 30 seconds.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  React SPA (Vite) + FCL + React Three Fiber     │
│  Swap UI · Treasury · FastBreak · Museum         │
└────────────────────┬────────────────────────────┘
                     │  REST API
┌────────────────────▼────────────────────────────┐
│                Flask Backend                     │
│  /api/swap/complete · /api/treasury · /api/museum│
│  On-chain verification · Tier lookup · $MVP send │
└────────┬───────────────────────────┬────────────┘
         │                           │
┌────────▼────────┐     ┌───────────▼───────────┐
│  Flow Blockchain │     │  Database (SQLite/PG) │
│  TopShot NFTs    │     │  jokic_editions       │
│  $MVP (FT)       │     │  completed_swaps      │
│  HybridCustody   │     │  contest data         │
└─────────────────┘     └───────────────────────┘
```

### Flow Contracts Used
| Contract | Address | Purpose |
|----------|---------|---------|
| **TopShot** | `0x0b2a3299cc857e29` | NBA TopShot NFT moments |
| **TopShotLocking** | `0x0b2a3299cc857e29` | Filter locked/unlocked moments |
| **PetJokicsHorses ($MVP)** | `0x6fd2465f3a22e34c` | Fungible token — the core DeFi asset |
| **HybridCustody** | `0xd8a7e05a7ac670c0` | Parent-child account linking for Dapper wallets |
| **NonFungibleToken** | `0x1d7e57aa55817448` | NFT standard interface |
| **FungibleToken** | `0x9a0766d93b6608b7` | FT standard interface |

### Key Technical Decisions
- **Interface-based Cadence capabilities**: Uses `{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}` instead of concrete types — compatible with Dapper's HybridCustody capability controllers
- **UFix64 scaling**: `flow_py_sdk` requires raw integer input (`amount × 10⁸`) for fixed-point token amounts
- **Auto-seeding**: `jokic_editions` table auto-populates from TopShot API on first deploy — zero manual DB setup
- **Replay protection**: `completed_swaps` table prevents double-claiming on the same transaction

---

## 🚀 Getting Started

### Prerequisites
- Python 3.9+
- Node.js 16+
- A Flow wallet (Dapper or Lilico)

### Quick Start

```bash
# Clone
git clone https://github.com/MVPOnFlow/JokicGuess.git
cd JokicGuess

# Backend
python -m venv .venv
.venv/Scripts/activate        # Windows
pip install -r requirements.txt

# Frontend
cd react-wallet
npm install
npm run dev                    # Dev server on :5173

# Run the full app
cd ..
python jokicguess.py          # Flask on :5000 + Discord bot
```

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `DISCORD_TOKEN` | Discord bot authentication |
| `DATABASE_URL` | PostgreSQL connection (omit for SQLite) |
| `FLOW_SWAP_PRIVATE_KEY` | Private key for $MVP treasury sends |
| `FLOW_SWAP_KEY_INDEX` | Key index on the Flow swap account |

---

## 🧪 Testing

```bash
# Run all tests
pytest -o "addopts=" tests/

# With coverage
pytest --cov=. --cov-report=html
```

Test suite covers: swap completion flow, tier resolution, DB initialization, bot commands, route handlers, and museum API.

---

## 🔗 Links

- **Live App**: [https://mvponflow.cc](https://mvponflow.cc)
- **GitHub**: [https://github.com/MVPOnFlow/JokicGuess](https://github.com/MVPOnFlow/JokicGuess)
- **Discord**: [https://discord.gg/3p3ff9PHqW](https://discord.gg/3p3ff9PHqW)
- **$MVP on DexScreener**: [Flow EVM Chart](https://dexscreener.com/flowevm/0xa4BaC0A22b689565ddA7C9d5320333ac63531971)
- **Buy $MVP**: [KittyPunch Swap](https://swap.kittypunch.xyz/swap?tokens=0x0000000000000000000000000000000000000000-0x4dcdd1b9a5103fa5f13cc4c3b758e05ffaccb4dd)

---

## 🏆 Why This Matters for Consumer DeFi

MVP on Flow proves that DeFi adoption doesn't require users to understand DeFi. By embedding swaps, treasury management, and token economics into NBA fandom, we demonstrate that **the future of consumer DeFi is invisible finance** — powerful on-chain primitives wrapped in experiences people already love.

No one opens this app thinking "I'm going to interact with a DEX." They think "I'm going to swap my Jokić moments for tokens." That's the difference.
