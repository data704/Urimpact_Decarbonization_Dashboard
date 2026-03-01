# URIMPACT – Carbon Emission & Decarbonization Platform

Full-stack application for tracking carbon emissions, managing decarbonization scenarios, and generating reports. Everything lives in this single repository (frontend + backend + CI/CD).

## Repository structure (all in one folder)

```
.
├── frontend/                 # React SPA (Vite)
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── vite.config.js
├── backend/                  # Node.js API (Express + TypeScript)
│   ├── prisma/
│   ├── src/
│   ├── package.json
│   ├── docker-compose.yml    # Postgres + Redis for local dev
│   └── .env                  # Create from .env.example (not committed)
├── .github/
│   └── workflows/            # CI/CD (deploy-backend, deploy-frontend, pr-checks)
├── Dockerfile                # Backend image (used by CI; copied into backend/ when building)
├── entrypoint.sh             # Backend container entrypoint (migrations + start)
├── DEPLOYMENT-REPORT.md      # AWS deployment guide
├── .gitignore
└── README.md                 # This file
```

## Prerequisites

- **Node.js** 20+
- **npm** (or yarn/pnpm)
- **Docker & Docker Compose** (for local Postgres + Redis)

## Quick start (local)

### 1. Backend: database and API

```bash
cd backend

# Start Postgres and Redis (optional: pgAdmin)
docker-compose up -d

# Install dependencies and setup DB
cp .env.example .env   # then edit .env with DATABASE_URL, JWT_SECRET, etc.
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed     # optional: demo users

# Run API
npm run dev
```

API: **http://localhost:5000**  
Health: **http://localhost:5000/api/health**

### 2. Frontend: React app

```bash
cd frontend

npm install
npm run dev
```

App: **http://localhost:5173**

Set `VITE_API_URL=http://localhost:5000/api` in a `.env` file if the API is not on that URL.

### 3. Login (after seed)

- **Email:** demo@urimpact.com  
- **Password:** Demo123!

(See `backend/README.md` for more test accounts.)

## Push to GitHub

1. Create a new repository on GitHub (empty, no README).
2. From this folder:

```bash
git init
git add .
git commit -m "Initial commit: URIMPACT full-stack app"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

3. Add **Secrets** in GitHub (Settings → Secrets and variables → Actions) for CI/CD:
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
   - `ECR_REPOSITORY`, `APP_RUNNER_SERVICE_ARN`, `APP_RUNNER_URL`
   - `FRONTEND_S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`, `VITE_API_URL`

See workflow files in `.github/workflows/` and `DEPLOYMENT-REPORT.md` for deployment details.

## Scripts overview

| Where    | Command              | Purpose              |
|----------|----------------------|----------------------|
| backend  | `npm run dev`        | Run API (dev)        |
| backend  | `npm run build`       | Build API (TS → dist)|
| backend  | `npm start`          | Run API (production) |
| backend  | `npm run prisma:*`   | DB migrate/seed/studio |
| frontend | `npm run dev`        | Run app (dev)        |
| frontend | `npm run build`      | Build SPA → dist/    |

## License

MIT (see backend/frontend package.json or LICENSE if present).
