# Security policy

## Supported versions

Only the latest released version of Speedometer (the `version` in
[`.claude-plugin/plugin.json`](.claude-plugin/plugin.json) on `main`)
receives security fixes.

## Reporting a vulnerability

Please report security problems privately, not in a public issue:

1. Open <https://github.com/jameskbb/claude-code-speedometer/security/advisories/new>
   (the repository's **Security** tab, then **Report a vulnerability**).
2. Describe the problem, the plugin and Claude Code versions, and the steps
   that show it.

You should get a first reply within 7 days. Once a fix is released, the
advisory is published with credit to you unless you ask otherwise.

## Scope

In scope: the code in this repository, chiefly
[`hooks/register.tsx`](hooks/register.tsx) and
[`hooks/themes/`](hooks/themes/). Examples: a credential or token being
stored, logged or shown; data sent anywhere other than what
[PRIVACY.md](PRIVACY.md) lists; a file read or written beyond what it
lists.

Out of scope: Claude Code itself and Anthropic's services (report those to
Anthropic), and the optional ponytail plugin (report those to its own
repository).
