'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const STYLES = `
.gate-root, .gate-root * { box-sizing: border-box; margin: 0; padding: 0; }
html.gate-html, body.gate-body { background: #000; height: 100%; }
body.gate-body {
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  min-height: 100vh;
  color: #FFF;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow-x: hidden;
}
body.overlay-open { overflow: hidden; }

.gate {
  max-width: 440px;
  margin: 0 auto;
  min-height: 100vh;
  padding: env(safe-area-inset-top) 28px env(safe-area-inset-bottom);
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.gate-trigger {
  position: absolute;
  top: calc(env(safe-area-inset-top) + 28px);
  right: 28px;
  font-size: 12px;
  color: #FFF;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  letter-spacing: 0.6px;
  padding: 8px;
  margin: -8px;
  opacity: 0.85;
  transition: opacity 0.2s ease;
  z-index: 10;
}
.gate-trigger:hover { opacity: 1; }
.gate-trigger:active { opacity: 0.6; }

.gate-logo-wrap {
  margin-top: 96px;
  margin-bottom: auto;
}
.gate-logo {
  height: 32px;
  width: auto;
  display: block;
  filter: brightness(0) invert(1);
}

.gate-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding-bottom: 160px;
  align-items: stretch;
}
.gate-link {
  display: block;
  width: 100%;
  background: transparent;
  color: #FFF;
  border: none;
  padding: 22px 20px;
  text-align: center;
  font-size: 14px;
  font-weight: 400;
  letter-spacing: 0.5px;
  text-decoration: none;
  font-family: inherit;
  cursor: pointer;
  transition: opacity 0.2s ease;
}
.gate-link:hover { opacity: 0.65; }
.gate-link:active { opacity: 0.5; }

.founder-overlay {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 50;
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
  pointer-events: none;
}
.founder-overlay.shown {
  transform: translateY(0);
  pointer-events: auto;
}
.founder-inner {
  max-width: 440px;
  margin: 0 auto;
  position: relative;
}
.founder-nav {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 32px 28px 80px;
  width: 100%;
}
.founder-logo {
  height: 26px;
  width: auto;
  display: block;
  filter: brightness(0) invert(1);
  margin-right: auto;
}
.founder-close {
  font-size: 28px;
  color: #FFF;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 0.8;
  padding: 8px 12px;
  margin: -8px -12px -8px auto;
  font-weight: 300;
  font-family: inherit;
}
.founder-content {
  text-align: center;
  padding: 0 32px 80px;
}
.founder-line {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 21px;
  line-height: 1.45;
  color: #FFF;
  margin-bottom: 20px;
  font-weight: 400;
  letter-spacing: -0.2px;
}
.founder-line.cta {
  font-weight: 600;
  margin-top: 8px;
  margin-bottom: 24px;
}
.founder-signature {
  display: block;
  margin: 0 auto;
  height: 280px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
}

.bloom {
  position: fixed;
  inset: 0;
  z-index: 100;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.5s ease;
  background: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.bloom.active {
  opacity: 1;
}
.bloom-img {
  width: 130%;
  height: 130%;
  object-fit: cover;
  transform: scale(1.04);
  transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.bloom.active .bloom-img {
  transform: scale(1);
}
`

export default function ChoiceGate() {
  const [founderShown, setFounderShown] = useState(false)
  const [bloomActive, setBloomActive] = useState(false)

  // Pure black background scoped to this route — flip classes on
  // <html>/<body> on mount and remove them on unmount so the rest of
  // the app keeps its own chrome.
  useEffect(() => {
    document.documentElement.classList.add('gate-html')
    document.body.classList.add('gate-body')
    return () => {
      document.documentElement.classList.remove('gate-html')
      document.body.classList.remove('gate-body')
      document.body.classList.remove('overlay-open')
    }
  }, [])

  const founderOverlayRef = useRef<HTMLDivElement | null>(null)

  const openFounder = useCallback(() => {
    setFounderShown(true)
    document.body.classList.add('overlay-open')
    if (founderOverlayRef.current) founderOverlayRef.current.scrollTop = 0
  }, [])

  const dismissFounder = useCallback(() => {
    setFounderShown(false)
    document.body.classList.remove('overlay-open')
  }, [])

  useEffect(() => {
    if (!founderShown) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissFounder()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [founderShown, dismissFounder])

  const handleGateClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const target = e.currentTarget.getAttribute('data-target') || ''
    setBloomActive(true)
    // Bloom stays up through navigation — no fade-out, so the gate
    // never flashes back into view between transitions.
    setTimeout(() => {
      window.location.href = target
    }, 1100)
  }

  return (
    <div className="gate-root">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500;1,600;1,700&family=Inter:wght@400;500;600&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <main className="gate">
        <button
          className="gate-trigger"
          type="button"
          onClick={openFounder}
        >
          A note from us →
        </button>
        <div className="gate-logo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gate-logo" src="/logo.png" alt="DECODE" />
        </div>
        <div className="gate-actions">
          {/* Hard nav (window.location.href) on click is intentional —
              the bloom-then-navigate sequence requires the full ~1.1s
              ceremony and a full page load, not a Next.js client
              transition. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            className="gate-link"
            href="/ambassador"
            data-target="/ambassador"
            onClick={handleGateClick}
          >
            I&apos;m an Ambassador →
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            className="gate-link"
            href="/professional"
            data-target="/professional"
            onClick={handleGateClick}
          >
            I&apos;m a Beauty Professional →
          </a>
        </div>
      </main>

      <div
        ref={founderOverlayRef}
        className={`founder-overlay${founderShown ? ' shown' : ''}`}
        role="dialog"
        aria-label="A note from the founder"
        aria-hidden={!founderShown}
      >
        <div className="founder-inner">
          <nav className="founder-nav">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="founder-logo" src="/logo.png" alt="DECODE" />
            <button
              className="founder-close"
              type="button"
              aria-label="Close"
              onClick={dismissFounder}
            >
              ×
            </button>
          </nav>
          <div className="founder-content">
            <p className="founder-line">The beauty industry is broken.</p>
            <p className="founder-line">Trust is at an all-time low.</p>
            <p className="founder-line">We put our heart and soul into crafting tools to fix what has been lost.</p>
            <p className="founder-line cta">Come build it with us.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="founder-signature"
              src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/founder/Signature_no%20line.png"
              alt="Sila"
            />
          </div>
        </div>
      </div>

      <div className={`bloom${bloomActive ? ' active' : ''}`} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="bloom-img"
          src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/brand/DECODE%20Pattern_4k.jpeg"
          alt=""
        />
      </div>
    </div>
  )
}
