'use client'

import { useCallback, useEffect, useState } from 'react'

const FOUNDER_SEEN_KEY = 'decode_founder_seen_v1'

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

.gate {
  max-width: 440px;
  margin: 0 auto;
  min-height: 100vh;
  padding: env(safe-area-inset-top) 28px env(safe-area-inset-bottom);
  display: flex;
  flex-direction: column;
  align-items: center;
  opacity: 0;
  transition: opacity 0.5s ease;
}
.gate.visible { opacity: 1; }

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
  gap: 14px;
  width: 100%;
  padding-bottom: 80px;
}
.gate-btn {
  display: block;
  background: transparent;
  color: #FFF;
  border: 1px solid #FFF;
  padding: 22px;
  text-align: center;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-decoration: none;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.25s ease;
}
.gate-btn:hover { background: rgba(255, 255, 255, 0.06); }
.gate-btn:active { background: rgba(255, 255, 255, 0.1); }

.founder-overlay {
  position: fixed;
  inset: 0;
  background: #000;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: env(safe-area-inset-top) 32px env(safe-area-inset-bottom);
  opacity: 0;
  transition: opacity 0.6s ease;
  pointer-events: none;
  visibility: hidden;
}
.founder-overlay.shown {
  opacity: 1;
  pointer-events: auto;
  visibility: visible;
}
.founder-close {
  position: absolute;
  top: calc(env(safe-area-inset-top) + 22px);
  right: 24px;
  font-size: 28px;
  color: #FFF;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 0.8;
  padding: 8px 12px;
  font-weight: 300;
  font-family: inherit;
  opacity: 0.7;
  transition: opacity 0.2s ease;
}
.founder-close:hover { opacity: 1; }
.founder-content {
  text-align: center;
  max-width: 360px;
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
  font-weight: 500;
  margin-top: 8px;
  margin-bottom: 36px;
}
.founder-signature {
  display: block;
  margin: 0 auto;
  height: 56px;
  width: auto;
  max-width: 220px;
  object-fit: contain;
}
.founder-continue {
  position: absolute;
  bottom: calc(env(safe-area-inset-bottom) + 32px);
  left: 0;
  right: 0;
  text-align: center;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  letter-spacing: 0.6px;
  padding: 12px;
  transition: color 0.2s ease;
}
.founder-continue:hover { color: #FFF; }

.bloom {
  position: fixed;
  inset: 0;
  z-index: 100;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.55s ease;
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
  transform: scale(1.08);
  transition: transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
}
.bloom.active .bloom-img {
  transform: scale(1);
}
`

export default function ChoiceGate() {
  const [founderShown, setFounderShown] = useState(false)
  const [gateVisible, setGateVisible] = useState(false)
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
    }
  }, [])

  // First-visit decision: show founder note unless localStorage flag is set.
  useEffect(() => {
    let alreadySeen = false
    try {
      alreadySeen = !!localStorage.getItem(FOUNDER_SEEN_KEY)
    } catch {}
    if (alreadySeen) {
      setGateVisible(true)
      return
    }
    const t = setTimeout(() => setFounderShown(true), 150)
    return () => clearTimeout(t)
  }, [])

  const dismissFounder = useCallback(() => {
    setFounderShown(false)
    try {
      localStorage.setItem(FOUNDER_SEEN_KEY, '1')
    } catch {}
    setTimeout(() => setGateVisible(true), 400)
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
    setTimeout(() => {
      window.location.href = target
    }, 700)
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

      <main className={`gate${gateVisible ? ' visible' : ''}`}>
        <div className="gate-logo-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gate-logo" src="/logo.png" alt="DECODE" />
        </div>
        <div className="gate-actions">
          {/* Hard nav (window.location.href) on click is intentional —
              the bloom-then-navigate sequence requires a 700ms delay
              and a full page load, not a Next.js client transition. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            className="gate-btn"
            href="/ambassador"
            data-target="/ambassador"
            onClick={handleGateClick}
          >
            I&apos;m an Ambassador
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            className="gate-btn"
            href="/professional"
            data-target="/professional"
            onClick={handleGateClick}
          >
            I&apos;m a Beauty Professional
          </a>
        </div>
      </main>

      <div
        className={`founder-overlay${founderShown ? ' shown' : ''}`}
        role="dialog"
        aria-label="A note from the founder"
      >
        <button
          className="founder-close"
          type="button"
          aria-label="Close"
          onClick={dismissFounder}
        >
          ×
        </button>
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
        <div
          className="founder-continue"
          role="button"
          tabIndex={0}
          onClick={dismissFounder}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              dismissFounder()
            }
          }}
        >
          Continue ↓
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
