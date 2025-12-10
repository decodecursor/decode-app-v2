'use client'

import { useState } from 'react'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  className?: string
  showValidation?: boolean
}

export default function PasswordInput({ 
  value, 
  onChange, 
  placeholder = "Password",
  required = false,
  disabled = false,
  className = "cosmic-input",
  showValidation = false
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isValid = value.length >= 6 || value.length === 0

  return (
    <div className="relative">
      <input
        type={showPassword ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          console.log('Password input changed, showPassword:', showPassword, 'type:', showPassword ? "text" : "password")
          onChange(e.target.value)
        }}
        className={`${className} pr-12 ${showValidation && !isValid && value.length > 0 ? 'border-red-500' : ''}`}
        required={required}
        disabled={disabled}
        minLength={6}
      />
      {showValidation && !isValid && value.length > 0 && (
        <div className="absolute -bottom-5 left-0 text-xs text-red-400">
          Password must be at least 6 characters
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          console.log('Password toggle clicked, current state:', showPassword)
          setShowPassword(!showPassword)
        }}
        onTouchStart={() => {
          console.log('Password toggle touched')
        }}
        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors z-10"
        disabled={disabled}
        tabIndex={-1}
      >
        {showPassword ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        )}
      </button>
    </div>
  )
}