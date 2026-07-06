# Deployment Guide — Render (Free, 24/7)

Deploy LandVault so it stays online even when your PC is off.

## What you get

- Public URL like `https://landvault.onrender.com`
- Frontend + API on the same server
- 6 sample listings pre-loaded
- Free tier (may sleep after ~15 min idle; first visit wakes it up)

---

## Step 1 — Push code to GitHub

1. Create a new repo on GitHub: https://github.com/new  
   Name it `landvault-backend` (public or private).

2. In PowerShell, from the project folder:

```powershell
cd C:\xampp\htdocs\landvault-backend

git add src prisma package.json package-lock.json Dockerfile render.yaml landvault.html .env.example .dockerignore .gitignore Procfile README.md README_DEPLOY.md

git commit -m "Deploy LandVault to Render"

git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/landvault-backend.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2 — Deploy on Render

1. Go to https://render.com and sign up (free).
2. Click **New +** → **Blueprint**.
3. Connect your GitHub account and select the `landvault-backend` repo.
4. Render reads `render.yaml` automatically. Click **Apply**.
5. Wait 5–10 minutes for the first build.

---

## Step 3 — Open your live site

When the deploy finishes, Render shows a URL like:

```
https://landvault.onrender.com
```

Open it in any browser — no need for your PC to be on.

---

## Environment variables (set automatically)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite database |
| `ADMIN_API_KEY` | Auto-generated secret for admin API |
| `RENDER_EXTERNAL_URL` | Your public URL (set by Render) |
| `PORT` | Set by Render |

---

## Notes

- **Free tier sleeps** after ~15 minutes with no visitors. The first visit may take 30–60 seconds to wake up.
- **SQLite data** resets if you redeploy. New listings you add stay until the next deploy.
- **Uploaded images** are stored on the server disk; they may be lost on redeploy.
- For permanent data, upgrade to Render PostgreSQL later.

---

## Manual deploy (without Blueprint)

If Blueprint does not work:

1. **New +** → **Web Service**
2. Connect GitHub repo
3. **Environment:** Docker
4. **Dockerfile path:** `./Dockerfile`
5. **Health check path:** `/api/health`
6. Add env var: `DATABASE_URL` = `file:./dev.db`
7. Click **Create Web Service**

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on Prisma | Check Render build logs; ensure `prisma/` folder is in the repo |
| Site loads but no listings | Re-deploy; seed runs during Docker build |
| API errors after wake-up | Wait 60s and refresh — free tier is waking up |
| Want faster wake-up | Upgrade to Render paid plan or use Railway |
