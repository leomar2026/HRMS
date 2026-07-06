# Saudi HRMS

Production-oriented Saudi HRMS starter with Next.js, Express, PostgreSQL, Prisma, JWT auth, RBAC, audit logs, payroll, leave, attendance, biometric import, and government connector placeholders.

## Stack

- Next.js web app in `apps/web`
- Node.js Express API in `apps/api`
- PostgreSQL with Prisma ORM
- JWT authentication with bcrypt password hashing
- Zod request validation
- Role-based access control: `ADMIN`, `HR`, `ACCOUNTANT`, `EMPLOYEE`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```

3. Start PostgreSQL and update `DATABASE_URL` in `apps/api/.env`.

With Docker:

```bash
docker compose up -d postgres
```

Or use any PostgreSQL instance reachable by the API.

4. Create tables and seed the admin user:

```bash
npm run prisma:migrate
npm run db:seed
```

5. Run the app:

```bash
npm run dev
```

On Windows PowerShell systems that block npm scripts, use `npm.cmd`:

```powershell
npm.cmd run dev
```

Web: `http://localhost:3000`

API: `http://localhost:4000`

## Seed Login

Admin:

- Email: `admin@company.sa`
- Password: `Admin123!`

Employee self-service:

- Email: `employee@company.com`
- Password: `Employee@123`

Change seeded passwords immediately in real deployments.

## ZKTeco Biometric Attendance Integration

The HRMS includes a real attendance integration module for ZKTeco devices:

- Device setup: `/biometric-devices`
- Employee biometric mapping: `/biometric-mapping`
- Processed attendance records: `/biometric-attendance`
- Raw device logs and sync history: `/biometric-logs`

Supported connection modes are TCP/IP, ADMS Push, BioTime API, BioTime Database, and Manual Import. TCP/IP and BioTime syncs require approved SDK/agent or BioTime credentials configured securely on the backend. The frontend never receives device credentials.

CSV fallback sample:

```bash
samples/zkteco-biometric-import.csv
```

CSV columns:

```csv
deviceUserId,punchTime,punchType,verificationType,workCode,rawLogReference
EMP-002,2026-06-01T08:02:00+03:00,CHECK_IN,Fingerprint,,ZK-MAIN-01-EMP-002-202606010802
```

Raw biometric logs are stored before processing, duplicates are prevented by device and raw log reference, unmatched device users are reported, and processed logs create daily attendance records using first-in/last-out calculations.

## Government Connectors

The connector services are intentionally secure placeholders:

- `apps/api/src/services/gosiService.ts`
- `apps/api/src/services/mudadService.ts`
- `apps/api/src/services/qiwaService.ts`

They read only official endpoint and credential environment variables and do not create fake government integration behavior. Official integration requires approved API access, company authorization, and official credentials.

## Useful Commands

```bash
npm run dev
npm run build
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
```
