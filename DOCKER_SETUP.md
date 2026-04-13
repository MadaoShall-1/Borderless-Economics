# PNWER Tariff Dashboard — Quick Start Guide

## What You Need
- Docker Desktop (free): https://www.docker.com/products/docker-desktop/
- That's it.

## Setup (one time)

1. Install Docker Desktop and make sure it's running (whale icon in taskbar)

2. Download this project folder (or clone from GitHub):
   ```
   git clone https://github.com/MadaoShall-1/Borderless-Economics.git
   cd Borderless-Economics
   ```

3. (Optional) To enable AI report generation, create a file called `.env`:
   ```
   GROQ_API_KEY=gsk_your_key_here
   ANTHROPIC_API_KEY=sk-ant-your_key_here
   ```
   Get a free Groq key at https://console.groq.com

## Start the Dashboard

Open a terminal in the project folder and run:

```
docker-compose up --build
```

Wait 2-3 minutes for it to build. When you see:
```
backend_1   | INFO:     Uvicorn running on http://0.0.0.0:8000
frontend_1  | ... ready ...
```

Open your browser to: **http://localhost:3000**

By default, Docker now publishes the backend on **http://localhost:8001** to avoid common port conflicts on `8000`.
If you want a different host port, create a `.env` file with:
```
BACKEND_PORT=8010
```

That's it! The dashboard is running.

## Stop

Press `Ctrl+C` in the terminal, or run:
```
docker-compose down
```

## Features Available
- ✅ Overview (10 jurisdictions)
- ✅ Total Impact (annual industry/product analysis)
- ✅ Modeling (DID/DDD/CES econometric results)
- ✅ Forecast (tariff slider, next-month prediction)
- ✅ Reports (AI-generated policy briefs — needs GROQ_API_KEY)
- ✅ Refresh (pull latest Census Bureau data)

## Troubleshooting
- **"Cannot connect to Docker daemon"** → Make sure Docker Desktop is running
- **Port 3000 already in use** → Change `"3000:80"` to `"8080:80"` in docker-compose.yml
- **Port 8001 already in use** → Set `BACKEND_PORT=8010` in `.env` and rebuild
- **Reports fail** → Check that `GROQ_API_KEY` or `ANTHROPIC_API_KEY` is set in `.env`
