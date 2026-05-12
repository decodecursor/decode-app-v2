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
  line-height: 1.6;
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
  top: 14px;
  right: 14px;
  background: #FFF;
  color: #000;
  padding: 7px 11px;
  border-radius: 4px;
  font-size: 9px;
  letter-spacing: 2.4px;
  text-transform: uppercase;
  font-weight: 600;
  z-index: 2;
}
.amb-landing-media-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  position: absolute;
  inset: 0;
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

.amb-landing-trust-stack {
  padding: 24px 28px 80px;
  text-align: center;
}
.amb-landing-trust-stack-divider {
  width: 32px;
  height: 0.5px;
  background: #444;
  margin: 0 auto;
}
.amb-landing-trust-stack-eyebrow {
  font-size: 12px;
  letter-spacing: 3.6px;
  text-transform: uppercase;
  color: #888;
  margin: 36px 0 32px;
  font-weight: 500;
}
.amb-landing-trust-stack-pillars {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 30px;
  line-height: 1.5;
  color: #FFF;
  margin-bottom: 28px;
  font-weight: 500;
  letter-spacing: -0.2px;
}
.amb-landing-trust-stack-closer {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 17px;
  line-height: 1.5;
  color: #888;
  margin-bottom: 36px;
  font-weight: 500;
}
.amb-landing-trust-stack-closer-strong { font-weight: 700; }

.amb-landing-example-link-wrap {
  text-align: center;
  padding: 0 28px 64px;
}
.amb-landing-example-link {
  font-size: 12px;
  color: #FFF;
  letter-spacing: 0.6px;
  text-decoration: none;
  font-family: inherit;
  padding: 12px 16px;
  display: inline-block;
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
.amb-landing-footer-strong { font-weight: 600; }

.amb-social-icons {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 2.5rem;
  padding-bottom: 60px;
}
.amb-social-icons a {
  color: #666;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 220ms ease;
  text-decoration: none;
}
.amb-social-icons a:hover { color: #ffffff; }
.amb-social-icons svg { width: 22px; height: 22px; }

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

@keyframes amb-cta-arrow-nudge {
  0%   { transform: translateX(0);   animation-timing-function: ease-out; }
  7.5% { transform: translateX(6px); animation-timing-function: ease-in; }
  15%  { transform: translateX(0); }
  100% { transform: translateX(0); }
}
.amb-cta-arrow-nudge {
  display: inline-block;
  transform-origin: center;
  animation: amb-cta-arrow-nudge 4s linear infinite;
  animation-delay: 1.5s;
}
a:hover .amb-cta-arrow-nudge { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .amb-cta-arrow-nudge { animation: none; }
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

  // Auto-hide native video controls. 500ms after play (quick hide once
  // started). 3000ms after a user interaction (tap / drag the seek bar)
  // so they have real time to use the controls. touchmove keeps controls
  // visible while dragging. Pause always restores them.
  useEffect(() => {
    const videos = document.querySelectorAll<HTMLVideoElement>('.amb-landing-media video')
    const cleanups: Array<() => void> = []
    videos.forEach((video) => {
      let hideTimer: ReturnType<typeof setTimeout> | null = null
      const INITIAL_HIDE_DELAY = 500
      const INTERACTION_HIDE_DELAY = 3000
      const scheduleHide = (delay: number) => {
        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = setTimeout(() => {
          if (!video.paused) video.removeAttribute('controls')
        }, delay)
      }
      const onPlay = () => scheduleHide(INITIAL_HIDE_DELAY)
      const showAndDelay = () => {
        video.setAttribute('controls', '')
        if (!video.paused) scheduleHide(INTERACTION_HIDE_DELAY)
      }
      const onPause = () => {
        if (hideTimer) clearTimeout(hideTimer)
        video.setAttribute('controls', '')
      }
      video.addEventListener('play', onPlay)
      video.addEventListener('pause', onPause)
      video.addEventListener('click', showAndDelay)
      video.addEventListener('touchstart', showAndDelay, { passive: true })
      video.addEventListener('touchmove', showAndDelay, { passive: true })
      cleanups.push(() => {
        if (hideTimer) clearTimeout(hideTimer)
        video.removeEventListener('play', onPlay)
        video.removeEventListener('pause', onPause)
        video.removeEventListener('click', showAndDelay)
        video.removeEventListener('touchstart', showAndDelay)
        video.removeEventListener('touchmove', showAndDelay)
      })
    })
    return () => cleanups.forEach((c) => c())
  }, [])

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
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500;1,600;1,700&family=Inter:wght@400;500;600&display=swap"
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
            Find her<br />beauty pros.<br />Endorse yours.
          </h1>
          <p className="amb-landing-sub">
            Endorse the beauty professionals you trust.<br />
            Public recommendations. Now paid.<br />
            We finally pay women to be real.
          </p>
        </section>

        <section className="amb-landing-section">
          <div className="amb-landing-media">
            <video playsInline preload="none" controls poster="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/video_6_Real_by_design_RAW_720_FINAL.png">
              <source src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/video_6_Real_by_design_RAW_720_FINAL.mp4" type="video/mp4" />
            </video>
          </div>
          <h2 className="amb-landing-block-title">An endorsement. Not a tag.</h2>
          <p className="amb-landing-block-body">
            She is a real client. She vouches with her name. Endorse your beauty professionals. Get paid upfront. Renew in two clicks.
          </p>
        </section>

        <section className="amb-landing-section">
          <div className="amb-landing-media">
            <video playsInline preload="none" controls poster="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/whisper.png">
              <source src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/video_1_big_billions_vs_zero_RAW_720_FINAL_new.mp4" type="video/mp4" />
            </video>
          </div>
          <h2 className="amb-landing-block-title">The whisper, finally a page.</h2>
          <p className="amb-landing-block-body">
            The hairdresser. The doctor. The aesthetician.<br />
            The DMs you&rsquo;ve answered a hundred times.<br />
            Now public. Now paid.
          </p>
        </section>

        <section className="amb-landing-section">
          <div className="amb-landing-media">
            <video playsInline preload="none" controls poster="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/video_2_Best%20Hairdresser%20in%20Town%20for%20the%204th%20time_RAW_480_FINAL.png">
              <source src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/endorsement.mp4" type="video/mp4" />
            </video>
          </div>
          <h2 className="amb-landing-block-title">On social, the biggest budget and the loudest usually win.</h2>
          <p className="amb-landing-block-body">
            Small craftspeople with golden hands lose. The algorithm doesn&rsquo;t see craft. DECODE pays the women who do.
          </p>
        </section>

        <section className="amb-landing-trust-stack">
          <div className="amb-landing-trust-stack-divider" />
          <div className="amb-landing-trust-stack-eyebrow">The Trust Stack</div>
          <div className="amb-landing-trust-stack-pillars">
            Personal endorsement.<br />Crowd reviews.<br />Live demand.
          </div>
          <div className="amb-landing-trust-stack-closer">
            Together, they drive human decisions.<br /><span className="amb-landing-trust-stack-closer-strong">Not on Meta. Not on Google. Not on TikTok.</span><br />Only here.
          </div>
          <div className="amb-landing-trust-stack-divider" />
        </section>

        <div className="amb-landing-example-link-wrap">
          <a className="amb-landing-example-link" href="https://app.welovedecode.com/yannijohnson">See her page <span className="amb-cta-arrow-nudge">→</span></a>
        </div>

        <div className="amb-landing-cta-wrap">
          <Link className="amb-landing-cta" href="/model/auth">Become an Ambassador</Link>
        </div>

        <div className="amb-landing-footer">
          META interrupts. <span className="amb-landing-footer-strong">DECODE meets.</span><br />A page she chose to visit.
        </div>

        <div className="amb-social-icons">
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
              Whispers.<br />
              Soft, but powerful &mdash; shaping choices from personal rituals to global runways.
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
