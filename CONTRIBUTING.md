# Contributing

Open an issue before changing monitor semantics, incident transitions, alert delivery, authorization, or the database schema. Keep domain behavior in the shared core when possible and add focused tests for state transitions and failure paths.

Before opening a pull request:

```bash
npm ci
npm run build
npm run typecheck
npm test
npm audit --omit=dev
helm lint deploy/helm/vigil
```

Never commit JWT secrets, SMTP credentials, monitor tokens, production URLs, or employer-owned code and configuration.
