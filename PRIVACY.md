# Privacy policy

Effective date: 2026-11-05

This policy covers Speedometer, the Claude Code plugin in this repository
(`speedometer`, published by GitHub user jameskbb). It says what data the
plugin reads, where that data goes, how long it is kept, and how to delete
it. Every statement here can be checked against
[`hooks/register.tsx`](hooks/register.tsx), the plugin's only code that runs
in a session.

## Summary

- The plugin collects nothing for its developer. It has no server, no
  analytics and no telemetry, and the developer never receives any of your
  data.
- The plugin runs entirely on your machine, inside Claude Code.
- Its one possible network request goes to Anthropic, is off by default and
  is made only if you turn it on.
- It keeps a small history of rate-limit percentages on your machine for
  24 hours, and nothing else.
- No data is sold, rented or shared with anyone.

## What the plugin reads, and where it stays

### Session figures

To draw the pane and the band, the plugin reads figures the Claude Code
session already holds: context fill, token counts, session cost, Claude
Code's own 5-hour and weekly rate-limit readings, the model name, and the
start, steps and end of turns, tool calls and subagents (their type,
description, model and token count). These live only in the session's
in-memory state. They are not written to disk by the plugin and are not sent
anywhere. The plugin does not read your prompts, Claude's replies or the
content of tool calls.

### Its own settings

The plugin reads its own options from your Claude Code settings (the gauge
cluster and the burn-rate options you set under `/config`). If you saved a
gauge cluster under a name from an earlier version, it saves the same choice
again under the new name. It reads no other settings.

### The plugin store (kept on your machine)

The plugin keeps one value, `history`, in the private key-value store Claude
Code gives each plugin. For each rate-limit window it holds up to 300
readings, each a time and a percent used, and drops any reading older than
24 hours. It is used only to project the
[burn-rate warnings](README.md#burn-rate-warnings). A reading is added at
most once a minute: from the 5-hour and weekly figures Claude Code itself
reports, or, with the usage endpoint option on, from the endpoint's answer. The store holds no tokens, prompts, project names or
account details.

### Files of the optional ponytail plugin

The plugin works with the optional
[ponytail](https://github.com/DietrichGebert/ponytail) plugin, and everything
else works when ponytail is absent. It uses two files that ponytail keeps in
the `.claude` folder of your home directory:

- It reads ponytail's flag for the current project,
  `ponytail-modes/<SHA-256 of the project root path>`, when a session starts
  and at the start of each turn, to show ponytail's level in the band. The
  project path is hashed on your machine to find the file name and is not
  sent anywhere.
- It writes only when you press the band's ponytail badge: the next level
  (`lite`, `full` or `ultra`) goes into that project flag and into
  ponytail's shared `.ponytail-active` file, the same files ponytail's own
  `/ponytail` command writes. It then adds one line to the conversation,
  `PONYTAIL MODE CHANGED: level <level>`, so Claude follows the new level.

To find these files the plugin reads one environment variable, `HOME` (or
`USERPROFILE` on Windows when `HOME` is unset). It reads no other
environment variable and writes none.

## The usage endpoint (off by default)

The plugin can show your plan's per-model weekly window and more exact
reset times by reading Anthropic's usage endpoint, the one Claude Code's
`/usage` command reads. This is off by default. It runs only if you turn on
the `usageEndpoint` option under `/config`.

When it is on:

- **Destination**: `GET https://api.anthropic.com/api/oauth/usage`, on
  Anthropic's own host. No other destination is ever contacted.
- **What is sent**: no body, and one header from the plugin,
  `anthropic-beta: oauth-2025-04-20`. Claude Code attaches your session's
  sign-in itself. The plugin receives only an opaque handle, never the
  token, and never stores, logs or shows a credential. Without an Anthropic
  sign-in no request is made.
- **How often**: when a session starts, then at most once a minute. A
  request that has not answered within 5 seconds is abandoned.
- **What is kept**: each window's kind, percent used, reset time and, for
  the per-model window, the model's name, held in the session's state to
  draw the gauges, plus the percent readings in the plugin store described
  above. The rest of the response is discarded. Errors are dropped without
  being logged or shown.

Anthropic's handling of that request is covered by
[Anthropic's privacy policy](https://www.anthropic.com/legal/privacy).
Setting `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` makes Claude Code refuse
the request even when the option is on.

## Sharing and sale of data

The plugin sends no data to its developer or to any third party. No data is
sold, rented, traded or used for advertising or profiling. Apart from the
optional request to Anthropic above, nothing the plugin reads leaves your
machine.

## Retention and deletion

- Session figures exist only while the session runs.
- Percent readings in the plugin store are dropped after 24 hours as new
  readings arrive, and never exceed 300 per window.
- To delete the stored history at once, delete the plugin's store file. Claude
  Code keeps it as a JSON file named after the plugin in the `plugins/store`
  folder of your Claude Code configuration directory (by default
  `~/.claude/plugins/store/`, a file whose name starts with `speedometer_`).
  Deleting it is safe; the plugin starts a new history at the next reading.
- Uninstalling the plugin (`/plugin uninstall speedometer`) stops all
  reading and writing. Delete the store file as above to remove what was kept.
- The ponytail files belong to ponytail; the plugin writes only the level
  you choose and leaves the files in place.

## Children

The plugin is a developer tool for Claude Code and is not directed at
children.

## Changes to this policy

Changes are made in this file, in this repository, and the effective date
above is updated. The repository's commit history shows every earlier
version.

## Contact

Questions about this policy or the plugin's data handling: open an issue at
<https://github.com/jameskbb/claude-code-speedometer/issues>. Report a
security problem privately as described in [SECURITY.md](SECURITY.md).
