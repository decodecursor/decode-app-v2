'use client'

import { useEffect, useRef, useState } from 'react'

interface HeartAnimationProps {
  isActive: boolean
  targetElementId?: string
}

interface Heart {
  id: number
  x: number
  y: number
  bound: number
  direction: number
  scale: number
  time: number
  element: HTMLDivElement
}

export default function HeartAnimation({ isActive, targetElementId }: HeartAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const heartsRef = useRef<Heart[]>([])
  const animationFrameRef = useRef<number>()
  const checkIntervalRef = useRef<NodeJS.Timeout>()
  const heartIdCounter = useRef(0)

  // Global debug function - can be called from browser console
  useEffect(() => {
    (window as any).testHearts = () => {
      console.log('🧪 MANUAL TEST: Creating test hearts via window.testHearts()')

      // Create 5 test hearts at different positions
      for (let i = 0; i < 5; i++) {
        const x = 200 + i * 100
        const y = 200 + i * 50
        const heart = generateHeart(x, y, 30, 1, 1)
        heartsRef.current.push(heart)
      }

      // Start animation loop
      updateHearts()

      console.log('🧪 MANUAL TEST: Test hearts created! Check screen and DOM.')
    }

    console.log('💖 HeartAnimation: Global test function available - call window.testHearts()')
  }, [])

  useEffect(() => {
    console.log('💖 HeartAnimation: isActive prop changed to:', isActive)
    console.log('💖 HeartAnimation: Component is', isActive ? 'ACTIVE' : 'INACTIVE')

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
    }

    if (isActive) {
      console.log('💖 HeartAnimation: ✅ STARTING ANIMATION!')
      startAnimation()
    } else {
      console.log('💖 HeartAnimation: ❌ STOPPING ANIMATION')
      stopAnimation()
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [isActive])

  const generateHeart = (x: number, y: number, xBound: number, xStart: number, scale: number): Heart => {
    // Create proper heart emoji element
    const heartElement = document.createElement('div')
    heartElement.className = 'heart-floating'

    // Style as clean heart emoji
    heartElement.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: auto;
      height: auto;
      z-index: 99999;
      pointer-events: none;
      transform: scale(${scale});
      animation: heartfade 4s linear;
      font-size: 24px;
      line-height: 1;
    `

    // Simple heart emoji
    heartElement.textContent = '❤️'

    // Append directly to document.body for true fixed positioning
    console.log('💖 HeartAnimation: Creating heart at position:', { x, y, scale })
    console.log('💖 HeartAnimation: Appending heart to document.body')
    document.body.appendChild(heartElement)
    console.log('💖 HeartAnimation: Heart appended! Body contains heart:', document.body.contains(heartElement))
    console.log('💖 HeartAnimation: Heart element:', heartElement)

    const heart: Heart = {
      id: heartIdCounter.current++,
      x,
      y,
      bound: xBound,
      direction: xStart,
      scale,
      time: 4000, // 4 second duration
      element: heartElement
    }

    return heart
  }

  const updateHearts = () => {
    const deltaTime = 16 // ~60fps
    const speed = 2 // Increased speed for visibility

    heartsRef.current = heartsRef.current.filter(heart => {
      heart.time -= deltaTime

      if (heart.time > 0) {
        heart.y -= speed
        heart.element.style.top = `${heart.y}px`
        heart.element.style.left = `${heart.x + heart.direction * heart.bound * Math.sin(heart.y * heart.scale / 30) / heart.y * 200}px`

        // Update opacity based on time remaining
        const opacity = heart.time / 4000
        heart.element.style.opacity = `${opacity}`

        return true
      } else {
        // Remove expired heart from DOM
        if (heart.element.parentNode) {
          heart.element.parentNode.removeChild(heart.element)
        }
        return false
      }
    })

    if (isActive || heartsRef.current.length > 0) {
      animationFrameRef.current = requestAnimationFrame(updateHearts)
    }
  }

  const generateRandomHeart = () => {
    if (!isActive) return

    let targetX = window.innerWidth / 2
    let targetY = window.innerHeight / 2
    let targetWidth = 400
    let targetHeight = 200

    // If we have a target element ID, use its position
    if (targetElementId) {
      // Try payout element first, then payment link (for backward compatibility)
      let targetElement = document.getElementById(targetElementId)
      if (!targetElement) {
        targetElement = document.getElementById(`payment-link-${targetElementId}`)
      }

      if (targetElement) {
        const rect = targetElement.getBoundingClientRect()
        targetX = rect.left + rect.width / 2
        targetY = rect.top + rect.height / 2
        targetWidth = rect.width
        targetHeight = rect.height
        console.log('💖 HeartAnimation: Using target element position:', { targetX, targetY, targetWidth, targetHeight })
      } else {
        console.log('💖 HeartAnimation: Target element not found, using screen center:', targetElementId)
      }
    }

    const start = 1 - Math.round(Math.random()) * 2
    const scale = Math.random() * Math.random() * 0.8 + 0.4
    const bound = 30 + Math.random() * 20

    const heart = generateHeart(
      targetX + (Math.random() - 0.5) * targetWidth, // Random x around target
      targetY + (Math.random() - 0.5) * targetHeight, // Random y around target
      bound,
      start,
      scale
    )

    heartsRef.current.push(heart)
  }

  const startAnimation = () => {
    // Generate hearts periodically for 2 seconds
    let heartCount = 0
    const maxHearts = 24
    
    checkIntervalRef.current = setInterval(() => {
      if (heartCount < maxHearts) {
        generateRandomHeart()
        heartCount++
      } else {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current)
        }
      }
    }, 100) // Generate a heart every 100ms
    
    // Start the animation loop
    updateHearts()
  }

  const stopAnimation = () => {
    // Clear existing hearts from document.body
    heartsRef.current.forEach(heart => {
      if (heart.element.parentNode) {
        heart.element.parentNode.removeChild(heart.element)
      }
    })
    heartsRef.current = []
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 99999 }}
    />
  )
}