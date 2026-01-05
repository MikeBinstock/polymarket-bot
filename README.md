# Polymarket Crypto Hourly Trading Bot

An automated trading bot for Polymarket's hourly crypto prediction markets (BTC, ETH, SOL, XRP). The bot exploits market dynamics where one side becomes increasingly certain as the hour progresses.

## Strategy

### How It Works

Polymarket runs hourly markets asking "Will BTC/ETH/SOL/XRP go Up or Down in the next hour?" These markets resolve based on Binance 1-hour candle data.

**The Edge:**
- At minute 0: Both sides trade near 50¢
- At minute 45: The winning side often trades at 90-95¢
- At minute 59: The winning side is 98-99¢

The bot waits until the **last 8 minutes of each hour** (configurable), then buys the expensive side (90-94¢) betting it will resolve to $1.00.

**Example Trade:**
- Buy at 92¢ → Resolves to $1.00 → Profit: 8¢ per share (~8.7% return)

## Features

### 🤖 Automated Trading
| Feature | Description |
|---------|-------------|
| **Multi-Crypto Support** | BTC, ETH, SOL, XRP hourly markets |
| **Per-Crypto Toggles** | Enable/disable each crypto independently |
| **Configurable Thresholds** | Set min/max price for each crypto (default: 90-94¢) |
| **Trading Window** | Only trade during specified minutes (default: 45-53) |
| **Skip Hours** | Configure UTC hour ranges to avoid trading (e.g., volatile periods) |

### 🛡️ Risk Management
| Feature | Description |
|---------|-------------|
| **Stop-Loss** | Auto-sell if position drops below threshold (default: 70¢, checks every 1 second) |
| **Volatility Filter** | Skip trading during volatile hours or high price swings |
| **Skip Hours** | 5 configurable UTC ranges to avoid (default: 3-5 PM ET, 9-11 PM ET) |

### 💰 Position Management
| Feature | Description |
|---------|-------------|
| **Auto-Claim** | Automatically claim winnings from resolved markets (per-crypto toggles) |
| **Auto-Sell** | Optionally sell all positions every hour at :01 |
| **Cash Out** | Manual button to market-sell all positions instantly |
| **Manual Claim** | Paste condition ID or Polymarket URL to claim specific markets |
| **URL Lookup** | Paste a Polymarket URL to get the condition ID for manual claiming |

### 📊 Dashboard
| Feature | Description |
|---------|-------------|
| **Live Markets** | See current prices for all hourly markets |
| **Trade History** | View all executed trades with P&L |
| **CSV Export** | Download trade history for analysis |
| **Real-time Stats** | Total P&L, active positions, last scan time |
| **Trading Window Status** | Live display of current minute and window status |
| **Skip Hours Status** | Live display of current UTC hour and skip status |

### ⚙️ Settings
| Feature | Description |
|---------|-------------|
| **Persistent Settings** | All settings saved to JSON and survive restarts |
| **Save as Defaults** | One-click save all current settings |
| **Reset to Factory** | Restore default settings |
| **Import/Export JSON** | Backup and restore configurations |
| **Custom RPC** | Use your own Polygon RPC endpoint |

## Default Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **BTC Trading** | ✅ ON | Bitcoin markets enabled |
| **ETH/SOL/XRP Trading** | ❌ OFF | Disabled by default |
| **Bet Size** | $90 | Per-trade position size |
| **Min Price** | 90¢ | Only buy at 90¢ or above |
| **Max Price** | 94¢ | Don't buy above 94¢ |
| **Trading Window** | 45-53 | Minutes of each hour |
| **Stop-Loss** | ✅ ON @ 70¢ | Sell if price drops below 70¢ |
| **Auto-Claim** | ✅ ON (BTC only) | Claim resolved markets |
| **Auto-Sell** | ❌ OFF | Hourly position liquidation |
| **Skip Hours** | ✅ ON | Skip 3-5 PM ET & 9-11 PM ET |
| **Volatility Filter** | ❌ OFF | Additional volatility checks |

## Quick Start

### Deploy to Railway

1. Fork this repository
2. Connect to Railway and deploy
3. Set environment variables:
   ```
   PRIVATE_KEY=your_polygon_private_key
   DASHBOARD_PASSWORD=your_secure_password
   ```
4. Your bot will be live at the Railway-provided URL

### Run Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/polymarket-bot.git
   cd polymarket-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file:
   ```
   PRIVATE_KEY=your_polygon_private_key
   DASHBOARD_PASSWORD=your_secure_password
   PORT=3000
   ```

4. Build and run:
   ```bash
   npm run build
   npm start
   ```

5. Open http://localhost:3000

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PRIVATE_KEY` | Your Polygon wallet private key | Yes |
| `DASHBOARD_PASSWORD` | Password to access the dashboard | Yes |
| `PORT` | Server port (default: 3000) | No |

> **Note**: All other settings (bet size, thresholds, toggles) are configured via the dashboard and persist in `data/settings.json`.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Web Dashboard                         │
│              (public/index.html)                         │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTP API
┌─────────────────────▼───────────────────────────────────┐
│                   API Server                             │
│              (src/api/server.ts)                         │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   Scheduler                              │
│            (src/scheduler/index.ts)                      │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐  │
│  │ Trading  │ │  Auto-   │ │  Stop-   │ │  Auto-     │  │
│  │  Scan    │ │  Claim   │ │  Loss    │ │  Sell      │  │
│  │ (1 sec)  │ │ (15 min) │ │ (1 sec)  │ │ (hourly)   │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              Polymarket Client                           │
│           (src/polymarket/client.ts)                     │
│                                                          │
│  • CLOB API (orders, positions)                          │
│  • Gamma API (market discovery)                          │
│  • Polygon blockchain (claims, approvals)                │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

### Bot Control
- `POST /api/bot/toggle` - Toggle bot on/off
- `POST /api/bot/scan` - Force market scan
- `POST /api/bot/stop` - Emergency stop
- `POST /api/bot/approve` - Approve USDC for trading
- `POST /api/bot/approve-sell` - Approve CTF for selling

### Positions
- `GET /api/positions` - Get all positions
- `POST /api/positions/claim/:conditionId` - Claim specific market
- `POST /api/positions/claim-all-hourly` - Claim all resolved hourly markets
- `POST /api/positions/cashout` - Sell all positions at market

### Settings
- `GET /api/settings` - Get all settings
- `POST /api/settings` - Update settings
- `POST /api/settings/reset` - Reset to factory defaults
- `GET /api/settings/export` - Export settings as JSON
- `POST /api/settings/import` - Import settings from JSON

### Markets
- `GET /api/markets/live` - Get live market data
- `POST /api/lookup-condition-id` - Get condition ID from Polymarket URL

## Security

⚠️ **IMPORTANT**: Your private key grants full access to your wallet!

- Never share your private key
- Use a dedicated wallet with only trading funds
- Store private key in Railway's encrypted environment variables
- Dashboard is password protected
- Read-only mode if no private key configured

## Disclaimer

- This is experimental software - use at your own risk
- Past performance doesn't guarantee future results
- Only trade what you can afford to lose
- Polymarket may be restricted in your jurisdiction
- This bot is not affiliated with Polymarket

## License

MIT
