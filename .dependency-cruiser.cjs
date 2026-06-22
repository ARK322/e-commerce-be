/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-domain-to-api',
      severity: 'error',
      comment: 'Domain modules must not depend on HTTP API layer',
      from: { path: '^src/domains' },
      to: { path: '^src/api' },
    },
    {
      name: 'no-shared-to-domains',
      severity: 'error',
      comment: 'Shared utilities must stay domain-agnostic',
      from: { path: '^src/shared' },
      to: { path: '^src/domains' },
    },
    {
      name: 'no-api-to-infrastructure',
      severity: 'warn',
      comment: 'Phase 0 backlog: move service logic from api/ into domain application',
      from: { path: '^src/api' },
      to: { path: '^src/domains/.+/infrastructure' },
    },
    {
      name: 'no-cross-domain-infrastructure',
      severity: 'warn',
      comment: 'Phase 0 backlog: use application facades instead of cross-domain repositories',
      from: { path: '^src/domains/([^/]+)/application' },
      to: { path: '^src/domains/(?!\\1)/infrastructure' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules|dist|tests',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
  },
};
