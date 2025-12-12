# CLAUDE.md

## Communication
Be brief. Short answers first. I'll ask if I need more.
No walls of text. No over-explaining.

## Permissions
Never ask to read files. Always explore the codebase freely.
Ask before writing/deleting files or running destructive commands.

## Database
- Supabase MCP connected (read-only)
- Always use Supabase MCP to check schema, tables, data
- Never ask permission to query Supabase

## Supabase Client Usage
- Client components: `@/utils/supabase/client`
- Server/API routes: `@/utils/supabase/server`
- Admin operations: `@/utils/supabase/service-role`
- `lib/supabase.ts` is deprecated — don't use

## Commands
- `npm run validate` — Run all checks
- `npm run dev` — Dev server

## Conventions
- Imports: `@/` path alias
- Components: PascalCase, Hooks: `use` prefix
- Commits: `PREFIX: description` (FIX, FEAT, UI, REFACTOR)

## Shortcuts
- **"push"** → stage all, commit with proper prefix, push to GitHub

## Principles
- Keep changes minimal and simple
- < 20 lines: Just do it
- Bigger changes: Brief plan, wait for approval
- If uncertain, ask