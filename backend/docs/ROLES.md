# User roles

| Role | Purpose |
|------|--------|
| **SUPER_ADMIN** | Platform owner (URIMPACT). Full access. |
| **ADMINISTRATOR** | Full control of org inventory: upload, edit/delete data, reports, export, user management, settings. |
| **DATA_CONTRIBUTOR** | Upload receipts and submit emissions only. Cannot delete, cannot access dashboards/reports/summaries, cannot manage users. |
| **ANALYST** | View/analyze all data, generate reports and decarb narratives, export. Cannot upload or edit/delete data, cannot manage users. |
| **VIEWER** | Read-only: dashboards and summaries. Cannot upload, edit, generate reports, export datasets, or settings. |

Legacy: `USER` → treated as `DATA_CONTRIBUTOR`; `ADMIN` → treated as `ADMINISTRATOR`.

## Migration

After pulling, run:

```bash
npx prisma migrate deploy
# or during development:
npx prisma migrate dev
npx prisma generate
```

Seed users:

- `superadmin@urimpact.com` — SUPER_ADMIN  
- `admin@urimpact.com` — ADMINISTRATOR  
- `demo@urimpact.com` — DATA_CONTRIBUTOR  
