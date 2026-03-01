# URIMPACT Backend API

A comprehensive carbon emissions tracking and compliance platform API built with Node.js, Express, TypeScript, and PostgreSQL.

## Features

- **User Authentication**: JWT-based authentication with role-based access control
- **Document Processing**: Upload receipts; **Anthropic (Claude) API** reads receipts and extracts data (replacing Affinda)
- **Emissions Calculation**: GHG Protocol-compliant calculations using Climatiq API
- **Dashboard & Reports**: Real-time emissions tracking and compliance reporting
- **Admin Panel**: User management, audit logs, and system statistics

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 15 (via Docker)
- **ORM**: Prisma
- **Cache/Queue**: Redis (via Docker)
- **Authentication**: JWT
- **Validation**: Zod
- **Logging**: Winston

## Prerequisites

- Node.js 20 or higher
- Docker and Docker Compose
- npm or yarn

## Quick Start

### 1. Clone and Install Dependencies

```bash
cd backend
npm install
```

### 2. Start Docker Containers (PostgreSQL & Redis)

```bash
# Start all services (PostgreSQL, Redis, pgAdmin)
docker-compose up -d

# Check if containers are running
docker-compose ps
```

Services will be available at:
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **pgAdmin**: `http://localhost:5050` (admin@urimpact.com / admin123)

### 3. Configure Environment Variables

Create a `.env` file in the backend folder:

```env
# Server Configuration
NODE_ENV=development
PORT=5000

# Database (Docker PostgreSQL)
DATABASE_URL=postgresql://urimpact:urimpact_password@localhost:5432/urimpact?schema=public

# Redis (Docker)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long-change-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# AWS S3 Configuration (optional for local development)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=urimpact-uploads

# Anthropic (Claude) API - used to read receipts and extract numbers (replaces Affinda)
ANTHROPIC_API_KEY=
# ANTHROPIC_API_URL=https://api.anthropic.com/v1
# ANTHROPIC_MODEL=claude-sonnet-4-20250514
# ANTHROPIC_MAX_TOKENS=4096

# Climatiq Emissions API (OPTIONAL - local calculations with DEFRA/IEA factors used if not set)
# Leave empty for development with local emission factor calculations
CLIMATIQ_API_KEY=
CLIMATIQ_API_URL=https://api.climatiq.io

# File Upload Settings
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=pdf,jpg,jpeg,png

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:5173

# Logging
LOG_LEVEL=debug
```

### 4. Initialize Database

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Seed the database with test data
npm run prisma:seed
```

### 5. Start the Development Server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## Receipt reading: Anthropic (Claude) instead of Affinda

**We use the Anthropic API (Claude) to read receipts**, not Affinda. When a receipt is uploaded and processed:

1. The image is sent to **Claude**, which extracts structured data (activity type, amount, unit, region, etc.).
2. That data is sent to **Climatiq** for emission calculation.
3. The result is stored and used in the dashboard and reports.

Set `ANTHROPIC_API_KEY` in `.env` for receipt extraction to work. Without it, document processing will fail when processing receipts.

## Development Mode (No External APIs Required)

The backend can run **without Climatiq** for development (local emission factors are used):

### Emissions Calculations (Climatiq API)
When `CLIMATIQ_API_KEY` is not set, the system uses **comprehensive local emission factors** from:
- DEFRA 2024 conversion factors
- IEA regional electricity grid factors
- IPCC guidelines for fuel combustion
- UAE-specific electricity grid emission factors

Supported emission categories with local calculations:
- Electricity (UAE grid averages by emirate)
- Fuels (diesel, petrol, LPG, natural gas)
- Transportation (vehicles, flights)
- Water supply and treatment
- Waste disposal
- Refrigerants

This allows full end-to-end testing without needing API subscriptions.

## Test Accounts

After seeding the database, you can use these accounts:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@urimpact.com | SuperAdmin123! |
| Admin | admin@urimpact.com | Admin123! |
| Demo User | demo@urimpact.com | Demo123! |

## API Endpoints

### Health Check
- `GET /api/health` - API health status

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile` - Update user profile
- `POST /api/auth/change-password` - Change password

### Documents
- `POST /api/documents/upload` - Upload document (multipart/form-data)
- `GET /api/documents` - List user's documents
- `GET /api/documents/:id` - Get single document
- `DELETE /api/documents/:id` - Delete document
- `POST /api/documents/:id/process` - Process document (OCR + emissions)

### Emissions
- `GET /api/emissions` - List emissions records
- `GET /api/emissions/:id` - Get single emission
- `GET /api/emissions/summary` - Get emissions summary
- `POST /api/emissions/calculate` - Manual emissions calculation
- `GET /api/emissions/export` - Export emissions (JSON/CSV)
- `DELETE /api/emissions/:id` - Delete emission record

### Reports
- `GET /api/reports/dashboard` - Dashboard summary
- `GET /api/reports/trends` - Emissions trends
- `GET /api/reports/compliance` - Compliance report
- `POST /api/reports/custom` - Generate custom report

### Admin (requires ADMIN or SUPER_ADMIN role)
- `GET /api/admin/users` - List all users
- `GET /api/admin/users/:id` - Get single user
- `PUT /api/admin/users/:id` - Update user
- `GET /api/admin/audit-logs` - View audit logs
- `GET /api/admin/stats` - System statistics
- `GET /api/admin/documents` - All documents (admin view)

## Project Structure

```
backend/
├── docker-compose.yml      # Docker services configuration
├── init-db.sql            # Database initialization script
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Database seed script
└── src/
    ├── index.ts           # Application entry point
    ├── config/
    │   ├── index.ts       # Configuration management
    │   └── database.ts    # Prisma client setup
    ├── controllers/       # Route handlers
    │   ├── authController.ts
    │   ├── documentController.ts
    │   ├── emissionController.ts
    │   ├── reportController.ts
    │   └── adminController.ts
    ├── middleware/        # Express middleware
    │   ├── auth.ts        # JWT authentication
    │   ├── errorHandler.ts
    │   ├── rateLimit.ts
    │   ├── upload.ts      # File upload handling
    │   └── validate.ts    # Request validation
    ├── routes/            # API route definitions
    │   ├── authRoutes.ts
    │   ├── documentRoutes.ts
    │   ├── emissionRoutes.ts
    │   ├── reportRoutes.ts
    │   └── adminRoutes.ts
    ├── services/          # Business logic
    │   ├── authService.ts
    │   ├── documentService.ts
    │   ├── emissionService.ts
    │       │   ├── climatiqService.ts
    │   ├── anthropicService.ts   # Claude: receipt reading + report calculations (replaces Affinda/OCR)
    │   └── auditService.ts
    ├── types/             # TypeScript type definitions
    │   └── index.ts
    └── utils/             # Utility functions
        ├── helpers.ts
        ├── logger.ts
        └── validators.ts
```

## Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload

# Build
npm run build            # Build for production
npm start                # Start production server

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:push      # Push schema changes (dev only)
npm run prisma:studio    # Open Prisma Studio GUI
npm run prisma:seed      # Seed database with test data

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors

# Testing
npm test                 # Run tests
```

## Docker Commands

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f postgres
docker-compose logs -f redis

# Restart a service
docker-compose restart postgres

# Remove all data (reset)
docker-compose down -v
```

## Database Management

### Using Prisma Studio
```bash
npm run prisma:studio
```
Opens a web UI at `http://localhost:5555` for database management.

### Using pgAdmin
1. Open `http://localhost:5050`
2. Login with `admin@urimpact.com` / `admin123`
3. Add server:
   - Host: `postgres` (or `host.docker.internal` on Windows/Mac)
   - Port: `5432`
   - Database: `urimpact`
   - Username: `urimpact`
   - Password: `urimpact_password`

## API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Login Flow
1. Call `POST /api/auth/login` with email and password
2. Receive `accessToken` and `refreshToken`
3. Use `accessToken` for API requests
4. When token expires, call `POST /api/auth/refresh` with `refreshToken`

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| NODE_ENV | Environment (development/production) | No | development |
| PORT | Server port | No | 5000 |
| DATABASE_URL | PostgreSQL connection string | Yes | - |
| REDIS_HOST | Redis host | No | localhost |
| REDIS_PORT | Redis port | No | 6379 |
| JWT_SECRET | JWT signing secret (min 32 chars) | Yes | - |
| JWT_EXPIRES_IN | Access token expiry | No | 7d |
| ANTHROPIC_API_KEY | Anthropic (Claude) API key – used to read receipts (replaces Affinda) | Yes for receipt processing | - |
| CLIMATIQ_API_KEY | Climatiq emissions API key | No | - |
| CORS_ORIGIN | Allowed CORS origin | No | http://localhost:5173 |

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps

# View PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Prisma Issues
```bash
# Regenerate Prisma client
npm run prisma:generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

### Port Already in Use
```bash
# Find process using port 5000
netstat -ano | findstr :5000

# Kill process (Windows)
taskkill /PID <PID> /F
```

## License

MIT License - see LICENSE file for details.
