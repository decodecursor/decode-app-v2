'use client';

import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

interface ModelRegistrationModalProps {
  isOpen: boolean;
  userEmail: string;
  onComplete: (role?: string) => void;
}

export default function ModelRegistrationModal({ isOpen, userEmail, onComplete }: ModelRegistrationModalProps) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate name
    if (!name.trim() || name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters)');
      return;
    }

    // Validate Instagram handle if provided
    const cleanedInstagram = instagramHandle.trim().replace('@', '');
    if (cleanedInstagram && !/^[a-zA-Z0-9._]+$/.test(cleanedInstagram)) {
      setError('Instagram username can only contain letters, numbers, periods, and underscores');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Authentication error. Please try again.');
      }

      // Prepare profile data
      const profileData = {
        id: user.id,
        email: userEmail || user.email,
        user_name: name.trim(),
        role: 'Model',
        company_name: '',
        branch_name: null,
        approval_status: 'approved',
        terms_accepted_at: new Date().toISOString(),
        instagram_handle: cleanedInstagram || null,
      };

      console.log('🎭 [ModelRegistration] Creating model profile:', profileData);

      // Always use API route to ensure admin email notification is sent
      const response = await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create profile');
      }

      const { data: createdProfile } = await response.json();
      console.log('✅ [ModelRegistration] Profile created via API:', createdProfile);

      // Success - redirect to dashboard
      onComplete('Model');
      router.push('/dashboard?new_user=true&welcome=model');
      router.refresh();

    } catch (err) {
      console.error('❌ [ModelRegistration] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => {}}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 border border-purple-500/20 p-6 md:p-8 shadow-2xl transition-all">
                {/* Badge */}
                <div className="flex justify-center mb-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/30 rounded-full">
                    <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span className="text-sm font-semibold text-purple-300">Model Registration</span>
                  </div>
                </div>

                {/* Welcome Message */}
                <div className="text-center mb-8">
                  <Dialog.Title as="h2" className="text-2xl md:text-3xl font-bold text-white mb-2">
                    {/* Welcome heading removed */}
                  </Dialog.Title>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name Field */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                      Full Name <span className="text-purple-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                      placeholder="Enter your full name"
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </div>

                  {/* Instagram Field */}
                  <div>
                    <label htmlFor="instagram" className="block text-sm font-medium text-gray-300 mb-2">
                      Instagram Username <span className="text-gray-500 text-xs">(optional)</span>
                    </label>
                    <div className="relative">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="url(#instagram-gradient)"
                      >
                        <defs>
                          <linearGradient id="instagram-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" style={{ stopColor: '#f09433' }} />
                            <stop offset="25%" style={{ stopColor: '#e6683c' }} />
                            <stop offset="50%" style={{ stopColor: '#dc2743' }} />
                            <stop offset="75%" style={{ stopColor: '#cc2366' }} />
                            <stop offset="100%" style={{ stopColor: '#bc1888' }} />
                          </linearGradient>
                        </defs>
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                      <input
                        type="text"
                        id="instagram"
                        value={instagramHandle}
                        onChange={(e) => {
                          const value = e.target.value.replace('@', '').replace(/[^a-zA-Z0-9._]/g, '');
                          setInstagramHandle(value);
                        }}
                        className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                        placeholder="username"
                        disabled={isSubmitting}
                        autoCapitalize="none"
                        autoCorrect="off"
                      />
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="p-4 bg-red-600/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim()}
                    className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600"
                  >
                    {isSubmitting ? 'Creating Your Account...' : 'Complete Registration'}
                  </button>

                  {/* Email Display */}
                  <p className="text-center text-xs text-gray-500 mt-4">
                    Registering as: {userEmail}
                  </p>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
