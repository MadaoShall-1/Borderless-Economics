# PNWER Tariff Dashboard

This project is a web dashboard for viewing tariff impact data, running forecasts, refreshing trade data, and generating AI-assisted reports.

This repository has two parts:

- `pnwer-dashboard/`: the website users open in a browser
- `server.py`: the backend service that provides data and report APIs

Recommended hosting:

- Frontend website: Vercel
- Backend API: Railway

Included config files:

- [`railway.json`](/D:/Tariff/railway.json)
- [`pnwer-dashboard/vercel.json`](/D:/Tariff/pnwer-dashboard/vercel.json)
- [`.env.example`](/D:/Tariff/.env.example)

## Before You Start

If the person following this guide is not technical, the easiest path is:

1. Put the code on GitHub.
2. Deploy the backend on Railway.
3. Copy the Railway website address.
4. Deploy the frontend on Vercel.
5. Paste the Railway address into Vercel as an environment variable.

If you follow the steps below in that order, the site should work.

## What You Need

- A GitHub account
- A Vercel account
- A Railway account
- This repository on GitHub: [Borderless-Economics](https://github.com/MadaoShall-1/Borderless-Economics)

Optional:

- A Groq API key for AI reports
- An Anthropic API key for AI reports

If you do not add an API key, the website can still load, but AI report generation may not work.

## Part 1: Put the Code on GitHub

If the code is already in GitHub, you can skip this section.

Repository URL:

```bash
https://github.com/MadaoShall-1/Borderless-Economics.git
```

If someone needs to download the code to their computer:

1. Open the GitHub repository page.
2. Click the green `Code` button.
3. Copy the repository URL.
4. Download as ZIP, or use Git if they know how.

If they are only deploying through Vercel and Railway, they usually do not need to run the code locally first.

## Part 2: Deploy the Backend on Railway

Do this first, because the frontend needs the backend URL.

### What Railway Is Doing

Railway runs the Python backend from this repository and gives you a public website address, such as:

```text
https://your-project-name.up.railway.app
```

That URL will be used by the frontend later.

### Railway Step-by-Step

1. Go to [Railway](https://railway.app).
2. Sign in.
3. Click `New Project`.
4. Choose `Deploy from GitHub repo`.
5. Connect your GitHub account if Railway asks.
6. Select the repository: `Borderless-Economics`.

Railway should detect the project and begin creating a service.

### Railway Root and Commands

This project should run from the repository root.

The backend entry file is:

- [`server.py`](/D:/Tariff/server.py)

This repository already includes:

- [`railway.json`](/D:/Tariff/railway.json)

If Railway asks for commands manually, use:

- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### Railway Environment Variables

In Railway, open your service and add these variables only if you want AI report generation:

- `GROQ_API_KEY`
- `ANTHROPIC_API_KEY`

Example values:

```env
GROQ_API_KEY=gsk_your_key_here
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

You do not need both. One is enough.

### How to Add Environment Variables in Railway

1. Open your Railway project.
2. Click the backend service.
3. Open the `Variables` tab.
4. Click `New Variable`.
5. Add the variable name.
6. Paste the value.
7. Save.

### How to Check Whether Railway Worked

After deployment finishes:

1. Open the Railway project.
2. Find the public domain or generated URL.
3. Copy the backend URL.
4. Open this page in a browser:

```text
https://your-railway-url/api/health
```

If everything is working, you should see:

```json
{"status":"ok"}
```

Save this Railway URL somewhere because you will need it for Vercel.

## Part 3: Deploy the Frontend on Vercel

Do this after Railway is working.

### What Vercel Is Doing

Vercel hosts the website that users will open in their browser.

The frontend code is in:

- [`pnwer-dashboard/`](/D:/Tariff/pnwer-dashboard)

This repository already includes:

- [`pnwer-dashboard/vercel.json`](/D:/Tariff/pnwer-dashboard/vercel.json)

### Vercel Step-by-Step

1. Go to [Vercel](https://vercel.com).
2. Sign in.
3. Click `Add New...`
4. Click `Project`.
5. Import the GitHub repository `Borderless-Economics`.

When Vercel asks for project settings, use:

- Framework Preset: `Vite`
- Root Directory: `pnwer-dashboard`
- Build Command: `npm run build`
- Output Directory: `dist`

### Very Important: Add the Backend URL

Before deploying, set this environment variable in Vercel:

```env
VITE_API_BASE=https://your-railway-url.up.railway.app
```

Replace it with your real Railway backend URL.

If this value is wrong, the website may open but buttons and API features will fail.

### How to Add Environment Variables in Vercel

1. In Vercel, open the new project.
2. Open `Settings`.
3. Open `Environment Variables`.
4. Add:

- Name: `VITE_API_BASE`
- Value: your Railway backend URL

5. Save.
6. Redeploy if Vercel asks.

### How to Finish the Vercel Deploy

1. After setting `VITE_API_BASE`, click `Deploy`.
2. Wait for the build to finish.
3. Open the Vercel site URL.

The live website should now be available.

## Part 4: Final Live Test

After both services are deployed, test these items:

1. Open the Vercel website.
2. Confirm the page loads normally.
3. Try any feature that reads API data.
4. If there is a forecast tool, try it once.
5. If AI reports are enabled, try generating one report.

Also test the backend directly:

- `https://your-railway-url/api/health`
- `https://your-railway-url/api/forecast`

If the backend health URL works but the website does not, the problem is usually `VITE_API_BASE` in Vercel.

## Simple Troubleshooting

### Problem: The Vercel website opens, but data does not load

Most likely cause:

- `VITE_API_BASE` is missing or incorrect

Fix:

1. Go to the Vercel project.
2. Open `Settings`.
3. Open `Environment Variables`.
4. Check `VITE_API_BASE`.
5. Make sure it matches the Railway backend URL exactly.
6. Redeploy.

### Problem: Railway deploys, but the backend does not start

Check that Railway is using:

- Build Command: `pip install -r requirements.txt`
- Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### Problem: AI report generation does not work

Most likely cause:

- `GROQ_API_KEY` or `ANTHROPIC_API_KEY` was not added in Railway

Fix:

1. Open Railway.
2. Open the backend service.
3. Open `Variables`.
4. Add one of the API keys.
5. Redeploy if needed.

### Problem: The backend health page works, but the website still fails

Most likely cause:

- The frontend is still pointing to `localhost`
- Or Vercel was deployed before `VITE_API_BASE` was added

Fix:

1. Check `VITE_API_BASE` in Vercel.
2. Make sure it uses the Railway public URL, not `localhost`.
3. Trigger a redeploy.

## Important Note About Refreshing Data

The backend currently writes refreshed data into:

- `pnwer-dashboard/src/data/pnwer_analysis_data_v9.json`

This is important:

- Railway does not behave like a permanent file storage system
- files written during runtime may be lost after a restart or redeploy

That means `/api/refresh` may work temporarily, but the updated file is not guaranteed to stay forever on Railway.

For long-term production use, the better options are:

- store updated data in a database
- store updated data in cloud object storage
- or refresh data locally and commit the updated JSON back to GitHub

## Optional: Run the Project Locally

Most non-technical users do not need this section.

This is only for local testing on a computer.

### Local Backend

Requirements:

- Python 3.11+

Commands:

Windows PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

### Local Frontend

Requirements:

- Node.js 20+

Commands:

```bash
cd pnwer-dashboard
npm install
npm run dev
```

Local addresses:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`

### Local Docker Option

If someone prefers Docker:

```bash
docker compose up --build
```

Docker addresses:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8001`

You can change the backend port by creating a `.env` file with:

```env
BACKEND_PORT=8010
```

## Files That Matter Most

For support staff, these are the main files to know:

- [`README.md`](/D:/Tariff/README.md): full setup guide
- [`server.py`](/D:/Tariff/server.py): backend API entry point
- [`requirements.txt`](/D:/Tariff/requirements.txt): Python packages
- [`pnwer-dashboard/package.json`](/D:/Tariff/pnwer-dashboard/package.json): frontend package settings
- [`pnwer-dashboard/vercel.json`](/D:/Tariff/pnwer-dashboard/vercel.json): Vercel settings
- [`railway.json`](/D:/Tariff/railway.json): Railway settings
- [`.env.example`](/D:/Tariff/.env.example): example environment variables

## Short Version

If someone wants the shortest possible version:

1. Deploy `Borderless-Economics` to Railway.
2. Confirm `https://your-railway-url/api/health` returns `{"status":"ok"}`.
3. Deploy the same repository to Vercel.
4. In Vercel, set Root Directory to `pnwer-dashboard`.
5. In Vercel, set `VITE_API_BASE` to the Railway URL.
6. Redeploy Vercel.
7. Open the Vercel website and test it.
