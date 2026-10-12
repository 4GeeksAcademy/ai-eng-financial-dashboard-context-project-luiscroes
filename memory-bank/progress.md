# Progress

## Agent Skills Assignment

### Community Skills

- `accessibility` from `addyosmani/web-quality-skills`: improved semantic headings, loading and error announcements, decorative skeleton semantics, and the document title.
- `vercel-react-best-practices` from `vercel-labs/agent-skills`: applied `js-combine-iterations` so `computeKPIs` aggregates income and outcomes in one iteration instead of repeated filter/reduce operations.
- `javascript-testing-patterns` from `wshobson/agents`: added two Vitest cases for negative monthly profit and outcomes without income. This skill was selected because financial calculations benefit from explicit edge-case tests, and the existing Vitest setup supports focused coverage without extra dependencies.

### Internal Skill

- Added `financial-calculation-guardrails` at `.skills/financial-calculation-guardrails/SKILL.md`, discovered through `.vscode/settings.json`. It protects existing financial semantics and distinguishes confirmed behavior from unspecified policy.
- Its availability and explicit use were verified by applying it to a read-only financial calculation review. YAML frontmatter and workspace settings JSON were validated. Automatic activation was not demonstrated.

### Validation and Limitations

- Previous Copilot execution reports: accessibility phase, 5/5 Vitest tests and frontend build passed; React phase, 6/6 tests and build passed; testing phase, 8/8 tests and build passed. These results were not rerun for this document.
- The internal skill's YAML frontmatter and workspace settings JSON validated successfully.
- The existing Vite bundle-size warning above 500 kB predates this branch.
- Manual keyboard navigation, screen-reader behavior, and contrast verification remain pending. Financial precision and timezone policies remain unspecified and were not changed.

### Commits

- `a1cf8ed` — accessibility improvements.
- `e494bf5` — Vercel React best practices, combining KPI iterations.
- `dac8599` — JavaScript testing patterns, monthly profit edge-case tests.
- `74ffb1c` — internal financial calculation guardrails skill.