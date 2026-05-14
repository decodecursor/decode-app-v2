'use client'

import { useCallback, useEffect, useState } from 'react'

const STYLES = `
.amb-program-root, .amb-program-root * { box-sizing: border-box; margin: 0; padding: 0; }
html.amb-program-html, body.amb-program-body { background: #000; }
body.amb-program-body {
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  min-height: 100vh;
  color: #FFF;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body.amb-program-overlay-open { overflow: hidden; height: 100vh; }

.amb-program-page {
  max-width: 440px;
  margin: 0 auto;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
}
.amb-program-top-space { height: 32px; }

.amb-program-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 28px 110px;
}
.amb-program-wordmark-logo {
  height: 26px;
  width: auto;
  display: block;
  filter: brightness(0) invert(1);
}
.amb-program-story-link {
  font-size: 12px;
  color: #FFF;
  letter-spacing: 0.6px;
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
  padding: 8px;
  margin: -8px;
}
.amb-program-close-link {
  font-size: 28px;
  color: #FFF;
  cursor: pointer;
  line-height: 0.8;
  padding: 8px 12px;
  margin: -8px -12px;
  font-weight: 300;
  background: none;
  border: none;
  font-family: inherit;
}

.amb-program-section { padding: 0 28px 80px; text-align: center; }
.amb-program-section-intro { padding: 0 28px 96px; text-align: center; }

.amb-program-eyebrow {
  font-size: 11px;
  letter-spacing: 3.6px;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 34px;
  font-weight: 500;
  line-height: 1.6;
}
.amb-program-hero {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 56px;
  line-height: 1.0;
  margin-bottom: 36px;
  font-weight: 400;
  letter-spacing: -1.6px;
  color: #FFF;
}
.amb-program-sub {
  font-size: 14px;
  line-height: 1.65;
  color: #888;
  font-weight: 400;
}

.amb-program-section-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 26px;
  line-height: 1.18;
  margin-bottom: 22px;
  font-weight: 500;
  color: #FFF;
  letter-spacing: -0.4px;
}

.amb-program-bullet-list {
  text-align: left;
  padding: 0 8px;
}
.amb-program-bullet-item {
  font-size: 14px;
  color: #CCC;
  line-height: 1.7;
  margin-bottom: 4px;
  font-weight: 400;
}
.amb-program-bullet-item:last-child {
  margin-bottom: 0;
}

.amb-program-section-divider {
  width: 32px;
  height: 0.5px;
  background: #444;
  margin: 0 auto 80px;
}

.amb-program-cta-wrap { padding: 24px 28px 80px; }
.amb-program-cta {
  display: block;
  background: #FFF;
  color: #000;
  padding: 22px;
  text-align: center;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.5px;
  text-decoration: none;
  font-family: inherit;
}
.amb-program-cta:hover { background: #F0F0F0; }

.amb-program-footer {
  text-align: center;
  padding: 24px 28px 0;
}
.amb-program-footer-contact {
  font-size: 12px;
  color: #FFF;
  line-height: 1.8;
  margin-bottom: 20px;
}
.amb-program-footer-contact a {
  color: #FFF;
  text-decoration: none;
  font-weight: 600;
}

.amb-program-social-icons {
  display: flex;
  justify-content: center;
  gap: 14px;
  padding-bottom: 60px;
}
.amb-program-social-icons a {
  color: #666;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 220ms ease;
  text-decoration: none;
}
.amb-program-social-icons a:hover { color: #ffffff; }
.amb-program-social-icons svg { width: 22px; height: 22px; }

.amb-program-story-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #000;
  z-index: 100;
  transform: translateY(100%);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
}
.amb-program-story-overlay.amb-program-active { transform: translateY(0); }
.amb-program-story-inner { max-width: 440px; margin: 0 auto; }
.amb-program-story-content {
  padding: 0 28px 80px;
  text-align: center;
}
.amb-program-story-beat {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 21px;
  line-height: 1.4;
  color: #FFF;
  margin-bottom: 24px;
  font-weight: 400;
  letter-spacing: -0.2px;
}
.amb-program-story-beat-emphasis { font-weight: 700; }
.amb-program-story-quote {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 21px;
  line-height: 1.4;
  color: #FFF;
  margin-bottom: 18px;
  font-weight: 400;
  letter-spacing: -0.2px;
}
.amb-program-story-final {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 25px;
  line-height: 1.32;
  color: #FFF;
  margin-top: 16px;
  margin-bottom: 16px;
  font-weight: 500;
  letter-spacing: -0.4px;
}
.amb-program-story-divider {
  width: 32px;
  height: 0.5px;
  background: #444;
  margin: 0 auto 56px;
}
`

export default function AmbassadorProgramPage() {
  const [storyOpen, setStoryOpen] = useState(false)

  const openStory = useCallback(() => setStoryOpen(true), [])
  const closeStory = useCallback(() => setStoryOpen(false), [])

  useEffect(() => {
    document.documentElement.classList.add('amb-program-html')
    document.body.classList.add('amb-program-body')
    return () => {
      document.documentElement.classList.remove('amb-program-html')
      document.body.classList.remove('amb-program-body')
      document.body.classList.remove('amb-program-overlay-open')
    }
  }, [])

  useEffect(() => {
    if (storyOpen) {
      document.body.classList.add('amb-program-overlay-open')
    } else {
      document.body.classList.remove('amb-program-overlay-open')
    }
  }, [storyOpen])

  useEffect(() => {
    if (!storyOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeStory()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [storyOpen, closeStory])

  return (
    <div className="amb-program-root">
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

      <main className="amb-program-page">
        <div className="amb-program-top-space" />
        <nav className="amb-program-nav">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="amb-program-wordmark-logo" src="/logo.png" alt="DECODE" height={26} />
          <button className="amb-program-story-link" type="button" onClick={openStory}>
            The story →
          </button>
        </nav>

        <section className="amb-program-section-intro">
          <div className="amb-program-eyebrow">Ambassador Program</div>
          <h1 className="amb-program-hero">The Summary</h1>
          <p className="amb-program-sub">What you get. What you do.</p>
        </section>

        <section className="amb-program-section">
          <h2 className="amb-program-section-title">How it works</h2>
          <div className="amb-program-bullet-list">
            <div className="amb-program-bullet-item">&middot; We agree on the professional and service.</div>
            <div className="amb-program-bullet-item">&middot; You try the service (free).</div>
            <div className="amb-program-bullet-item">&middot; Create your DECODE page online.</div>
            <div className="amb-program-bullet-item">&middot; Record and upload a before/after video.</div>
            <div className="amb-program-bullet-item">&middot; Add page link to your social bio or Linktree.</div>
            <div className="amb-program-bullet-item">&middot; You get paid for the 90 days.</div>
            <div className="amb-program-bullet-item">&middot; Keep page link in your bio for 90 days.</div>
          </div>
        </section>

        <div className="amb-program-section-divider" />

        <section className="amb-program-section">
          <h2 className="amb-program-section-title">What you get</h2>
          <div className="amb-program-bullet-list">
            <div className="amb-program-bullet-item">&middot; Free service.</div>
            <div className="amb-program-bullet-item">&middot; AED XX for the 90 days.</div>
            <div className="amb-program-bullet-item">&middot; Payment cycle is each Wednesday.</div>
            <div className="amb-program-bullet-item">&middot; Vetted salons, clinics and doctors.</div>
          </div>
        </section>

        <div className="amb-program-section-divider" />

        <section className="amb-program-section">
          <h2 className="amb-program-section-title">What you do</h2>
          <div className="amb-program-bullet-list">
            <div className="amb-program-bullet-item">&middot; Create your DECODE page online.</div>
            <div className="amb-program-bullet-item">&middot; Record and upload one before/after video (15s).</div>
            <div className="amb-program-bullet-item">&middot; Add page link to your social bio or Linktree.</div>
            <div className="amb-program-bullet-item">&middot; No monthly content required.</div>
            <div className="amb-program-bullet-item">&middot; No posts on your socials required.</div>
          </div>
        </section>

        <div className="amb-program-section-divider" />

        <section className="amb-program-section">
          <h2 className="amb-program-section-title">Your content &mdash; Your rules</h2>
          <div className="amb-program-bullet-list">
            <div className="amb-program-bullet-item">&middot; You own your content.</div>
            <div className="amb-program-bullet-item">&middot; DECODE will never use your content.</div>
            <div className="amb-program-bullet-item">&middot; Professional will never use your content.</div>
            <div className="amb-program-bullet-item">&middot; You handle your advertising compliance.</div>
          </div>
        </section>

        <div className="amb-program-section-divider" />

        <section className="amb-program-section">
          <h2 className="amb-program-section-title">Keep going</h2>
          <div className="amb-program-bullet-list">
            <div className="amb-program-bullet-item">&middot; Renew after 90 days &mdash; only if you want.</div>
            <div className="amb-program-bullet-item">&middot; Same pro, new 90 days, new payment.</div>
            <div className="amb-program-bullet-item">&middot; Add other pros. More listings, more income.</div>
            <div className="amb-program-bullet-item">&middot; Earn continuously &mdash; month after month.</div>
            <div className="amb-program-bullet-item">&middot; No agency. No middleman.</div>
          </div>
        </section>

        <div className="amb-program-cta-wrap">
          <a className="amb-program-cta" href="https://app.welovedecode.com/yannijohnson">See an Ambassador page →</a>
        </div>

        <div className="amb-program-footer">
          <div className="amb-program-footer-contact">
            Questions? <a href="https://wa.me/971554275547">WhatsApp us →</a>
          </div>
        </div>

        <div className="amb-program-social-icons">
          <a href="https://www.instagram.com/welovedecode" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4l0 -8" />
              <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0" />
              <path d="M16.5 7.5v.01" />
            </svg>
          </a>
          <a href="https://www.tiktok.com/@welovedecode" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 7.917v4.034a9.948 9.948 0 0 1 -5 -1.951v4.5a6.5 6.5 0 1 1 -8 -6.326v4.326a2.5 2.5 0 1 0 4 2v-11.5h4.083a6.005 6.005 0 0 0 4.917 4.917" />
            </svg>
          </a>
          <a href="https://www.youtube.com/@welovedecode" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 8a4 4 0 0 1 4 -4h12a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-12a4 4 0 0 1 -4 -4v-8" />
              <path d="M10 9l5 3l-5 3l0 -6" />
            </svg>
          </a>
        </div>
      </main>

      <div
        className={`amb-program-story-overlay${storyOpen ? ' amb-program-active' : ''}`}
        aria-hidden={!storyOpen}
        role="dialog"
        aria-label="The story behind DECODE"
      >
        <div className="amb-program-story-inner">
          <div className="amb-program-top-space" />
          <nav className="amb-program-nav">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="amb-program-wordmark-logo" src="/logo.png" alt="DECODE" height={26} />
            <button
              className="amb-program-close-link"
              type="button"
              onClick={closeStory}
              aria-label="Close"
            >
              ×
            </button>
          </nav>
          <div className="amb-program-story-content">
            <p className="amb-program-story-beat">
              The most trusted beauty knowledge has always been shared in private.
            </p>
            <p className="amb-program-story-beat">
              Passed between friends, sisters, mothers and daughters for generations.
            </p>
            <p className="amb-program-story-quote">
              &ldquo;The hairstylist &mdash; she&rsquo;s exceptional.&rdquo;<br />
              &ldquo;The doctor &mdash; golden hands.&rdquo;
            </p>
            <p
              className="amb-program-story-beat amb-program-story-beat-emphasis"
              style={{ marginTop: 16 }}
            >
              Never ads. Always people. Always trust.
            </p>
            <p className="amb-program-story-beat">
              Whispers.<br />
              Soft, but powerful &mdash; shaping choices from personal rituals to global runways.
            </p>
            <div className="amb-program-story-divider" />
            <p className="amb-program-story-final">
              DECODE Ambassador reveals what was never meant to be public.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
