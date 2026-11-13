import { readFile } from 'node:fs/promises';

const reportPath = process.argv[2] ?? 'test-results/playwright.json';
const key = process.env.VERIFAI_INGESTION_KEY;
if (!key)
  throw new Error(
    'Set VERIFAI_INGESTION_KEY as a GitHub Actions repository secret.',
  );

let report;
try {
  report = JSON.parse(await readFile(reportPath, 'utf8'));
} catch {
  report = null;
}

const storyKey = process.env.VERIFAI_STORY_KEY || 'SEV-1';
const runId = process.env.GITHUB_RUN_ID || `local-${Date.now()}`;
const attempt = process.env.GITHUB_RUN_ATTEMPT || '1';
const repository = process.env.GITHUB_REPOSITORY || '';
const pipelineUrl = repository
  ? `https://github.com/${repository}/actions/runs/${runId}`
  : '';
const results = [];

function visit(suite, parents = []) {
  const path = suite.title ? [...parents, suite.title] : parents;
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const last = test.results?.at(-1) ?? {};
      const status =
        last.status === 'passed'
          ? 'passed'
          : last.status === 'skipped'
            ? 'skipped'
            : last.status === 'interrupted'
              ? 'blocked'
              : 'failed';
      const title = [...path, spec.title].filter(Boolean).join(' › ');
      results.push({
        externalId:
          `${spec.id || spec.title}-${test.projectName || 'default'}`.slice(
            0,
            250,
          ),
        title: title.includes(storyKey) ? title : `${storyKey} › ${title}`,
        storyKey,
        status,
        durationMs: last.duration ?? 0,
        errorMessage: last.error?.message || last.error?.stack || '',
        evidence: pipelineUrl
          ? [
              {
                type: 'link',
                name: 'GitHub Actions run and failure report',
                url: pipelineUrl,
              },
            ]
          : [],
      });
    }
  }
  for (const child of suite.suites ?? []) visit(child, path);
}

for (const suite of report?.suites ?? []) visit(suite);
if (!results.length)
  results.push({
    externalId: 'playwright-report-missing',
    title: `${storyKey} › Playwright report missing`,
    storyKey,
    status: 'blocked',
    errorMessage:
      'The runner did not produce a Playwright JSON report. Check the GitHub Actions logs.',
    evidence: pipelineUrl
      ? [{ type: 'link', name: 'GitHub Actions logs', url: pipelineUrl }]
      : [],
  });

const payload = {
  provider: 'playwright',
  externalRunId: `github-${runId}-${attempt}`,
  name: `${storyKey} Playwright run ${runId}.${attempt}`,
  suiteName: 'Playwright',
  environment: process.env.VERIFAI_ENVIRONMENT || 'TestEnv1',
  buildReference: process.env.GITHUB_SHA || `github-${runId}`,
  repository,
  branch: process.env.GITHUB_REF_NAME || '',
  commitSha: process.env.GITHUB_SHA || '',
  pipelineUrl,
  completedAt: new Date().toISOString(),
  results,
};

const response = await fetch(
  'https://fcebprkoqbwdcuvwyqiu.supabase.co/functions/v1/ingest-ci',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-plyx-key': key },
    body: JSON.stringify(payload),
  },
);
if (!response.ok) {
  const message = await response.text();
  throw new Error(
    `VerifAI ingestion failed (${response.status}): ${message.slice(0, 500)}`,
  );
}
console.log(`Ingested ${results.length} Playwright result(s) for ${storyKey}.`);
