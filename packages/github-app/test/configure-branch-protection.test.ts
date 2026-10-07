import type { RunCommand } from '../src/types';
import { describe, expect, it, vi } from 'vitest';
import { configureBranchProtection } from '../src/configure-branch-protection';

const protection = {
  dismiss_stale_reviews: true,
  require_code_owner_reviews: true,
  required_approving_review_count: 2,
  require_last_push_approval: true,
  bypass_pull_request_allowances: {
    users: [{ login: 'owner' }],
    teams: [{ slug: 'admins' }],
    apps: [{ slug: 'existing-app' }],
  },
};

describe('configureBranchProtection', () => {
  it('should preserve existing actors and review settings when adding the app', async () => {
    const run = vi
      .fn<RunCommand>()
      .mockResolvedValueOnce(JSON.stringify(protection))
      .mockResolvedValueOnce('');
    await configureBranchProtection({
      slug: 'my-releaser',
      repositories: ['pixpilot/one'],
      branches: ['release/beta'],
      run,
    });
    expect(run.mock.calls[0]?.[1]).toContain(
      'repos/pixpilot/one/branches/release%2Fbeta/protection/required_pull_request_reviews',
    );
    expect(run.mock.calls[1]?.[1]).toContain('PATCH');
    expect(JSON.parse(run.mock.calls[1]?.[2]?.input ?? '{}')).toEqual({
      ...protection,
      bypass_pull_request_allowances: {
        users: ['owner'],
        teams: ['admins'],
        apps: ['existing-app', 'my-releaser'],
      },
    });
  });

  it('should skip an app that already has bypass access', async () => {
    const run = vi.fn<RunCommand>().mockResolvedValue(JSON.stringify(protection));
    await configureBranchProtection({
      slug: 'existing-app',
      repositories: ['pixpilot/one'],
      branches: ['main'],
      run,
    });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('should read all requested protections before applying any updates', async () => {
    const run = vi
      .fn<RunCommand>()
      .mockResolvedValueOnce(JSON.stringify(protection))
      .mockRejectedValueOnce(new Error('Not protected'));
    await expect(
      configureBranchProtection({
        slug: 'my-releaser',
        repositories: ['pixpilot/one'],
        branches: ['main', 'beta'],
        run,
      }),
    ).rejects.toThrow('Branch protection configuration failed');
    expect(run.mock.calls.some((call) => call[1].includes('PATCH'))).toBe(false);
  });

  it.each([{ branches: [] }, { branches: ['release/*'] }])(
    'should reject missing or wildcard branches',
    async ({ branches }) => {
      const run = vi.fn<RunCommand>();
      await expect(
        configureBranchProtection({
          slug: 'my-releaser',
          repositories: ['pixpilot/one'],
          branches,
          run,
        }),
      ).rejects.toThrow();
      expect(run).not.toHaveBeenCalled();
    },
  );
});
