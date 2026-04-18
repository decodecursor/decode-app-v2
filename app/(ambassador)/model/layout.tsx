/**
 * Model layout — passthrough wrapper.
 *
 * Auth and profile guards are handled per-route:
 *   - model/page.tsx (dashboard): server-side session + profile check
 *   - model/settings/page.tsx: client-side session check
 *   - model/setup/layout.tsx: server-side session + "no existing
 *     profile" check (added after Slice 1 retro)
 *   - model/auth/*: public
 */
export default function ModelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
