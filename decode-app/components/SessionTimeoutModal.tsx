'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SessionTimeoutModalProps {
  isOpen: boolean;
  onContinue: () => void;
  onLogout: () => void;
  lastActivityTime: string;
}

export default function SessionTimeoutModal({
  isOpen,
  onContinue,
  onLogout,
  lastActivityTime
}: SessionTimeoutModalProps) {
  const [countdown, setCountdown] = useState(10);
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) {
      setCountdown(10);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, onLogout]);

  if (!isOpen) return null;

  // Calculate stroke-dashoffset for circular progress
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (countdown / 10) * circumference;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[9998] backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-white">
            <div className="flex items-center space-x-4">
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-white opacity-20 rounded-full animate-pulse" />
                  <svg className="w-12 h-12 relative" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold">Session Expiring Soon</h3>
                <p className="text-sm opacity-90 mt-1">Your session will expire due to inactivity</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            {/* Countdown Timer Circle */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  {/* Background circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r="45"
                    stroke="#e5e7eb"
                    strokeWidth="8"
                    fill="none"
                  />
                  {/* Animated countdown circle */}
                  <circle
                    cx="64"
                    cy="64"
                    r="45"
                    stroke={countdown <= 3 ? "#dc2626" : "#ef4444"}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className={`text-3xl font-bold ${countdown <= 3 ? 'text-red-600 animate-pulse' : 'text-gray-800'}`}>
                      {countdown}
                    </div>
                    <div className="text-sm text-gray-500">seconds</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning Message */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <svg className="w-5 h-5 text-orange-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
                <div className="text-sm text-orange-700">
                  <p className="font-semibold">You've been inactive for almost 13 hours</p>
                  <p className="mt-1">Click "Continue Session" to stay logged in, or you will be automatically logged out when the timer reaches zero.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={onContinue}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Continue Session
                </div>
              </button>
              <button
                onClick={onLogout}
                className="flex-1 bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                <div className="flex items-center justify-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Log Out Now
                </div>
              </button>
            </div>

            {/* Additional Info */}
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Last activity: <span className="font-medium">{lastActivityTime}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}