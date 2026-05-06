'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

const STYLES = `
.amb-landing-root, .amb-landing-root * { box-sizing: border-box; margin: 0; padding: 0; }
html.amb-landing-html, body.amb-landing-body { background: #000; }
body.amb-landing-body {
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  min-height: 100vh;
  color: #FFF;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body.amb-landing-overlay-open { overflow: hidden; height: 100vh; }

.amb-landing-page {
  max-width: 440px;
  margin: 0 auto;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
}
.amb-landing-top-space { height: 32px; }

.amb-landing-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 28px 110px;
}
.amb-landing-wordmark {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 26px;
  letter-spacing: 1.6px;
  font-weight: 500;
  color: #FFF;
}
.amb-landing-wordmark-logo {
  height: 26px;
  width: auto;
  display: block;
  filter: brightness(0) invert(1);
}
.amb-landing-story-link {
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
.amb-landing-close-link {
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

.amb-landing-section { padding: 0 24px 96px; text-align: center; }

.amb-landing-eyebrow {
  font-size: 11px;
  letter-spacing: 3.6px;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 34px;
  font-weight: 500;
}
.amb-landing-hero {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 62px;
  line-height: 1.0;
  margin-bottom: 44px;
  font-weight: 400;
  letter-spacing: -1.8px;
  color: #FFF;
}
.amb-landing-sub {
  font-size: 14px;
  line-height: 1.5;
  color: #888;
  font-weight: 400;
}

.amb-landing-media {
  width: 100%;
  aspect-ratio: 9/16;
  background: #1a1a1a;
  border-radius: 14px;
  margin-bottom: 40px;
  position: relative;
  overflow: hidden;
}
.amb-landing-media video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.amb-landing-media-pending {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 14px;
}
.amb-landing-media-pending .amb-landing-pending-dot {
  width: 6px;
  height: 6px;
  background: #555;
  border-radius: 50%;
}
.amb-landing-media-pending .amb-landing-pending-label {
  font-size: 11px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #666;
  font-weight: 500;
}

.amb-landing-block-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 26px;
  line-height: 1.18;
  margin-bottom: 18px;
  font-weight: 500;
  color: #FFF;
  letter-spacing: -0.5px;
}
.amb-landing-block-body {
  font-size: 14px;
  line-height: 1.65;
  color: #888;
}

.amb-landing-cta-wrap { padding: 24px 28px 80px; }
.amb-landing-cta {
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
.amb-landing-cta:hover { background: #F0F0F0; }

.amb-landing-footer {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 19px;
  line-height: 1.5;
  color: #888;
  text-align: center;
  padding: 0 28px 60px;
  font-weight: 400;
}
.amb-landing-footer-strong { font-weight: 500; }

.amb-landing-story-overlay {
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
.amb-landing-story-overlay.amb-landing-active { transform: translateY(0); }
.amb-landing-story-inner { max-width: 440px; margin: 0 auto; }
.amb-landing-story-content {
  padding: 0 28px 80px;
  text-align: center;
}
.amb-landing-story-beat {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 21px;
  line-height: 1.4;
  color: #FFF;
  margin-bottom: 24px;
  font-weight: 400;
  letter-spacing: -0.2px;
}
.amb-landing-story-beat-emphasis { font-weight: 700; }
.amb-landing-story-quote {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 21px;
  line-height: 1.4;
  color: #FFF;
  margin-bottom: 18px;
  font-weight: 400;
  letter-spacing: -0.2px;
}
.amb-landing-story-final {
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
.amb-landing-story-divider {
  width: 32px;
  height: 0.5px;
  background: #444;
  margin: 0 auto 56px;
}
`

export default function AmbassadorLandingPage() {
  const [storyOpen, setStoryOpen] = useState(false)

  const openStory = useCallback(() => setStoryOpen(true), [])
  const closeStory = useCallback(() => setStoryOpen(false), [])

  // Body-level black background + scroll lock when overlay is open. Page-only
  // class flip avoids polluting global state on other routes.
  useEffect(() => {
    document.documentElement.classList.add('amb-landing-html')
    document.body.classList.add('amb-landing-body')
    return () => {
      document.documentElement.classList.remove('amb-landing-html')
      document.body.classList.remove('amb-landing-body')
      document.body.classList.remove('amb-landing-overlay-open')
    }
  }, [])

  useEffect(() => {
    if (storyOpen) {
      document.body.classList.add('amb-landing-overlay-open')
    } else {
      document.body.classList.remove('amb-landing-overlay-open')
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
    <div className="amb-landing-root">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500;1,700&display=swap"
      />
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <main className="amb-landing-page">
        <div className="amb-landing-top-space" />
        <nav className="amb-landing-nav">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="amb-landing-wordmark-logo" src="/logo.png" alt="DECODE" height={26} />
          <button className="amb-landing-story-link" type="button" onClick={openStory}>
            The story →
          </button>
        </nav>

        <section className="amb-landing-section">
          <div className="amb-landing-eyebrow">Ambassador</div>
          <h1 className="amb-landing-hero">
            Find her<br />beauty squad.<br />Show yours.
          </h1>
          <p className="amb-landing-sub">We finally pay women to be real.</p>
        </section>

        <section className="amb-landing-section">
          <div className="amb-landing-media">
            <video playsInline preload="metadata" controls>
              <source src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/endorsement.mp4#t=0.001" type="video/mp4" />
            </video>
          </div>
          <h2 className="amb-landing-block-title">An endorsement. Not a tag.</h2>
          <p className="amb-landing-block-body">
            She is a real customer. She vouches with her name.<br />
            List your beauty pro once. Get paid upfront.<br />
            Renew in two clicks.
          </p>
        </section>

        <section className="amb-landing-section">
          <div className="amb-landing-media" data-status="pending">
            <div className="amb-landing-media-pending">
              <span className="amb-landing-pending-dot" />
              <span className="amb-landing-pending-label">Under production</span>
            </div>
          </div>
          <h2 className="amb-landing-block-title">
            Today the loudest wins.<br />Let&rsquo;s change that.
          </h2>
          <p className="amb-landing-block-body">
            The biggest budget and the loudest wins on social. Small craftspeople with golden hands lose. We change that &mdash; and pay you to join the movement.
          </p>
        </section>

        <section className="amb-landing-section">
          <div className="amb-landing-media">
            <video playsInline preload="metadata" controls>
              <source src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/whisper.mp4#t=0.001" type="video/mp4" />
            </video>
          </div>
          <h2 className="amb-landing-block-title">The whisper, finally a page.</h2>
          <p className="amb-landing-block-body">
            The hairdresser. The doctor. The aesthetician.<br />
            The DMs you&rsquo;ve answered a hundred times.<br />
            Now public. Now paid.
          </p>
        </section>

        <div className="amb-landing-cta-wrap">
          <Link className="amb-landing-cta" href="/model/auth">Become an Ambassador</Link>
        </div>

        <div className="amb-landing-footer">
          META interrupts. <span className="amb-landing-footer-strong">DECODE meets.</span><br />A page she chose to visit.
        </div>
      </main>

      <div
        className={`amb-landing-story-overlay${storyOpen ? ' amb-landing-active' : ''}`}
        aria-hidden={!storyOpen}
        role="dialog"
        aria-label="The story behind DECODE"
      >
        <div className="amb-landing-story-inner">
          <div className="amb-landing-top-space" />
          <nav className="amb-landing-nav">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="amb-landing-wordmark-logo" src="/logo.png" alt="DECODE" height={26} />
            <button
              className="amb-landing-close-link"
              type="button"
              onClick={closeStory}
              aria-label="Close"
            >
              ×
            </button>
          </nav>
          <div className="amb-landing-story-content">
            <p className="amb-landing-story-beat">
              The most trusted beauty knowledge has always been shared in private.
            </p>
            <p className="amb-landing-story-beat">
              Passed between friends, sisters, mothers and daughters for generations.
            </p>
            <p className="amb-landing-story-quote">
              &ldquo;The hairstylist &mdash; she&rsquo;s exceptional.&rdquo;<br />
              &ldquo;The doctor &mdash; golden hands.&rdquo;
            </p>
            <p
              className="amb-landing-story-beat amb-landing-story-beat-emphasis"
              style={{ marginTop: 16 }}
            >
              Never ads. Always people. Always trust.
            </p>
            <p className="amb-landing-story-beat">
              Whispers. Soft, but powerful &mdash; shaping choices from personal rituals to global runways.
            </p>
            <div className="amb-landing-story-divider" />
            <p className="amb-landing-story-final">
              DECODE Ambassador reveals what was never meant to be public.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
