'use client'

import { useCallback, useEffect, useState } from 'react'

const STYLES = `
.pro-landing-root, .pro-landing-root * { box-sizing: border-box; margin: 0; padding: 0; }
html.pro-landing-html, body.pro-landing-body { background: #000; }
body.pro-landing-body {
  font-family: 'Inter', -apple-system, system-ui, sans-serif;
  min-height: 100vh;
  color: #FFF;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body.pro-landing-overlay-open { overflow: hidden; height: 100vh; }

.pro-landing-page {
  max-width: 440px;
  margin: 0 auto;
  padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom);
}
.pro-landing-top-space { height: 32px; }

.pro-landing-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 28px 110px;
}
.pro-landing-wordmark {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 26px;
  letter-spacing: 1.6px;
  font-weight: 500;
  color: #FFF;
}
.pro-landing-wordmark-logo {
  height: 26px;
  width: auto;
  display: block;
  filter: brightness(0) invert(1);
}
.pro-landing-story-link {
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
.pro-landing-close-link {
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

.pro-landing-section { padding: 0 24px 96px; text-align: center; }

.pro-landing-eyebrow {
  font-size: 11px;
  letter-spacing: 3.6px;
  text-transform: uppercase;
  color: #888;
  margin-bottom: 34px;
  font-weight: 500;
  line-height: 2.0;
}
.pro-landing-hero {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 56px;
  line-height: 1.0;
  margin-bottom: 44px;
  font-weight: 400;
  letter-spacing: -1.8px;
  color: #FFF;
}
.pro-landing-sub {
  font-size: 14px;
  line-height: 1.6;
  color: #888;
  font-weight: 400;
}

.pro-landing-media {
  width: 100%;
  aspect-ratio: 9/16;
  background: #1a1a1a;
  border-radius: 14px;
  margin-bottom: 40px;
  position: relative;
  overflow: hidden;
}
.pro-landing-media video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.pro-landing-media-pending {
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
.pro-landing-media-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  position: absolute;
  inset: 0;
}

.pro-landing-block-title {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 26px;
  line-height: 1.18;
  margin-bottom: 18px;
  font-weight: 500;
  color: #FFF;
  letter-spacing: -0.5px;
}
.pro-landing-block-body {
  font-size: 14px;
  line-height: 1.65;
  color: #888;
}

.pro-landing-trust-stack {
  padding: 24px 28px 80px;
  text-align: center;
}
.pro-landing-trust-stack-divider {
  width: 32px;
  height: 0.5px;
  background: #444;
  margin: 0 auto;
}
.pro-landing-trust-stack-eyebrow {
  font-size: 12px;
  letter-spacing: 3.6px;
  text-transform: uppercase;
  color: #888;
  margin: 36px 0 32px;
  font-weight: 500;
}
.pro-landing-trust-stack-pillars {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 30px;
  line-height: 1.5;
  color: #FFF;
  margin-bottom: 28px;
  font-weight: 500;
  letter-spacing: -0.2px;
}
.pro-landing-trust-stack-closer {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 17px;
  line-height: 1.5;
  color: #888;
  margin-bottom: 36px;
  font-weight: 500;
}
.pro-landing-trust-stack-closer-strong { font-weight: 700; }

.pro-landing-example-link-wrap {
  text-align: center;
  padding: 0 28px 64px;
}
.pro-landing-example-link {
  font-size: 12px;
  color: #FFF;
  letter-spacing: 0.6px;
  text-decoration: none;
  font-family: inherit;
  padding: 12px 16px;
  display: inline-block;
}
.pro-landing-cta-wrap { padding: 24px 28px 80px; }
.pro-landing-cta {
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
.pro-landing-cta:hover { background: #F0F0F0; }

.pro-landing-footer {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 19px;
  line-height: 1.5;
  color: #888;
  text-align: center;
  padding: 0 28px 10px;
  font-weight: 400;
}
.pro-landing-footer-strong { font-weight: 600; }

.pro-social-icons {
  display: flex;
  justify-content: center;
  gap: 14px;
  margin-top: 2.5rem;
  padding-bottom: 60px;
}
.pro-social-icons a {
  color: #666;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: color 220ms ease;
  text-decoration: none;
}
.pro-social-icons a:hover { color: #ffffff; }
.pro-social-icons svg { width: 22px; height: 22px; }

.pro-landing-story-overlay {
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
.pro-landing-story-overlay.pro-landing-active { transform: translateY(0); }
.pro-landing-story-inner { max-width: 440px; margin: 0 auto; }
.pro-landing-story-content {
  padding: 0 28px 80px;
  text-align: center;
}
.pro-landing-story-beat {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 21px;
  line-height: 1.4;
  color: #FFF;
  margin-bottom: 24px;
  font-weight: 400;
  letter-spacing: -0.2px;
}
.pro-landing-story-beat-emphasis { font-weight: 700; }
.pro-landing-story-quote {
  font-family: 'Cormorant Garamond', Georgia, serif;
  font-style: italic;
  font-size: 21px;
  line-height: 1.4;
  color: #FFF;
  margin-bottom: 18px;
  font-weight: 400;
  letter-spacing: -0.2px;
}
.pro-landing-story-final {
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
.pro-landing-story-divider {
  width: 32px;
  height: 0.5px;
  background: #444;
  margin: 0 auto 56px;
}

@keyframes pro-cta-arrow-nudge {
  0%   { transform: translateX(0);   animation-timing-function: ease-out; }
  7.5% { transform: translateX(6px); animation-timing-function: ease-in; }
  15%  { transform: translateX(0); }
  100% { transform: translateX(0); }
}
.pro-cta-arrow-nudge {
  display: inline-block;
  transform-origin: center;
  animation: pro-cta-arrow-nudge 4s linear infinite;
  animation-delay: 1.5s;
}
a:hover .pro-cta-arrow-nudge { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .pro-cta-arrow-nudge { animation: none; }
}

.decode-video { position:relative; width:100%; max-width:560px; margin:clamp(28px,6vw,56px) auto; aspect-ratio:16/9; border-radius:20px; overflow:hidden; background:#0a0a0a; cursor:pointer; }
.decode-video__poster { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; display:block; }
.decode-video::after { content:""; position:absolute; inset:0; background:rgba(0,0,0,.18); pointer-events:none; transition:opacity .25s; }
.decode-video.is-playing::after { opacity:0; }
.decode-video__play { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:84px; height:84px; border:none; border-radius:50%; background:rgba(0,0,0,.45); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); display:grid; place-items:center; cursor:pointer; z-index:2; transition:background .2s, transform .2s, opacity .25s; }
.decode-video__play:hover { background:rgba(0,0,0,.62); transform:translate(-50%,-50%) scale(1.06); }
.decode-video__play svg { width:30px; height:30px; margin-left:4px; }
.decode-video.is-playing .decode-video__play, .decode-video.is-playing .decode-video__poster { opacity:0; pointer-events:none; }
.decode-video iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
`

function DecodeVideo() {
  return (
    <figure className="decode-video">
      <video
        controls
        preload="metadata"
        poster="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/Ambassador%20website%20video%2048mb.png"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      >
        <source
          src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/Ambassador%20website%20video%2048mb.mp4"
          type="video/mp4"
        />
      </video>
    </figure>
  )
}

export default function ProfessionalLandingPage() {
  const [storyOpen, setStoryOpen] = useState(false)

  const openStory = useCallback(() => setStoryOpen(true), [])
  const closeStory = useCallback(() => setStoryOpen(false), [])

  useEffect(() => {
    document.documentElement.classList.add('pro-landing-html')
    document.body.classList.add('pro-landing-body')
    return () => {
      document.documentElement.classList.remove('pro-landing-html')
      document.body.classList.remove('pro-landing-body')
      document.body.classList.remove('pro-landing-overlay-open')
    }
  }, [])

  useEffect(() => {
    if (storyOpen) {
      document.body.classList.add('pro-landing-overlay-open')
    } else {
      document.body.classList.remove('pro-landing-overlay-open')
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
    const videos = document.querySelectorAll<HTMLVideoElement>('.pro-landing-media video')
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
    <div className="pro-landing-root">
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

      <main className="pro-landing-page">
        <div className="pro-landing-top-space" />
        <nav className="pro-landing-nav">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="pro-landing-wordmark-logo" src="/logo.png" alt="DECODE" height={26} />
          <button className="pro-landing-story-link" type="button" onClick={openStory}>
            The story →
          </button>
        </nav>

        <section className="pro-landing-section">
          <div className="pro-landing-eyebrow">Ambassador<br />For Beauty Professionals</div>
          <h1 className="pro-landing-hero">
            Get recommended<br />by women who<br />love your work.
          </h1>
          <DecodeVideo />
          <p className="pro-landing-sub">
            Turn your clients into Ambassadors.<br />
            Renew partnerships in 3 clicks.<br />
            Ambassadors replace ads.
          </p>
        </section>

        <section className="pro-landing-section">
          <div className="pro-landing-media">
            <video playsInline preload="none" controls poster="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/video_4_Return_to_your_craft_RAW_720_FINAL.png">
              <source src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/video_4_Return_to_your_craft_RAW_720_FINAL.mp4" type="video/mp4" />
            </video>
          </div>
          <h2 className="pro-landing-block-title">
            You didn&rsquo;t train 15 years to film TikToks. Return to your craft.
          </h2>
          <p className="pro-landing-block-body">
            A few Ambassadors can outperform an entire marketing team. Stay lean, stay efficient &mdash; manage it all in a few clicks.
          </p>
        </section>

        <section className="pro-landing-section">
          <div className="pro-landing-media">
            <video playsInline preload="none" controls poster="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/video_5_Every_ninety_days_RAW_720_FINAL.png">
              <source src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/video_5_Every_ninety_days_RAW_720_FINAL.mp4" type="video/mp4" />
            </video>
          </div>
          <h2 className="pro-landing-block-title">1 day vs 90 days.</h2>
          <p className="pro-landing-block-body">
            An influencer story is gone tomorrow. An Ambassador listing stays live for up to 90 days. Same audience. Different math. Renewable in two clicks.
          </p>
        </section>

        <section className="pro-landing-section">
          <div className="pro-landing-media">
            <video playsInline preload="none" controls poster="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/video_3_Golden_hands_no_budget_RAW_480_FINAL.png">
              <source src="https://vdgjzaaxvstbouklgsft.supabase.co/storage/v1/object/public/marketing/ambassador/videos/video_3_Golden_hands_no_budget_RAW_480_FINAL.mp4" type="video/mp4" />
            </video>
          </div>
          <h2 className="pro-landing-block-title">
            She is a real client.<br />She vouches with her name.
          </h2>
          <p className="pro-landing-block-body">
            End the budget battle on social media and let trust work for you. Let&rsquo;s take word-of-mouth to another level.
          </p>
        </section>

        <section className="pro-landing-trust-stack">
          <div className="pro-landing-trust-stack-divider" />
          <div className="pro-landing-trust-stack-eyebrow">The Trust Stack</div>
          <div className="pro-landing-trust-stack-pillars">
            Personal endorsement.<br />Crowd reviews.<br />Live demand.
          </div>
          <div className="pro-landing-trust-stack-closer">
            Together, they drive human decisions.<br /><span className="pro-landing-trust-stack-closer-strong">Not on Meta. Not on Google. Not on TikTok.</span><br />Only here.
          </div>
          <div className="pro-landing-trust-stack-divider" />
        </section>

        <div className="pro-landing-example-link-wrap">
          <a className="pro-landing-example-link" href="https://app.welovedecode.com/yannijohnson">See her page <span className="pro-cta-arrow-nudge">→</span></a>
        </div>

        <div className="pro-landing-cta-wrap">
          <a className="pro-landing-cta" href="https://wa.me/971554275547">Let&rsquo;s Chat on WhatsApp</a>
        </div>

        <div className="pro-landing-footer">
          META interrupts. <span className="pro-landing-footer-strong">DECODE meets.</span><br />Craft beats marketing. Finally.
        </div>

        <div className="pro-social-icons">
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
        className={`pro-landing-story-overlay${storyOpen ? ' pro-landing-active' : ''}`}
        aria-hidden={!storyOpen}
        role="dialog"
        aria-label="The story behind DECODE"
      >
        <div className="pro-landing-story-inner">
          <div className="pro-landing-top-space" />
          <nav className="pro-landing-nav">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="pro-landing-wordmark-logo" src="/logo.png" alt="DECODE" height={26} />
            <button
              className="pro-landing-close-link"
              type="button"
              onClick={closeStory}
              aria-label="Close"
            >
              ×
            </button>
          </nav>
          <div className="pro-landing-story-content">
            <p className="pro-landing-story-beat">
              The most trusted beauty knowledge has always been shared in private.
            </p>
            <p className="pro-landing-story-beat">
              Passed between friends, sisters, mothers and daughters for generations.
            </p>
            <p className="pro-landing-story-quote">
              &ldquo;The hairstylist &mdash; she&rsquo;s exceptional.&rdquo;<br />
              &ldquo;The doctor &mdash; golden hands.&rdquo;
            </p>
            <p
              className="pro-landing-story-beat pro-landing-story-beat-emphasis"
              style={{ marginTop: 16 }}
            >
              Never ads. Always people. Always trust.
            </p>
            <p className="pro-landing-story-beat">
              Whispers.<br />
              Soft, but powerful &mdash; shaping choices from personal rituals to global runways.
            </p>
            <div className="pro-landing-story-divider" />
            <p className="pro-landing-story-final">
              DECODE Ambassador reveals what was never meant to be public.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
