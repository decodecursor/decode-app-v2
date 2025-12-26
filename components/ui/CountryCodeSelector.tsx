'use client';

import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { Popover, Transition, Dialog } from '@headlessui/react';
import { COUNTRY_CODES, CountryCode, findCountryByCode, findCountryById, getAllCountriesSorted } from '@/lib/country-codes';

const STORAGE_KEY = 'decode_recent_countries';
const MAX_RECENT = 5;

// Map browser locale to country ID
const LOCALE_TO_COUNTRY: Record<string, string> = {
  'AE': 'AE', 'US': 'US', 'GB': 'GB', 'DE': 'DE', 'FR': 'FR',
  'IN': 'IN', 'SA': 'SA', 'EG': 'EG', 'CA': 'CA', 'AU': 'AU',
  'IT': 'IT', 'ES': 'ES', 'NL': 'NL', 'BR': 'BR', 'MX': 'MX',
  'JP': 'JP', 'KR': 'KR', 'CN': 'CN', 'RU': 'RU', 'PK': 'PK',
  'BD': 'BD', 'ID': 'ID', 'PH': 'PH', 'VN': 'VN', 'TH': 'TH',
  'MY': 'MY', 'SG': 'SG', 'TR': 'TR', 'PL': 'PL', 'UA': 'UA',
  'NG': 'NG', 'ZA': 'ZA', 'KE': 'KE', 'GH': 'GH', 'MA': 'MA',
};

interface CountryCodeSelectorProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  variant?: 'dark' | 'light';
  className?: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightMatch(text: string, query: string, variant: 'dark' | 'light'): React.ReactNode {
  if (!query.trim()) return text;

  try {
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className={variant === 'dark' ? 'bg-purple-500/40 text-white rounded px-0.5' : 'bg-purple-100 text-purple-800 rounded px-0.5'}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  } catch {
    return text;
  }
}

function detectCountryFromLocale(): string {
  if (typeof navigator === 'undefined') return 'AE';

  const locale = navigator.language || '';
  const parts = locale.split('-');
  const countryCode = parts[1]?.toUpperCase() || parts[0]?.toUpperCase();

  return LOCALE_TO_COUNTRY[countryCode] || 'AE';
}

function getRecentCountries(): CountryCode[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const ids: string[] = JSON.parse(stored);
    return ids
      .map(id => findCountryById(id))
      .filter((c): c is CountryCode => c !== undefined)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function saveRecentCountry(country: CountryCode): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];

    const filtered = ids.filter(id => id !== country.id);
    const updated = [country.id, ...filtered].slice(0, MAX_RECENT);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function CountryCodeSelector({
  value,
  onChange,
  disabled = false,
  variant = 'dark',
  className = '',
}: CountryCodeSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentCountries, setRecentCountries] = useState<CountryCode[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  // Get selected country
  const selectedCountry = useMemo(() => {
    return findCountryByCode(value) || COUNTRY_CODES[0];
  }, [value]);

  // Get all countries sorted alphabetically
  const allCountries = useMemo(() => getAllCountriesSorted(), []);

  // Group countries by first letter
  const groupedCountries = useMemo(() => {
    const groups: Record<string, CountryCode[]> = {};

    allCountries.forEach(country => {
      const letter = country.country[0].toUpperCase();
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(country);
    });

    return groups;
  }, [allCountries]);

  // Filter countries based on search
  const filteredCountries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return null; // Return null to show grouped view

    return allCountries.filter(c =>
      c.country.toLowerCase().includes(q) ||
      c.code.includes(q) ||
      c.code.replace('+', '').includes(q)
    );
  }, [searchQuery, allCountries]);

  // Load recent countries and check mobile
  useEffect(() => {
    setRecentCountries(getRecentCountries());

    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Auto-detect country on first load if no value set
  useEffect(() => {
    if (!value) {
      const detectedId = detectCountryFromLocale();
      const country = findCountryById(detectedId);
      if (country) {
        onChange(country.code);
      }
    }
  }, []);

  const handleSelect = (country: CountryCode, close?: () => void) => {
    onChange(country.code);
    saveRecentCountry(country);
    setRecentCountries(getRecentCountries());
    setSearchQuery('');
    if (close) close();
    if (mobileOpen) setMobileOpen(false);
  };

  // Styling based on variant
  const styles = {
    dark: {
      trigger: 'bg-transparent border border-purple-500 text-white hover:border-purple-400',
      dropdown: 'bg-gray-900 border border-purple-500/30',
      search: 'bg-gray-800 border-gray-700 text-white placeholder:text-gray-500',
      sectionHeader: 'text-gray-500',
      option: 'text-white hover:bg-purple-600/20',
      optionCode: 'text-gray-400',
      divider: 'border-gray-700',
    },
    light: {
      trigger: 'bg-white border border-gray-300 text-gray-700 hover:border-gray-400',
      dropdown: 'bg-white border border-gray-200 shadow-lg',
      search: 'bg-gray-50 border-gray-200 text-gray-900 placeholder:text-gray-400',
      sectionHeader: 'text-gray-500',
      option: 'text-gray-900 hover:bg-purple-50',
      optionCode: 'text-gray-500',
      divider: 'border-gray-200',
    },
  }[variant];

  const renderCountryOption = (country: CountryCode, close?: () => void) => (
    <button
      key={country.id}
      type="button"
      onClick={() => handleSelect(country, close)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 sm:py-2 transition-colors ${styles.option}`}
    >
      <span className="text-xl flex-shrink-0">{country.flag}</span>
      <span className="flex-1 text-left text-sm truncate">
        {highlightMatch(country.country, searchQuery, variant)}
      </span>
      <span className={`text-sm flex-shrink-0 ${styles.optionCode}`}>
        {highlightMatch(country.code, searchQuery, variant)}
      </span>
    </button>
  );

  const renderDropdownContent = (close?: () => void) => (
    <>
      {/* Search Input */}
      <div className={`p-2 border-b ${styles.divider}`}>
        <input
          ref={isMobile ? mobileSearchInputRef : searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search country or code..."
          className={`w-full px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2 focus:ring-purple-500 ${styles.search}`}
          autoFocus={!isMobile}
        />
      </div>

      {/* Scrollable List */}
      <div className="max-h-[350px] sm:max-h-[300px] overflow-y-auto">
        {filteredCountries ? (
          // Search results
          filteredCountries.length > 0 ? (
            <div className="py-1">
              {filteredCountries.map(c => renderCountryOption(c, close))}
            </div>
          ) : (
            <div className={`px-3 py-6 text-center text-sm ${styles.sectionHeader}`}>
              No countries found
            </div>
          )
        ) : (
          // Grouped view with Recent + A-Z
          <>
            {/* Recent Section */}
            {recentCountries.length > 0 && (
              <>
                <div className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${styles.sectionHeader}`}>
                  Recent
                </div>
                {recentCountries.map(c => renderCountryOption(c, close))}
                <div className={`border-b my-1 ${styles.divider}`} />
              </>
            )}

            {/* All Countries A-Z */}
            {Object.entries(groupedCountries)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([letter, countries]) => (
                <div key={letter}>
                  <div className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider sticky top-0 ${variant === 'dark' ? 'bg-gray-900' : 'bg-white'} ${styles.sectionHeader}`}>
                    {letter}
                  </div>
                  {countries.map(c => renderCountryOption(c, close))}
                </div>
              ))}
          </>
        )}
      </div>
    </>
  );

  // Trigger button content
  const triggerContent = (
    <>
      <span className="text-lg">{selectedCountry.flag}</span>
      <span className="text-sm font-medium">{selectedCountry.code}</span>
      <svg
        className="w-4 h-4 text-current opacity-60"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </>
  );

  // Mobile: Full-screen dialog
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => !disabled && setMobileOpen(true)}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors ${styles.trigger} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
          {triggerContent}
        </button>

        <Dialog
          open={mobileOpen}
          onClose={() => {
            setMobileOpen(false);
            setSearchQuery('');
          }}
          className="relative z-50"
        >
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/60" aria-hidden="true" />

          {/* Full-screen panel */}
          <div className="fixed inset-0 flex flex-col">
            <Dialog.Panel className={`flex-1 flex flex-col m-3 rounded-xl overflow-hidden ${styles.dropdown}`}>
              {/* Header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${styles.divider}`}>
                <Dialog.Title className={`text-lg font-medium ${variant === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                  Select Country
                </Dialog.Title>
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    setSearchQuery('');
                  }}
                  className={`p-1 rounded-md ${variant === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {renderDropdownContent()}
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </>
    );
  }

  // Desktop: Popover dropdown
  return (
    <Popover className="relative">
      {({ open, close }) => (
        <>
          <Popover.Button
            disabled={disabled}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 ${styles.trigger} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
          >
            {triggerContent}
          </Popover.Button>

          <Transition
            as={Fragment}
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 translate-y-1"
            enterTo="opacity-100 translate-y-0"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 translate-y-0"
            leaveTo="opacity-0 translate-y-1"
            afterEnter={() => searchInputRef.current?.focus()}
            afterLeave={() => setSearchQuery('')}
          >
            <Popover.Panel className={`absolute z-50 mt-1 w-72 rounded-lg overflow-hidden ${styles.dropdown}`}>
              {renderDropdownContent(close)}
            </Popover.Panel>
          </Transition>
        </>
      )}
    </Popover>
  );
}

export default CountryCodeSelector;
