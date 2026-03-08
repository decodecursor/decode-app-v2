'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { createClient } from '@/utils/supabase/client';

interface ProfileCompletionModalProps {
  isOpen: boolean;
  userEmail: string;
  preselectedRole?: string | null;
  inviteData?: any;
  onComplete: (role: string) => void;
  onClose: () => void;
}

type RoleOption = 'Admin' | 'Staff' | 'Model' | 'Buyer';

const ROLE_OPTIONS: { value: RoleOption; label: string; description: string }[] = [
  { value: 'Admin', label: 'Admin', description: 'Manage bank accounts and approve staff' },
  { value: 'Staff', label: 'Staff', description: 'Create payment links' },
  { value: 'Model', label: 'Model', description: 'Create beauty service auctions and refer beauty businesses' },
  { value: 'Buyer', label: 'Buyer', description: 'Browse and purchase offers' },
];

export default function ProfileCompletionModal({
  isOpen,
  userEmail,
  preselectedRole,
  inviteData,
  onComplete,
  onClose,
}: ProfileCompletionModalProps) {
  const supabase = createClient();

  // Determine the effective role
  const lockedRole = inviteData?.role || inviteData?.user_role || inviteData?.assignedRole || preselectedRole || null;
  const isRoleLocked = !!lockedRole;

  const [role, setRole] = useState<string>(lockedRole || '');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState(inviteData?.companyName || inviteData?.company_name || '');
  const [instagramHandle, setInstagramHandle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Company autocomplete
  const [companySuggestions, setCompanySuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [hasSelectedSuggestion, setHasSelectedSuggestion] = useState(!!inviteData);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Derived flags
  const needsRoleSelector = !isRoleLocked;
  const needsCompanyField = role === 'Admin' || role === 'Staff';
  const needsInstagramField = role === 'Model';
  const isCompanyLocked = !!inviteData;

  // Sync role when props change
  useEffect(() => {
    if (lockedRole) {
      setRole(lockedRole);
    }
  }, [lockedRole]);

  // Sync invite company
  useEffect(() => {
    if (inviteData) {
      const inviteCompany = inviteData.companyName || inviteData.company_name || '';
      setCompanyName(inviteCompany);
      setHasSelectedSuggestion(true);
    }
  }, [inviteData]);

  // Auto-focus name input
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      const timer = setTimeout(() => nameInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Company autocomplete
  useEffect(() => {
    if (companyName.length < 3 || hasSelectedSuggestion) {
      setShowSuggestions(false);
      setCompanySuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/companies/suggestions?q=${encodeURIComponent(companyName)}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.suggestions?.length) {
            setCompanySuggestions(data.suggestions);
            setShowSuggestions(true);
          } else {
            setShowSuggestions(false);
          }
        }
      } catch {
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [companyName, hasSelectedSuggestion]);

  const handleCompanySelect = (selected: string) => {
    setCompanyName(selected);
    setShowSuggestions(false);
    setCompanySuggestions([]);
    setHasSelectedSuggestion(true);
  };

  const handleCompanyChange = (value: string) => {
    setCompanyName(value);
    if (hasSelectedSuggestion) setHasSelectedSuggestion(false);
  };

  // Subtitle text
  const getSubtitle = () => {
    if (!role && !isRoleLocked) return 'Select your role to get started';
    if (role === 'Buyer') return 'Enter your name to get started';
    return 'Enter your details to get started';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!role) {
      setError('Please select your role');
      return;
    }

    if (!name.trim() || name.trim().length < 2) {
      setError('Please enter your full name (at least 2 characters)');
      return;
    }

    if (needsCompanyField && (!companyName.trim() || companyName.trim().length < 2)) {
      setError('Please enter a company name (at least 2 characters)');
      return;
    }

    if (needsInstagramField && instagramHandle) {
      const cleaned = instagramHandle.replace('@', '');
      if (!/^[a-zA-Z0-9._]+$/.test(cleaned)) {
        setError('Instagram username can only contain letters, numbers, periods, and underscores');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('Authentication error. Please try again.');

      // Branch auto-assignment for Staff
      let branchToAssign = role === 'Admin' ? 'Main Branch' : null;

      if (role === 'Staff') {
        try {
          const { data: companyUsers } = await supabase
            .from('users')
            .select('branch_name')
            .eq('company_name', companyName.trim())
            .eq('approval_status', 'approved')
            .not('branch_name', 'is', null);

          if (companyUsers) {
            const branches = new Set<string>();
            companyUsers.forEach(u => {
              if (u.branch_name) {
                u.branch_name.split(',').map((b: string) => b.trim()).filter((b: string) => b).forEach((b: string) => branches.add(b));
              }
            });

            if (branches.size === 1 && branches.has('Main Branch')) {
              branchToAssign = 'Main Branch';
            } else if (branches.size === 0) {
              const { data: adminUser } = await supabase
                .from('users')
                .select('branch_name')
                .eq('company_name', companyName.trim())
                .eq('role', 'Admin')
                .eq('approval_status', 'approved')
                .single();

              if (adminUser?.branch_name === 'Main Branch') {
                branchToAssign = 'Main Branch';
              }
            }
          }
        } catch {
          // Proceed without auto-assignment
        }
      }

      const cleanedInstagram = instagramHandle.trim().replace('@', '');

      const profileData: Record<string, any> = {
        id: user.id,
        email: userEmail || user.email,
        user_name: name.trim(),
        role,
        company_name: needsCompanyField ? companyName.trim() : (role === 'Model' ? '' : companyName.trim()),
        branch_name: branchToAssign,
        approval_status: (role === 'Admin' || role === 'Model' || role === 'Buyer' || inviteData) ? 'approved' : 'pending',
        terms_accepted_at: new Date().toISOString(),
        phone_number: user.user_metadata?.phone_number || null,
      };

      if (role === 'Model') {
        profileData.instagram_handle = cleanedInstagram || null;
        profileData.company_name = '';
      }

      const response = await fetch('/api/auth/create-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create profile');
      }

      onComplete(role);
    } catch (err) {
      console.error('Profile creation error:', err);
      const msg = (err as Error)?.message || 'An error occurred';
      if (msg.includes('company_name') && msg.includes('null')) {
        setError('Company name is required and cannot be empty');
      } else if (msg.includes('duplicate') || msg.includes('23505')) {
        setError('A user with this email already exists');
      } else {
        setError(msg);
      }
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
                  <p className="text-gray-400 text-sm">{getSubtitle()}</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Role Selector — only when no pre-determined role */}
                  {needsRoleSelector && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Role <span className="text-purple-400">*</span>
                      </label>
                      <div className="space-y-2">
                        {ROLE_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border transition-colors ${
                              role === opt.value
                                ? 'border-purple-500 bg-gray-800'
                                : 'border-gray-700 hover:border-purple-500/50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="role"
                              value={opt.value}
                              checked={role === opt.value}
                              onChange={(e) => setRole(e.target.value)}
                              className="w-4 h-4 accent-purple-500"
                              disabled={isSubmitting}
                            />
                            <div className="flex-1">
                              <div className="text-white font-medium text-sm">{opt.label}</div>
                              <div className="text-gray-400 text-xs">{opt.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Company Field — Admin/Staff only */}
                  {needsCompanyField && (
                    <div className="relative">
                      <label htmlFor="company" className="block text-sm font-medium text-gray-300 mb-2">
                        Company <span className="text-purple-400">*</span>
                      </label>
                      <input
                        type="text"
                        id="company"
                        value={companyName}
                        onChange={(e) => handleCompanyChange(e.target.value)}
                        onFocus={() => !hasSelectedSuggestion && setShowSuggestions(companySuggestions.length > 0)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        className={`w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors ${isCompanyLocked ? 'opacity-70' : ''}`}
                        placeholder="Enter company name"
                        disabled={isSubmitting || isCompanyLocked}
                        autoComplete="off"
                      />
                      {isCompanyLocked && (
                        <p className="text-xs text-green-400 mt-1">Pre-filled from invitation</p>
                      )}
                      {showSuggestions && companySuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg mt-1 z-10 max-h-32 overflow-y-auto">
                          {companySuggestions.map((suggestion, i) => (
                            <button
                              key={i}
                              type="button"
                              className="w-full text-left px-4 py-2 text-white hover:bg-purple-600 transition-colors first:rounded-t-lg last:rounded-b-lg"
                              onClick={() => handleCompanySelect(suggestion)}
                            >
                              {suggestion}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Name Field */}
                  <div>
                    <label htmlFor="profile-name" className="block text-sm font-medium text-gray-300 mb-2">
                      Full Name <span className="text-purple-400">*</span>
                    </label>
                    <input
                      ref={nameInputRef}
                      type="text"
                      id="profile-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                      placeholder="Enter your full name"
                      disabled={isSubmitting}
                      autoFocus={isRoleLocked}
                    />
                  </div>

                  {/* Instagram Field — Model only */}
                  {needsInstagramField && (
                    <div>
                      <label htmlFor="instagram" className="block text-sm font-medium text-gray-300 mb-2">
                        Instagram Username <span className="text-gray-500 text-xs">(optional)</span>
                      </label>
                      <div className="relative">
                        <svg
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5"
                          viewBox="0 0 24 24"
                          fill="url(#ig-gradient)"
                        >
                          <defs>
                            <linearGradient id="ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                              <stop offset="0%" style={{ stopColor: '#f09433' }} />
                              <stop offset="25%" style={{ stopColor: '#e6683c' }} />
                              <stop offset="50%" style={{ stopColor: '#dc2743' }} />
                              <stop offset="75%" style={{ stopColor: '#cc2366' }} />
                              <stop offset="100%" style={{ stopColor: '#bc1888' }} />
                            </linearGradient>
                          </defs>
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
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
                  )}

                  {/* Error */}
                  {error && (
                    <div className="p-4 bg-red-600/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={isSubmitting || !name.trim() || !role}
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
