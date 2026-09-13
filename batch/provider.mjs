import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';
import { isMainModule } from '../lib/is-main-module.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function resolveBatchProvider(requested = 'auto', env = process.env, envPath = join(ROOT, '.env')) {
  const provider = String(requested || 'auto').trim().toLowerCase();
  if (!['auto', 'openai', 'claude'].includes(provider)) {
    throw new Error('provider must be auto, openai, or claude');
  }
  if (provider !== 'auto') return provider;

  const fileEnv = existsSync(envPath) ? dotenv.parse(readFileSync(envPath, 'utf8')) : {};
  const settings = { ...fileEnv, ...env };
  return ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_MODEL']
    .some((key) => String(settings[key] || '').trim()) ? 'openai' : 'claude';
}

if (isMainModule(import.meta.url)) {
  try {
    console.log(resolveBatchProvider(process.argv[2], process.env, process.argv[3]));
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
  }
}
