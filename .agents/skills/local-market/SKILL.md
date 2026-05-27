---
name: local-market
description: Guide for setting up, updating, and running the local LobeHub market server. Use when the user wants to test market features (plugins, agents, skills) locally, needs to update local market data, or encounters issues with the local market. Triggers on 'local market', 'market server', 'pull market data', 'dev:local-market'.
---

# Local Market Development Guide

This guide explains how to use the local market server to test plugins, agents, and skills without relying on the production market endpoints.

## 1. Pulling Market Data

To populate your local market with the latest data from the official LobeHub Market, run the `pull:market` script.

> \[!IMPORTANT]
> Always override `MARKET_BASE_URL` to be empty when running the pull script so it fetches from the production server instead of trying to fetch from your local server.

> \[!NOTE]
> You will need a `MARKET_CLIENT_ID` and `MARKET_CLIENT_SECRET` to pull the data. You can generate these keys by running the following command:
>
> ```bash
> curl --location 'https://market.lobehub.com/api/v1/clients/register' \
>   --header 'Content-Type: application/json' \
>   --data '{
>               "clientName":"LobeHub-Dev-Test",
>               "clientType":"web",
>               "deviceId":"dev-machine-123",
>               "platform":"macOS",
>               "version":"2.1.58"
>             }'
> ```

```bash
MARKET_BASE_URL="" MARKET_CLIENT_ID="<your_client_id>" MARKET_CLIENT_SECRET="<your_client_secret>" bun run pull:market
```

This script saves JSON files (lists, manifests, categories) into `data/market/`.

## 2. Running the Local Market Server

The local market server serves the static JSON files from `data/market/` and provides filtering and pagination logic for lists.

```bash
bun run dev:local-market
```

This runs `scripts/localMarketServer.ts` on port `3011` (by default).

## 3. Connecting the App to the Local Market

To make the LobeHub app use your local market server instead of the production one, start the app with `MARKET_BASE_URL` pointing to the local server.

```bash
MARKET_BASE_URL="http://localhost:3011" bun run dev
```

## How the Local Market Server Works

The `scripts/localMarketServer.ts` script maps API URLs to local JSON files:

- `/api/v1/plugins/index.json` -> `data/market/plugins.json`
- `/api/v1/plugins` -> `data/market/plugins-list.json` (supports `?category=` filter and pagination)
- `/api/v1/agents` -> `data/market/agents-list.json` (supports `?category=` filter and pagination)
- `/api/v1/skills` -> `data/market/skills.json` (supports `?category=` filter and pagination)

If you modify `scripts/localMarketServer.ts`, remember to restart the `bun run dev:local-market` process for the changes to take effect.
