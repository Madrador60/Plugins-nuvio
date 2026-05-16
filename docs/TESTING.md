# Tests

Commandes principales :

```powershell
npm run check
npm run test:routes
npm run test:site
npm run test:quick
npm run test:domains
npm run test:all
```

Rapports :

- `data/reports/providers-report.json`
- `data/reports/routes-report.json`
- `data/reports/domains-report.json`

Un provider externe peut echouer sans que tout le site soit casse. Les erreurs doivent etre notees clairement et le provider peut etre marque `ZERO_RESULT`, `TIMEOUT` ou `ERROR`.
