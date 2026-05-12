import type { Viewport } from 'next'
import ChoiceGate from './ChoiceGate'

// Scoped to "/" only — overrides the root layout's themeColor: '#000'
// so the mobile browser URL bar matches the white .gate column instead
// of clashing with it. Other routes continue to inherit root's #000.
export const viewport: Viewport = {
  themeColor: '#fff',
}

export default function Page() {
  return <ChoiceGate />
}
