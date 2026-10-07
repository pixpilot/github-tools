import type { RunCommand } from './types';
import process from 'node:process';
import { CliError } from './cli-error';
import { ensureInput } from './ensure-input';
import { runCommand } from './run-command';

interface ReviewProtection {
  dismiss_stale_reviews: boolean;
  require_code_owner_reviews: boolean;
  required_approving_review_count: number;
  require_last_push_approval?: boolean;
  bypass_pull_request_allowances?: {
    users: { login: string }[];
    teams: { slug: string }[];
    apps: { slug: string }[];
  };
}

const FIRST_PRINTABLE_CHARACTER = 32;

// Adds an explicitly requested app bypass while retaining existing actors and review settings.
export async function configureBranchProtection(options: {
  slug: string;
  repositories: string[];
  branches: string[];
  env?: NodeJS.ProcessEnv;
  run?: RunCommand;
}): Promise<void> {
  ensureInput(options.slug, 'slug');
  if (!options.repositories.length || !options.branches.length)
    throw new CliError('Explicit --repo and --branch values are required.');
  options.repositories.forEach((repository) => ensureInput(repository, 'repository'));
  if (
    options.branches.some(
      (branch) =>
        !branch ||
        /[*?[\]]/u.test(branch) ||
        [...branch].some(
          (character) => character.codePointAt(0)! < FIRST_PRINTABLE_CHARACTER,
        ),
    )
  )
    throw new CliError(
      'Provide concrete branch names; wildcard rules and rulesets are not supported.',
    );
  const run = options.run ?? runCommand;
  const env = { ...process.env, ...options.env, GH_HOST: 'github.com' };
  const plans: { endpoint: string; body: string }[] = [];
  try {
    for (const repository of [...new Set(options.repositories)]) {
      for (const branch of [...new Set(options.branches)]) {
        const endpoint = `repos/${repository}/branches/${encodeURIComponent(branch)}/protection/required_pull_request_reviews`;
        // Read protections in sequence to stop before any write if a protection is missing.
        // eslint-disable-next-line no-await-in-loop
        const response = await run('gh', ['api', '--hostname', 'github.com', endpoint], {
          env,
        });
        const data: unknown = JSON.parse(response);
        if (data === null || typeof data !== 'object')
          throw new Error('Invalid protection response');
        const current = data as ReviewProtection;
        if (
          typeof current.dismiss_stale_reviews !== 'boolean' ||
          typeof current.require_code_owner_reviews !== 'boolean' ||
          typeof current.required_approving_review_count !== 'number'
        )
          throw new Error('Invalid review settings');
        const actors = current.bypass_pull_request_allowances;
        const apps = actors?.apps.map((app) => app.slug) ?? [];
        if (apps.includes(options.slug)) continue;
        const body = JSON.stringify({
          dismiss_stale_reviews: current.dismiss_stale_reviews,
          require_code_owner_reviews: current.require_code_owner_reviews,
          required_approving_review_count: current.required_approving_review_count,
          ...(current.require_last_push_approval === undefined
            ? {}
            : { require_last_push_approval: current.require_last_push_approval }),
          bypass_pull_request_allowances: {
            users: actors?.users.map((user) => user.login) ?? [],
            teams: actors?.teams.map((team) => team.slug) ?? [],
            apps: [...apps, options.slug],
          },
        });
        plans.push({ endpoint, body });
      }
    }
    for (const plan of plans) {
      // Apply changes in sequence so failure stops further branch updates.
      // eslint-disable-next-line no-await-in-loop
      await run(
        'gh',
        [
          'api',
          '--hostname',
          'github.com',
          '--method',
          'PATCH',
          plan.endpoint,
          '--input',
          '-',
        ],
        { env, input: plan.body },
      );
    }
  } catch {
    throw new CliError(
      'Branch protection configuration failed; earlier branches may already be updated. Ensure the app is installed, branch review protection exists, and your operator token has repository Administration write access. Rulesets must be configured separately.',
    );
  }
}
