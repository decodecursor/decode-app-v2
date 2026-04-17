/**
 * Model layout — passthrough wrapper.
 *
 * Auth guards are handled per-page, NOT here:
 *   - model/page.tsx (dashboard): server-side getUser() + redirect
 *   - model/settings/page.tsx: client-side getUser() + redirect
 *   - model/auth/* and model/setup: public, no guard needed
 *
 * Previous implementation used headers().get('x-pathname') to detect
 * public paths, but Next.js App Router doesn't set that header,
 * causing an infinite redirect loop on /model/auth and /model/setup.
 */
export default function ModelLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
