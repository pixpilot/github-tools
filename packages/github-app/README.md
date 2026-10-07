# @pixpilot/github-app

Create a GitHub release bot through the browser-based App Manifest flow and optionally configure Actions secrets. Credentials stay in memory by default; local backups are opt-in. Requires Node.js 24.15+; configuration commands also require [GitHub CLI](https://cli.github.com/).

## Create the app

**Terminal → this repository**

1. Run the interactive CLI:

   ```sh
   pnpm --filter @pixpilot/github-app dev create releaser
   ```

2. Enter the owning organization, app name, and installation scope.
3. Choose optional repository or organization Actions secrets; prefer organization secrets when sharing credentials.
4. Confirm creation in the [GitHub](https://github.com/) browser page opened by the CLI.
5. Install the app and select its repositories on the installation page opened next.

Supply flags to skip prompts. For example, on Windows:

```powershell
pnpm --filter @pixpilot/github-app dev create releaser --org pixpilot --name "Pixpilot Releaser" --repo pixpilot/github-tools
```

For an installed or published package, use `github-app create releaser` or `npx @pixpilot/github-app create releaser`.

GitHub generates the private key. The CLI uses it in memory for optional Actions secret setup and creates no PEM or metadata files by default. To retain a local backup, pass `--key-path` with an absolute path outside any Git repository; this saves the PEM and adjacent JSON metadata.

Default permissions: Checks, Contents, Issues, and Pull requests write; Metadata read. Webhooks and event subscriptions are disabled. Use `--include-secrets` only if the bot needs to list secret metadata. Use `--install-target any` to allow installation across accounts, or `--personal --owner LOGIN` for a personally owned app.

## Create from a JSON manifest

**Terminal → this repository**

1. Save the app settings as a JSON file, using double quotes:

   ```json
   {
     "name": "PixPilot Releaser",
     "url": "https://github.com/pixpilot",
     "description": "Internal bot to handle automatic releases of packages.",
     "public": false,
     "default_permissions": {
       "checks": "write",
       "contents": "write",
       "issues": "write",
       "pull_requests": "write",
       "metadata": "read"
     }
   }
   ```

2. Run the CLI with your file, or use the included [example](examples/releaser.json):

   ```sh
   pnpm --filter @pixpilot/github-app dev create releaser --manifest examples/releaser.json --repo pixpilot/github-tools
   ```

3. Confirm creation on GitHub, then select repositories on the installation page.

The CLI infers the owning organization from `https://github.com/<account>`. Use `--org` to override it, or `--personal --owner` for a personally owned app. Supplied name and visibility skip their prompts. CLI flags override file settings; omitted fields use the release defaults. A supplied `default_permissions` object replaces the defaults completely, and `--include-secrets` explicitly adds Secrets read. The temporary callback and disabled webhooks remain managed by the CLI. Supported JSON fields: `name`, `url`, `description`, `public`, and `default_permissions`.

## Configure shared secrets

**Terminal → GitHub CLI authentication**

1. Authenticate with `gh auth login`, set `GH_TOKEN`/`GITHUB_TOKEN`, or enter the masked token when prompted.
2. Configure selected repositories at organization level:

   ```sh
   github-app configure-secrets --app-id 12345 --key-path /secure/releaser.pem --secrets-org pixpilot --repo pixpilot/github-tools --repo pixpilot/another-repo
   ```

3. Use repeated `--repo OWNER/REPO` without `--secrets-org` for individual repository secrets.

| CLI secret             | Existing release workflow      |
| ---------------------- | ------------------------------ |
| `RELEASER_ID`          | `secrets.RELEASER_ID`          |
| `RELEASER_PRIVATE_KEY` | `secrets.RELEASER_PRIVATE_KEY` |

Use `--secret-prefix MY_RELEASER` for `MY_RELEASER_ID` and `MY_RELEASER_PRIVATE_KEY`. Organization secrets default to `--visibility selected`; `private` or `all` must be explicit. Existing secrets with the same names are replaced.

## Configure an explicit branch bypass

**Terminal → classic GitHub branch protection**

1. Install the app in the repository first.
2. Run the separate command only when you want the app to bypass required pull requests:

   ```sh
   github-app configure-branch-protection --slug pixpilot-releaser --repo pixpilot/github-tools --branch main --branch next
   ```

The command retains existing bypass actors and review settings. Creation never changes branch protection. Concrete branches only; rulesets and wildcard protection rules need separate configuration.

## Verify

**GitHub → organization Settings → Developer settings → GitHub Apps**

1. Open the app and check its permissions and installation scope.
2. Check the App ID and slug printed by the CLI; if you requested `--key-path`, check that backup and its adjacent `.json` metadata file.
3. Open **GitHub → repository Settings → Secrets and variables → Actions** and check the two configured secrets, or organization access under **GitHub → organization Settings → Secrets and variables → Actions**.
4. Run your release workflow after installation approval; its token step should authenticate as the app.

## Gotchas

- GitHub app names must be unique; edit the name on GitHub if it reports a conflict.
- Organization owners may need to approve creation or installation; organization policy can restrict apps.
- App creation uses the GitHub browser session, never a PAT; operator tokens are only used for optional configuration and are not saved.
- Repository Secrets read exposes metadata, never plaintext values; release authentication does not need it.
- An optional PEM backup is written with mode `0600` on POSIX or a current-user Windows ACL; private keys must stay outside Git repositories.
- Existing files at `--key-path` require `--overwrite`; overwrite requires an explicit path. Symlinks and directories are rejected. Unused client and webhook secrets are discarded.
- Ctrl+C cancels; closing the browser times out after 600 seconds (`--timeout` up to 3600). An occupied `--port` falls back to an available port.
- Expired codes and exchange failures require restarting creation. If the app already exists, generate a replacement key in GitHub app settings instead of creating a duplicate.
- If secret configuration fails partway through, earlier secrets may be updated; retry with your optional backup, or generate a new key in GitHub app settings and run `configure-secrets`.
- Without Actions secret setup or a local backup, the generated private key is not retained; generate a new one in GitHub app settings when needed. GitHub retains only the public portion of private keys; OAuth client secrets serve a different purpose. See [private keys](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps).
- `gh` needs repository Secrets write or organization Secrets write permission; classic tokens need `repo` or `admin:org` respectively. Bypass configuration needs repository Administration write. The releaser app itself is not granted these operator permissions.
- GitHub Free organizations cannot use organization secrets in private repositories; use repository secrets or an eligible organization plan.
- `--no-open` prints browser URLs, `--no-install` skips opening installation, and `--no-secrets` skips secret setup. Use `github-app install --slug APP_SLUG` to install later.
- Run `github-app --help` for all flags.
- With `pnpm --filter @pixpilot/github-app dev`, relative manifest paths start in `packages/github-app`; use an absolute path for a file elsewhere.

Flow reference: [GitHub App manifests](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest), [Actions secrets](https://cli.github.com/manual/gh_secret_set), [review protection](https://docs.github.com/en/rest/branches/branch-protection#update-pull-request-review-protection).
