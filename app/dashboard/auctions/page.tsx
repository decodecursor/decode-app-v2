/**
 * MODEL User Auction Dashboard
 * Manage auctions, view bids, and access winner videos
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { AuctionCard } from '@/components/auctions/AuctionCard';
import type { Auction } from '@/lib/models/Auction.model';
import { isAuctionActive } from '@/lib/models/Auction.model';
import { USER_ROLES } from '@/types/user';
import { useCreatorAuctions } from '@/lib/hooks/useAuctionRealtime';

export default function AuctionsDashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    checkUserAndRole();
  }, []);

  const checkUserAndRole = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== USER_ROLES.MODEL) {
      router.push('/dashboard');
      return;
    }

    setUserRole(userData.role);
    setUserId(user.id);
    setIsLoading(false);
  };

  // Show loading while checking auth
  if (!userRole || !userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Render the dashboard content in a separate component to avoid hook issues
  return <AuctionsDashboardContent userId={userId} isLoading={isLoading} />;
}

/**
 * Auction Dashboard Content Component
 * Separated to ensure hooks are called consistently
 */
function AuctionsDashboardContent({ userId, isLoading }: { userId: string; isLoading: boolean }) {
  const router = useRouter();
  const { auctions, isConnected, refresh } = useCreatorAuctions(userId);

  return (
    <div className="cosmic-bg">
      <div className="min-h-screen px-4 py-4 md:py-8">
        {/* Back Button */}
        <div className="flex justify-center dashboard-back-button-spacing">
          <div style={{width: '70vw'}}>
            <button
              onClick={() => router.back()}
              className="inline-flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex justify-center">
          <div style={{width: '70vw'}}>
            <div className="cosmic-card header-card-mobile-spacing">
              <div className="flex items-center gap-3">
                <h1 className="cosmic-heading mb-2">My Auctions</h1>
                {isConnected && (
                  <span className="flex items-center gap-1 text-sm text-green-400">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Live
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="flex justify-center">
          <div style={{width: '70vw'}}>
            <div className="cosmic-card content-card-mobile-spacing">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <StatCard
                  label="Funds Collected"
                  value={`AED ${auctions.filter((a) => a.status === 'completed').reduce((sum, a) => sum + Number(a.auction_current_price), 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  color="blue"
                />
                <StatCard
                  label="Services Funded"
                  value={auctions.filter((a) => a.status === 'completed').length}
                  color="purple"
                />
                <StatCard
                  label="Active Auctions"
                  value={auctions.filter((a) => isAuctionActive(a)).length}
                  color="green"
                />
                <StatCard
                  label="Total Auctions"
                  value={auctions.length}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Auctions List */}
        <div className="flex justify-center">
          <div style={{width: '70vw'}}>
            <div className="cosmic-card content-card-mobile-spacing">
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto" />
                </div>
              ) : auctions.length === 0 ? (
                <div className="text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                        />
                      </svg>
                    </div>
                    <h2 className="cosmic-heading mb-2 text-white">No Auctions Yet</h2>
                    <p className="cosmic-body text-gray-300 mb-6">Create your first auction to get started</p>
                    <button
                      onClick={() => router.push('/auctions/create')}
                      className="cosmic-button-primary px-8 py-3"
                    >
                      Create Your First Auction
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {auctions.map((auction) => (
                    <AuctionCard key={auction.id} auction={auction} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Stat Card Component
 */
function StatCard({
  label,
  value,
  icon,
  color = 'gray',
}: {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  color?: 'gray' | 'green' | 'blue' | 'purple';
}) {
  const colorClasses = {
    gray: 'border-gray-700',
    green: 'border-green-500',
    blue: 'border-blue-500',
    purple: 'border-purple-500',
  };

  return (
    <div className={`bg-white/5 rounded-lg p-4 border ${colorClasses[color]} hover:bg-white/8 transition-all`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="cosmic-label text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="mt-2 text-2xl md:text-3xl font-bold text-white">{value}</p>
        </div>
        {icon && (
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {icon}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
