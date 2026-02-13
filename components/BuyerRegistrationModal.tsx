'use client';

import { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { createClient } from '@/utils/supabase/client';

interface BuyerRegistrationModalProps {
  isOpen: boolean;
  userEmail: string;
  onComplete: (role?: string) => void;
}

export default function BuyerRegistrationModal({ isOpen, userEmail, onComplete }: BuyerRegistrationModalProps) {
  const supabase = createClient();

  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters)');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error('Authentication error. Please try again.');
      }

      const profileData = {
        id: user.id,
        email: userEmail || user.email,
        user_name: name.trim(),
        role: 'Buyer',
        approval_status: 'approved',
        terms_accepted_at: new Date().toISOString(),
        phone_number: user.user_metadata?.phone_number || null,
      };

      console.log('🛒 [BuyerRegistration] Creating buyer profile:', profileData);

      const response = await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create profile');
      }

      console.log('✅ [BuyerRegistration] Profile created');
      onComplete('Buyer');

    } catch (err) {
      console.error('❌ [BuyerRegistration] Error:', err);
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
                {/* Title */}
                <div className="text-center mb-8">
                  <Dialog.Title as="h2" className="text-2xl md:text-3xl font-bold text-white mb-2">
                    Complete Registration
                  </Dialog.Title>
                  <p className="text-gray-400 text-sm">Enter your name to get started</p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="buyer-name" className="block text-sm font-medium text-gray-300 mb-2">
                      Full Name <span className="text-purple-400">*</span>
                    </label>
                    <input
                      type="text"
                      id="buyer-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                      placeholder="Enter your full name"
                      disabled={isSubmitting}
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="p-4 bg-red-600/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim()}
                    className="w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-purple-600"
                  >
                    {isSubmitting ? 'Creating Your Account...' : 'Continue'}
                  </button>

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
