'use client'

import { useEffect, useRef, useState } from 'react'

interface PaymentHeartAnimationProps {
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
  color: string
}

export default function PaymentHeartAnimation({ isActive, targetElementId }: PaymentHeartAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const heartsRef = useRef<Heart[]>([])
  const animationFrameRef = useRef<number>()
  const checkIntervalRef = useRef<NodeJS.Timeout>()
  const heartIdCounter = useRef(0)

  useEffect(() => {
    console.log('💖 PaymentHeartAnimation: isActive prop changed to:', isActive)
    console.log('💖 PaymentHeartAnimation: Component is', isActive ? 'ACTIVE' : 'INACTIVE')

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
    }

    if (isActive) {
      console.log('💖 PaymentHeartAnimation: ✅ STARTING ANIMATION!')
      startAnimation()
    } else {
      console.log('💖 PaymentHeartAnimation: ❌ STOPPING ANIMATION')
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

  const generateHeart = (x: number, y: number, xBound: number, xStart: number, scale: number, color: string): Heart => {
    // Create proper heart emoji element
    const heartElement = document.createElement('div')
    heartElement.className = 'heart-floating-payment'

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
      animation: heartfade 8.58s linear;
      font-size: 24px;
      line-height: 1;
    `

    // Red or purple heart
    heartElement.textContent = color

    // Append directly to document.body for true fixed positioning
    console.log('💖 PaymentHeartAnimation: Creating heart at position:', { x, y, scale, color })
    console.log('💖 PaymentHeartAnimation: Appending heart to document.body')
    document.body.appendChild(heartElement)

    const heart: Heart = {
      id: heartIdCounter.current++,
      x,
      y,
      bound: xBound,
      direction: xStart,
      scale,
      time: 8580, // 8.58 second duration (43% longer for 30% speed reduction)
      element: heartElement,
      color
    }

    return heart
  }

  const updateHearts = () => {
    const deltaTime = 16 // ~60fps
    const speed = 0.98 // Reduced speed by 30%

    heartsRef.current = heartsRef.current.filter(heart => {
      heart.time -= deltaTime

      if (heart.time > 0) {
        heart.y -= speed // Slower upward movement
        heart.element.style.top = `${heart.y}px`
        heart.element.style.left = `${heart.x + heart.direction * heart.bound * Math.sin(heart.y * heart.scale / 30) / heart.y * 200}px`

        // Update opacity based on time remaining
        const opacity = heart.time / 8580
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
      const targetElement = document.getElementById(targetElementId)
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect()
        targetX = rect.left + rect.width / 2
        targetY = rect.top + rect.height / 2 // Start at the text level
        targetWidth = rect.width
        targetHeight = rect.height
        console.log('💖 PaymentHeartAnimation: Using target element position (at text level):', { targetX, targetY, targetWidth, targetHeight })
      } else {
        console.log('💖 PaymentHeartAnimation: Target element not found, using screen center:', targetElementId)
        // No offset needed for screen center
      }
    }

    const start = 1 - Math.round(Math.random()) * 2
    const scale = Math.random() * Math.random() * 0.8 + 0.4
    const bound = 30 + Math.random() * 20

    // Responsive vertical offset: 3cm mobile (113px), 10cm desktop (378px)
    const isMobile = window.innerWidth <= 768
    const verticalOffset = isMobile ? 113 : 378

    // Alternate between red and purple hearts
    const heartColors = ['❤️', '💜']
    const color = heartColors[heartIdCounter.current % 2]

    const heart = generateHeart(
      targetX + (Math.random() - 0.5) * targetWidth, // Random x around target
      (targetY + verticalOffset) + (Math.random() - 0.5) * targetHeight, // Random y around target, responsive offset
      bound,
      start,
      scale,
      color
    )

    heartsRef.current.push(heart)
  }

  const startAnimation = () => {
    // Generate hearts periodically for 2 seconds
    let heartCount = 0
    const maxHearts = 56 // Doubled from 28

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