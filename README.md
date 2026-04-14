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

## Recommended: Use VS Code

If the support team is opening the source code on a local computer, VS Code is the easiest tool to use.

VS Code helps with:

- opening the project folder
- seeing all files in one place
- opening a built-in terminal
- editing `.env` files safely

Important note:

- Windows computers: supported
- macOS computers: supported
- iPhone or iPad using iOS: not supported for local setup

If someone only has an iPhone or iPad, they should not try to run the project locally. They should use a Windows or Mac computer instead.

### How to Install VS Code on Windows

1. Open the VS Code website:

- [Visual Studio Code Download](https://code.visualstudio.com/)

2. Click the Windows download button.
3. Wait for the installer to finish downloading.
4. Open the installer.
5. Click through the install steps.
6. Keep the default settings unless your IT team says otherwise.
7. Finish the installation.
8. Open `Visual Studio Code`.

Recommended Windows install options if shown:

- `Add "Open with Code" action`
- `Add to PATH`

These are helpful, but the project can still work without them.

### How to Install VS Code on macOS

1. Open the VS Code website:

- [Visual Studio Code Download](https://code.visualstudio.com/)

2. Click the Mac download button.
3. Wait for the download to finish.
4. Open the downloaded file.
5. Drag `Visual Studio Code` into the `Applications` folder if macOS asks.
6. Open `Visual Studio Code`.
7. If macOS shows a security prompt, click to allow opening the app.

### What Else Needs to Be Installed

If the user only wants the easiest local method, install:

- Docker Desktop
- VS Code

That is enough for the Docker method.

If the user wants to run the project without Docker, they may also need:

- Python 3.11 or newer
- Node.js 20 or newer

For most support staff, Docker is the simpler option.

### How to Open the Project in VS Code

After downloading the source code from Google Drive:

1. Extract the ZIP file if needed.
2. Open `Visual Studio Code`.
3. Click `File`.
4. Click `Open Folder...`
5. Select the project folder.
6. Wait for VS Code to load the files.

After that, the left side of VS Code should show the project files and folders.

### How to Open the Terminal in VS Code

Once the project folder is open in VS Code:

1. Click `Terminal` in the top menu.
2. Click `New Terminal`.

VS Code will open a terminal at the bottom of the window.

That is where the commands in this README should be typed.

### How to Open a Terminal Without VS Code

If the user does not want to use VS Code, they can still use the computer's normal terminal.

Windows:

1. Open the project folder in File Explorer.
2. Click the folder path bar.
3. Type `powershell`
4. Press `Enter`

This opens PowerShell in the correct folder.

macOS:

1. Open `Terminal`
2. Type `cd `
3. Drag the project folder into the Terminal window
4. Press `Enter`

This moves Terminal into the correct folder.

## How to Push Local Code to GitHub

Use this section when the support team has edited files on the local computer and needs to send those changes back to GitHub.

This process should be done on a Windows or Mac computer, not on iPhone or iPad.

Why this matters:

- pushing to GitHub keeps the latest version of the project in one safe place
- it makes future updates easier for the team
- Vercel usually deploys the frontend from GitHub
- Railway usually deploys the backend from GitHub

If local changes are never pushed to GitHub, Vercel and Railway may keep using older code instead of the latest version.

### What Needs to Be Ready First

Before pushing code to GitHub, make sure:

- the project folder is already open on the computer
- GitHub account access is available
- Git is installed on the computer
- the project was originally downloaded as a Git repository, not only as a ZIP

Important note:

- If the project was downloaded from Google Drive as a ZIP file, `git push` will usually not work right away.
- In that case, the user should either get a real GitHub clone of the repository, or ask a technical teammate to reconnect the folder to GitHub.

### Easiest Way to Check Whether Git Is Ready

Open a terminal in the project folder and run:

```bash
git status
```

If Git is working, you should see a response that mentions the current branch or changed files.

If you see an error like `git is not recognized`, Git is not installed yet.

### How to Install Git on Windows

1. Open the Git website:

- [Git Download](https://git-scm.com/downloads)

2. Download Git for Windows.
3. Open the installer.
4. Keep the default options unless IT tells you otherwise.
5. Finish the installation.
6. Close and reopen VS Code or PowerShell after installation.

### How to Install Git on macOS

1. Open the Git website:

- [Git Download](https://git-scm.com/downloads)

2. Download Git for macOS, or install the Apple command line tools if macOS prompts for them.
3. Finish the installation.
4. Close and reopen Terminal or VS Code after installation.

### First-Time Git Setup

If this is the first time Git is being used on the computer, run these two commands once:

```bash
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"
```

Replace:

- `Your Name` with the person's real name
- `your-email@example.com` with the email connected to GitHub

### How to See What Changed

In the terminal, run:

```bash
git status
```

This shows which files were changed.

If the user wants a simpler view, they can also look in the VS Code `Source Control` panel on the left side.

### How to Save Changes to GitHub

Run these commands one by one in the project folder.

Step 1:

```bash
git status
```

This lets the user confirm that the changed files are visible.

Step 2:

```bash
git add .
```

This tells Git to prepare all changed files for saving.

Step 3:

```bash
git commit -m "Update project files"
```

This creates a local save point with a short message.

The message can be changed to something more specific, for example:

```bash
git commit -m "Update README instructions"
```

Step 4:

```bash
git push
```

This uploads the local commit to GitHub.

### What to Expect During Git Push

When `git push` works:

- Git may ask the user to sign in to GitHub
- a browser window may open for login
- after login, the push should continue

If Git says everything is up to date, there may not be any new changes to push.

### If Git Push Says There Is No Remote Repository

Run:

```bash
git remote -v
```

If no GitHub address appears, the folder may not be connected to the GitHub repository.

This often happens when the project came from Google Drive instead of a real Git clone.

### Best Practice When Using Google Drive Source Code

If the support team needs to both:

- run the project locally from Google Drive
- and push code back to GitHub

the safer workflow is:

1. Clone the GitHub repository to the computer.
2. Copy only the changed files from the Google Drive version into the GitHub clone.
3. Run `git status`.
4. Run `git add .`
5. Run `git commit -m "Describe the changes"`
6. Run `git push`

This avoids many Git problems caused by ZIP downloads.

### If Git Push Fails Because GitHub Asks for Login

Usually the easiest fix is:

1. Let the browser sign-in page open.
2. Sign in to GitHub.
3. Approve access if Git asks.
4. Return to the terminal and wait for the push to finish.

### If Git Push Fails Because Someone Else Updated GitHub First

Run:

```bash
git pull --rebase
```

Then run:

```bash
git push
```

If this shows merge or conflict errors, stop and ask a technical teammate for help before continuing.

### Simple Git Push Version

If the repository is already connected and Git is already installed, the short version is:

```bash
git status
git add .
git commit -m "Update project files"
git push
```

## Fastest Option: Run with Docker

If the support team receives the source code through Google Drive, this is the easiest way to open the project locally.

### How to Install Docker Desktop

If Docker is not installed yet, follow these steps first.

1. Open the Docker Desktop website:

- [Docker Desktop Download](https://www.docker.com/products/docker-desktop/)

Windows:

1. Click the download button for Windows.
2. Wait for the installer file to finish downloading.
3. Open the installer file.
4. Keep the default options unless your IT team tells you otherwise.
5. Click through the install steps.
6. Restart the computer if Docker asks you to restart.
7. After restart, open `Docker Desktop`.
8. Wait until Docker Desktop finishes loading.

macOS:

1. Click the download button for Mac.
2. Wait for the file to finish downloading.
3. Open the downloaded file.
4. Drag Docker into the `Applications` folder if macOS asks.
5. Open `Docker Desktop`.
6. Allow any permissions macOS asks for.
7. Wait until Docker Desktop finishes loading.

How to know Docker is ready:

- Docker Desktop opens normally
- the whale icon appears
- the app shows that Docker is running

If Windows shows a message about WSL or virtualization, ask IT to enable the required Windows features and then open Docker Desktop again.

### What to Download First

1. Download the project folder from Google Drive.
2. Extract the ZIP file if Google Drive gave you a ZIP.
3. Open the project folder on the computer.
4. Make sure Docker Desktop is installed and running.

You do not need GitHub, Python, or Node.js for this method.

### Docker Step-by-Step

1. Open the project folder.
2. Open a terminal inside that folder.
3. Make sure you are inside the project folder.
4. Copy and paste this command:

```bash
docker compose up --build
```

5. Press `Enter`.
6. Wait for Docker to finish building and starting the containers.
7. Open the website in a browser:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8001`

### How to Know Docker Worked

When Docker starts correctly, you should see messages similar to:

```text
backend-1   | Application startup complete.
backend-1   | Uvicorn running on http://0.0.0.0:8000
frontend-1  | Configuration complete; ready for start up
```

At that point, open:

- `http://localhost:3000`

### If the Browser Page Does Not Open

Check these things:

1. Make sure Docker Desktop is running.
2. Make sure the terminal is still open.
3. Make sure the project folder was fully extracted from Google Drive.
4. Try `http://localhost:3000` again.

### If Port 8001 Is Already In Use

Create a file named `.env` in the project folder with this line:

```env
BACKEND_PORT=8010
```

Then run again:

```bash
docker compose up --build
```

After that, the backend will be available at:

- `http://localhost:8010`

The frontend will still open at:

- `http://localhost:3000`

### If AI Reports Are Needed in Docker

Create a file named `.env` in the project folder and add one or both of these:

```env
GROQ_API_KEY=gsk_your_key_here
ANTHROPIC_API_KEY=sk-ant-your_key_here
```

Then run:

```bash
docker compose up --build
```

### How to Stop Docker

In the terminal window where Docker is running:

1. Click the terminal
2. Press `Ctrl + C`

If needed, you can also run:

```bash
docker compose down
```

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

If the user is not technical, the Docker method above is strongly recommended instead of the manual local setup below.

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

What these commands do:

1. `python -m venv .venv`
Creates a local Python environment for the project.

2. `.venv\Scripts\Activate.ps1`
Turns on that environment in PowerShell.

3. `pip install -r requirements.txt`
Installs the Python packages the backend needs.

4. `uvicorn server:app --reload --port 8000`
Starts the backend server.

If PowerShell blocks the activate command, the user can still try:

```powershell
python -m pip install -r requirements.txt
python -m uvicorn server:app --reload --port 8000
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

What these commands do:

1. `cd pnwer-dashboard`
Moves into the frontend folder.

2. `npm install`
Installs the frontend packages.

3. `npm run dev`
Starts the frontend development server.

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
