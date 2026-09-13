import { execFileSync, spawnSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { delimiter, join } from 'path';
import { fail, getBash, pass, ROOT, toBashPath } from './helpers.mjs';

console.log('\nbatch-jsonl-input.test.mjs — captured JSONL JDs');

function runBatch(args, cwd, env) {
  return spawnSync(getBash(), [toBashPath(join(cwd, 'batch', 'batch-runner.sh')), ...args], {
    cwd,
    env,
    encoding: 'utf-8',
    timeout: 30000,
  });
}

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'career-ops-batch-jsonl-'));
  mkdirSync(join(root, 'batch'), { recursive: true });
  mkdirSync(join(root, 'bin'), { recursive: true });
  mkdirSync(join(root, 'data'), { recursive: true });
  mkdirSync(join(root, 'reports'), { recursive: true });
  mkdirSync(join(root, 'lib'), { recursive: true });
  mkdirSync(join(root, 'node_modules'), { recursive: true });
  writeFileSync(join(root, 'batch', 'batch-runner.sh'), readFileSync(join(ROOT, 'batch', 'batch-runner.sh')));
  writeFileSync(join(root, 'batch', 'provider.mjs'), readFileSync(join(ROOT, 'batch', 'provider.mjs')));
  writeFileSync(join(root, 'lib', 'is-main-module.mjs'), readFileSync(join(ROOT, 'lib', 'is-main-module.mjs')));
  cpSync(join(ROOT, 'node_modules', 'dotenv'), join(root, 'node_modules', 'dotenv'), { recursive: true });
  writeFileSync(join(root, 'batch', 'batch-prompt.md'), 'URL={{URL}}\nJD={{JD_FILE}}\nREPORT={{REPORT_NUM}}\n');
  writeFileSync(join(root, 'merge-tracker.mjs'), '');
  writeFileSync(join(root, 'reconcile-pipeline.mjs'), '');
  writeFileSync(join(root, 'verify-pipeline.mjs'), '');
  writeFileSync(join(root, 'reserve-report-num.mjs'), 'console.log("001");');
  writeFileSync(join(root, 'data', 'applications.md'), '# Applications Tracker\n');
  execFileSync(getBash(), ['-c', 'chmod +x batch/batch-runner.sh'], { cwd: root });
  return root;
}

try {
  const root = fixtureRoot();
  try {
    const input = join(root, 'jobs.filtered.jsonl');
    writeFileSync(input, `${JSON.stringify({
      schema_version: 'rerun_input.v1',
      job_url: 'https://www.linkedin.com/jobs/view/4458080466',
      raw_job: {
        id: '4458080466',
        companyName: 'Trade Republic',
        title: 'Accounting Intern',
        location: 'Berlin, Germany',
        description: 'CAPTURED JD ONE',
      },
    })}\n`);
    const binPath = process.platform === 'win32' ? toBashPath(join(root, 'bin')) : join(root, 'bin');
    const env = {
      ...process.env,
      CAREER_OPS_BATCH_PROVIDER: 'claude',
      PATH: `${binPath}${process.platform === 'win32' ? ':' : delimiter}${process.env.PATH}`,
    };
    const result = runBatch(['--jsonl', input, '--dry-run'], root, env);
    if (result.status === 0 && result.stdout.includes('4458080466') && !result.stdout.includes('Unknown option: --jsonl')) {
      pass('JSONL dry-run accepts captured input');
    } else {
      fail(`JSONL dry-run rejected input: status=${result.status} stdout=${result.stdout} stderr=${result.stderr}`);
    }

    const malformed = join(root, 'malformed.jsonl');
    writeFileSync(malformed, '{not-json}\n');
    const malformedResult = runBatch(['--jsonl', toBashPath(malformed), '--dry-run'], root, env);
    if (malformedResult.status !== 0) pass('malformed JSONL fails before processing');
    else fail('malformed JSONL unexpectedly succeeded');

    const duplicate = join(root, 'duplicate.jsonl');
    const duplicateRow = {
      schema_version: 'rerun_input.v1',
      job_url: 'https://www.linkedin.com/jobs/view/4458080466',
      raw_job: { id: '4458080466', description: 'DUPLICATE' },
    };
    writeFileSync(duplicate, `${JSON.stringify(duplicateRow)}\n${JSON.stringify(duplicateRow)}\n`);
    const duplicateResult = runBatch(['--jsonl', toBashPath(duplicate), '--dry-run'], root, env);
    if (duplicateResult.status !== 0) pass('duplicate JSONL identifiers fail before processing');
    else fail('duplicate JSONL identifiers unexpectedly succeeded');

    const missingUrl = join(root, 'missing-url.jsonl');
    writeFileSync(missingUrl, `${JSON.stringify({
      schema_version: 'rerun_input.v1',
      raw_job: { id: '7', description: 'NO URL' },
    })}\n`);
    const missingUrlResult = runBatch(['--jsonl', toBashPath(missingUrl), '--dry-run'], root, env);
    if (missingUrlResult.status !== 0) pass('JSONL without URL fails before processing');
    else fail('JSONL without URL unexpectedly succeeded');

    const missingDescription = join(root, 'missing-description.jsonl');
    writeFileSync(missingDescription, `${JSON.stringify({
      schema_version: 'rerun_input.v1',
      job_url: 'https://example.com/jobs/8',
      raw_job: { id: '8', description: '   ' },
    })}\n`);
    const missingDescriptionResult = runBatch(['--jsonl', toBashPath(missingDescription), '--dry-run'], root, env);
    if (missingDescriptionResult.status !== 0) pass('JSONL without raw_job.description fails before processing');
    else fail('JSONL without raw_job.description unexpectedly succeeded');

    if (!existsSync(join(root, 'batch', 'batch-input.tsv'))) pass('JSONL dry-run creates no persistent TSV');
    else fail('JSONL dry-run created persistent TSV');

    const captured = 'CAPTURED JD WITH \t TABS\nAND NEWLINES';
    writeFileSync(input, `${JSON.stringify({
      schema_version: 'rerun_input.v1',
      job_url: 'https://www.linkedin.com/jobs/view/4458080466',
      raw_job: {
        id: '4458080466',
        companyName: 'Trade Republic',
        title: 'Accounting Intern',
        location: 'Berlin, Germany',
        description: captured,
      },
    })}\n`);
    const curlMarker = join(root, 'curl-called');
    const capturedJd = join(root, 'captured-jd.txt');
    const bashEnv = join(root, 'bash-env');
    writeFileSync(join(root, 'bin', 'claude'), [
      '#!/usr/bin/env bash',
      'set -euo pipefail',
      'prompt_file=""',
      'for ((argument=1; argument<=$#; argument++)); do',
      '  if [[ "${!argument}" == "--append-system-prompt-file" ]]; then next=$((argument + 1)); prompt_file="${!next}"; fi',
      'done',
      'jd_file="$(sed -n \'s/^JD=//p\' "$prompt_file")"',
      'report_num="$(sed -n \'s/^REPORT=//p\' "$prompt_file")"',
      'root="$(cd "$(dirname "$prompt_file")/.." && pwd)"',
      'cat "$jd_file" > "$root/captured-jd.txt"',
      'printf "# fixture report\\n" > "$root/reports/${report_num}-fixture.md"',
      'printf "```json\\n{\\"status\\":\\"completed\\",\\"score\\":4.0}\\n```\\n"',
    ].join('\n') + '\n');
    writeFileSync(join(root, 'bin', 'curl'), [
      '#!/usr/bin/env bash',
      `touch "${toBashPath(curlMarker)}"`,
      'exit 1',
    ].join('\n') + '\n');
    execFileSync(getBash(), ['-c', 'chmod +x bin/claude bin/curl'], { cwd: root });
    writeFileSync(bashEnv, [
      'claude() {',
      '  local prompt_file=""',
      '  local argument next',
      '  for ((argument=1; argument<=$#; argument++)); do',
      '    if [[ "${!argument}" == "--append-system-prompt-file" ]]; then next=$((argument + 1)); prompt_file="${!next}"; fi',
      '  done',
      '  local jd_file report_num root',
      '  jd_file="$(sed -n \'s/^JD=//p\' "$prompt_file")"',
      '  report_num="$(sed -n \'s/^REPORT=//p\' "$prompt_file")"',
      '  root="$(cd "$(dirname "$prompt_file")/.." && pwd)"',
      '  cp "$prompt_file" "$root/resolved-prompt.md"',
      '  cat "$jd_file" > "$root/captured-jd.txt"',
      '  printf "# fixture report\\n" > "$root/reports/${report_num}-fixture.md"',
      '  printf "```json\\n{\\"status\\":\\"completed\\",\\"score\\":4.0}\\n```\\n"',
      '}',
      'curl() { touch "$BATCH_CURL_MARKER"; return 1; }',
    ].join('\n') + '\n');
    env.BASH_ENV = toBashPath(bashEnv);
    env.BATCH_CURL_MARKER = toBashPath(curlMarker);
    const workerResult = runBatch(['--jsonl', toBashPath(input), '--skip-pdf', '--rate-limit-sleep', '0'], root, env);
    if (workerResult.status === 0 && readFileSync(capturedJd, 'utf-8') === captured) pass('worker receives exact raw_job.description');
    else fail(`worker did not receive exact captured JD: status=${workerResult.status} stdout=${workerResult.stdout} stderr=${workerResult.stderr}`);
    if (!existsSync(curlMarker)) pass('captured JD skips curl prefetch');
    else fail('captured JD still invoked curl');
    if (readFileSync(join(root, 'resolved-prompt.md'), 'utf-8').includes('Never fetch, retrieve, or open the job URL')) {
      pass('captured JD prompt disables URL retrieval');
    } else {
      fail('captured JD prompt omitted URL retrieval prohibition');
    }

    writeFileSync(join(root, 'batch', 'batch-input.tsv'), 'id\turl\tsource\tnotes\n7\thttps://example.com/legacy\tfixture\tlegacy\n');
    const legacyResult = runBatch(['--dry-run'], root, env);
    if (legacyResult.status === 0 && legacyResult.stdout.includes('#7: https://example.com/legacy')) pass('legacy TSV input remains supported');
    else fail(`legacy TSV input failed: status=${legacyResult.status} stdout=${legacyResult.stdout} stderr=${legacyResult.stderr}`);

  } finally {
    rmSync(root, { recursive: true, force: true });
  }
} catch (error) {
  fail(`captured JSONL test crashed: ${error.message}`);
}
