import type { Manifest } from './types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// Serves the POST form required by GitHub's manifest flow, with a no-script fallback.
export function manifestPage(manifest: Manifest, action: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Create release bot</title></head>
<body><h1>Create ${escapeHtml(manifest.name)}</h1><p>Continue on GitHub to create your app.</p>
<form method="post" action="${escapeHtml(action)}">
<input type="hidden" name="manifest" value="${escapeHtml(JSON.stringify(manifest))}">
<button type="submit">Continue to GitHub</button></form>
<script>document.forms[0].submit()</script></body></html>`;
}
