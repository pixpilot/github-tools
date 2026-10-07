export interface ManifestOptions {
  owner: string;
  name?: string | undefined;
  installationTarget?: 'owner' | 'any' | undefined;
  includeSecrets?: boolean | undefined;
  manifest?: ManifestConfig | undefined;
}

export interface Manifest {
  name: string;
  description: string;
  url: string;
  redirect_url: string;
  callback_urls: string[];
  public: boolean;
  hook_attributes: { active: false; url: string };
  default_permissions: Record<string, 'read' | 'write'>;
  default_events: string[];
}

export type ManifestConfig = Partial<
  Pick<Manifest, 'name' | 'url' | 'description' | 'public' | 'default_permissions'>
>;

export interface AppCredentials {
  id: number;
  slug: string;
  client_id: string;
  html_url: string;
  pem: string;
}

export type SecretTarget =
  | { kind: 'repositories'; repositories: string[] }
  | {
      kind: 'organization';
      organization: string;
      visibility: 'selected' | 'private' | 'all';
      repositories?: string[];
    };

export type RunCommand = (
  command: string,
  args: string[],
  options?: { input?: string; env?: NodeJS.ProcessEnv },
) => Promise<string>;

export interface CliValues {
  manifest?: string;
  org?: string;
  owner?: string;
  personal?: boolean;
  name?: string;
  'install-target'?: string;
  'key-path'?: string;
  overwrite?: boolean;
  'include-secrets'?: boolean;
  repo?: string[];
  'secrets-org'?: string;
  visibility?: string;
  'secret-prefix'?: string;
  'no-secrets'?: boolean;
  'no-open'?: boolean;
  'no-install'?: boolean;
  port?: string;
  timeout?: string;
  'app-id'?: string;
  slug?: string;
  branch?: string[];
  help?: boolean;
}
