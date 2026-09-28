# Cursor Office Visualizer

A macOS desktop office that turns **observed local Cursor agent activity** into truthful NPC movement and state.

## Product boundaries

- **Local-only observation.** Observes Cursor IDE and CLI sessions on this Mac via user-level hooks (`~/.cursor/hooks.json`). It does **not** cover managed Cloud Agents.
- **Viewer-only.** Hooks fail open and never steer Cursor. Responses are fixed by hook name (`permission` / `continue` / `{}`) and never emit follow-ups, context injection, or `failClosed`.
- **Closed-app gaps.** Activity while the app is closed is not reconstructed and is never claimed as observed. Source silence does **not** imply idle.
- **Privacy allowlist.** Persisted metadata is limited to identity/lease fields (conversation/generation/subagent ids, tool name/call id, cursor version, fingerprints, receipt time). Prompts, responses, thoughts, commands, tool I/O, file content, email, transcript paths, tokens, and raw bodies are never stored, logged, or shown.
- **One adapter, one skin.** Cursor hooks → canonical events → SQLite (`node:sqlite`) → PixiJS office. No plugin framework, no offline spool, no second source.

## Lifecycle (honest states)

| Signal | Consultant state |
| --- | --- |
| First unique work event | Active (observed) |
| Current-generation `stop` | Idle (observed); ambient motion allowed |
| App restart with unfinished generation | Stale (inferred); lease unchanged |
| Missing stop otherwise | Stays active until 24h lease |
| 24h after last unique observed activity | Leaves the office |
| Subagent | Collaborator; leaves on matched stop or 30m fallback |

## Develop

```bash
npm install
npm start                 # Electron Forge + Vite
npm run lint
npm run typecheck
npm test                  # domain/contract (Vitest)
npm run test:integration  # SQLite, installer, ingestion
npm run test:e2e          # packages then Playwright Electron (+ packaged spawn smoke)
npm run package           # local .app
npm run make              # zip/dmg artifacts
```

> Note: Electron fuses disable `EnableNodeCliInspectArguments`, so Playwright cannot CDP-attach to the hardened packaged binary. Packaged smoke uses process spawn + loopback ingest instead.


## Install / uninstall

1. Open the app and review the Connect Cursor preview (exact hook names, retained fields, command path, additive diff).
2. Confirm to merge Office-owned commands into `~/.cursor/hooks.json` without removing unrelated hooks.
3. A per-install CSPRNG token and loopback port file are stored next to the staged wrapper under app user data (mode `0600`). The wrapper resolves those paths relative to its own location so Cursor-spawned hooks work without Electron env vars. The Bearer token is passed to curl via a header file descriptor (never argv); stdin is piped (never a bash here-string temp file). The port file is deleted on quit.
4. Use **Integration → Uninstall** to remove only Office-owned hook entries, the mode-`0600` hooks backup and token, the staged wrapper, and the SQLite database including WAL/SHM sidecars.

Tests never touch the real `~/.cursor/hooks.json`; they use temporary directories via `CURSOR_OFFICE_HOOKS_PATH` / `CURSOR_OFFICE_USER_DATA`.

## Security notes

- Renderer: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Narrow `window.office` preload bridge (no Cursor controls, no arbitrary IPC).
- Ingestion authenticates before JSON parsing and rejects oversized bodies.

## License

Private — personal project.
