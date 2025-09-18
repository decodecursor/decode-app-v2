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
    console.log('💖 HeartAnimation: isActive changed to:', isActive)

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current)
    }

    if (isActive) {
      console.log('💖 HeartAnimation: Starting animation!')
      startAnimation()
    } else {
      console.log('💖 HeartAnimation: Stopping animation')
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

    // Create the heart shape using divs instead of pseudo-elements
    const heartBefore = document.createElement('div')
    const heartAfter = document.createElement('div')

    // Style the main container - scale applied here
    heartElement.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      transform: scale(${scale});
      z-index: 99999;
      pointer-events: none;
      width: 45px;
      height: 40px;
      animation: heartfade 4s linear;
    `

    // Style the heart parts with transform-origin
    const heartPartStyle = `
      position: absolute;
      background-color: #fc2a62;
      height: 30px;
      width: 45px;
      border-radius: 15px 0px 0px 15px;
      transform-origin: bottom right;
    `

    heartBefore.style.cssText = heartPartStyle + `transform: rotate(45deg);`
    heartAfter.style.cssText = heartPartStyle + `left: 10.5px; transform: rotate(135deg);`

    // Append heart parts
    heartElement.appendChild(heartBefore)
    heartElement.appendChild(heartAfter)

    // Append directly to document.body for true fixed positioning
    console.log('💖 HeartAnimation: Appending heart to document.body')
    document.body.appendChild(heartElement)
    console.log('💖 HeartAnimation: Heart appended! Body contains heart:', document.body.contains(heartElement))

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
    if (!containerRef.current || !isActive) return

    // Use window dimensions since we're using fixed positioning
    const windowWidth = window.innerWidth
    const windowHeight = window.innerHeight

    // Generate hearts in the center area of the screen
    const centerX = windowWidth / 2
    const centerY = windowHeight / 2

    const start = 1 - Math.round(Math.random()) * 2
    const scale = Math.random() * Math.random() * 0.8 + 0.4
    const bound = 30 + Math.random() * 20

    const heart = generateHeart(
      centerX + (Math.random() - 0.5) * 400, // Random x around center
      centerY + (Math.random() - 0.5) * 200, // Start from center area
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