# Cursor Office Visualizer

A macOS desktop office that turns **observed local Cursor agent activity** into truthful NPC movement and state.

This repository starts from an implementation-ready plan. Application code lands in stacked feature PRs (`feat/u1` … `feat/u7`).

## Product boundaries (MVP)

- **Local-only observation.** The app observes Cursor IDE and CLI sessions on this Mac via user-level hooks. It does not claim Cloud Agent coverage.
- **Viewer-only.** Hooks fail open and never steer Cursor (no follow-ups, approvals, or prompt injection).
- **Closed-app gaps.** Activity while the app is closed is not reconstructed. Source silence never implies idle.
- **Privacy.** Only an allowlisted metadata set is persisted. Prompts, responses, thoughts, commands, tool I/O, file content, email, transcript paths, tokens, and raw bodies are never stored.
- **One adapter, one skin.** Cursor hooks → canonical events → SQLite → PixiJS office. No plugin framework.

## Status

See [`docs/plans/2026-09-28-001-feat-cursor-office-visualizer-plan.md`](docs/plans/2026-09-28-001-feat-cursor-office-visualizer-plan.md) for requirements, KTDs, and units U1–U7.

## Uninstall (once the app ships)

Use the in-app Integration settings to remove only Office-owned hook entries, the install token, SQLite files (including WAL/SHM), and the local hooks backup. Unrelated Cursor hooks are preserved.

## License

Private — personal project.
