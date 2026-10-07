export const help = `github-app create releaser [options]
github-app install --slug APP_SLUG [--no-open]
github-app configure-secrets --app-id ID --key-path PATH [secret options]
github-app configure-branch-protection --slug APP_SLUG --repo OWNER/REPO --branch main

Create options (missing required values are prompted):
  --manifest PATH             JSON app settings; CLI flags override file settings
  --org NAME                  Organization that owns the app
  --personal --owner LOGIN    Create under a personal account
  --name NAME                 App name (default: My Releaser)
  --install-target owner|any  Installation scope (default: owner)
  --key-path PATH             Optional local backup; no credential files by default
  --overwrite                 Replace existing backup files; requires --key-path
  --include-secrets           Add repository Secrets read (metadata only)
  --port NUMBER               Preferred callback port (default: available port)
  --timeout SECONDS           Authorization timeout (default: 600, maximum: 3600)
  --no-open                   Print browser URLs without opening them
  --no-install                Skip opening the installation page
  --no-secrets                Skip optional secret configuration

Secret options:
  --repo OWNER/REPO           Repeat for multiple repositories
  --secrets-org NAME          Prefer organization secrets for shared credentials
  --visibility selected|private|all  Organization visibility (default: selected)
  --secret-prefix NAME       Default: RELEASER (matches this repo's release workflow)

Configuration uses gh auth or GH_TOKEN/GITHUB_TOKEN, then a masked token prompt.
Secrets are sent on stdin; tokens and private keys are never logged.
Creation keeps credentials in memory for secret setup. --key-path opts into a PEM/JSON backup.
Without secret setup or a backup, generate a new private key in GitHub settings when needed.
Branch protection changes only on the explicit configure-branch-protection command.
Repeat --branch for multiple concrete branches. Classic protection only; no rulesets.
Manifest fields: name, url, description, public, default_permissions.
A GitHub account homepage infers the owner; otherwise supply --org or --personal --owner.
File permissions replace the release defaults; --include-secrets explicitly adds Secrets read.
The CLI manages the temporary callback and keeps webhooks disabled.
App creation always requires GitHub's browser-based manifest flow.`;
