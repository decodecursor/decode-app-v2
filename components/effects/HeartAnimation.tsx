'use client'

import { useEffect, useRef, useState } from 'react'

interface HeartAnimationProps {
  isActive: boolean
  containerId?: string
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

export default function HeartAnimation({ isActive, containerId }: HeartAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const heartsRef = useRef<Heart[]>([])
  const animationFrameRef = useRef<number>()
  const checkIntervalRef = useRef<NodeJS.Timeout>()
  const heartIdCounter = useRef(0)

  useEffect(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
    }

    if (isActive) {
      startAnimation()
    } else {
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
    const heartElement = document.createElement('div')
    heartElement.className = 'heart-floating'
    heartElement.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      transform: scale(${scale}, ${scale});
      z-index: 999;
      animation: heartfade 6s linear;
      pointer-events: none;
    `

    // Add heart shape using CSS pseudo-elements
    heartElement.innerHTML = `
      <style>
        .heart-floating::before,
        .heart-floating::after {
          content: "";
          background-color: #fc2a62;
          position: absolute;
          height: 30px;
          width: 45px;
          border-radius: 15px 0px 0px 15px;
        }
        .heart-floating::before {
          transform: rotate(45deg);
        }
        .heart-floating::after {
          left: 10.5px;
          transform: rotate(135deg);
        }
        @keyframes heartfade {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
      </style>
    `

    if (containerRef.current) {
      containerRef.current.appendChild(heartElement)
    }

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
    const speed = 0.5

    heartsRef.current = heartsRef.current.filter(heart => {
      heart.time -= deltaTime

      if (heart.time > 0) {
        heart.y -= speed
        heart.element.style.top = `${heart.y}px`
        heart.element.style.left = `${heart.x + heart.direction * heart.bound * Math.sin(heart.y * heart.scale / 30) / heart.y * 200}px`
        return true
      } else {
        // Remove expired heart
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
    if (!containerRef.current || !isActive) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    
    // Generate hearts in the center area of the container
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    
    const start = 1 - Math.round(Math.random()) * 2
    const scale = Math.random() * Math.random() * 0.8 + 0.2
    const bound = 30 + Math.random() * 20
    
    const heart = generateHeart(
      centerX + (Math.random() - 0.5) * 300, // Random x around center
      (rect.height / 2) + Math.random() * 150, // Start from vertical middle
      bound,
      start,
      scale
    )
    
    heartsRef.current.push(heart)
  }

  const startAnimation = () => {
    // Generate hearts periodically for 2 seconds
    let heartCount = 0
    const maxHearts = 20
    
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
    // Clear existing hearts
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
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{ zIndex: 999 }}
    />
  )
}