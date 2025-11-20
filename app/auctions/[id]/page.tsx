/**
 * Individual Auction Page
 * Server component with dynamic metadata for social sharing
 */

import { Metadata } from 'next';
import { AuctionService } from '@/lib/services/AuctionService';
import AuctionDetailClient from './AuctionDetailClient';

// Fetch auction data for metadata
async function fetchAuctionForMetadata(auctionId: string) {
  try {
    const auctionService = new AuctionService();
    const auction = await auctionService.getAuction(auctionId);
    return auction;
  } catch (error) {
    console.error('Error fetching auction for metadata:', error);
    return null;
  }
}

// Generate dynamic metadata for social sharing (WhatsApp, etc.)
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id: auctionId } = await params;
  const auction = await fetchAuctionForMetadata(auctionId);

  // Default metadata
  const defaultMetadata: Metadata = {
    title: "It's Auction Time",
    openGraph: {
      title: "It's Auction Time",
      type: 'website',
      description: 'Bid on live auctions',
      url: `https://app.welovedecode.com/auctions/${auctionId}`,
      images: [
        {
          url: 'https://app.welovedecode.com/logonew.png',
          secureUrl: 'https://app.welovedecode.com/logonew.png',
          width: 1200,
          height: 630,
          alt: 'DECODE - Make Girls More Beautiful',
          type: 'image/png',
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: "It's Auction Time",
      description: 'Bid on live auctions',
      images: {
        url: 'https://app.welovedecode.com/logonew.png',
        alt: 'DECODE - Make Girls More Beautiful',
      },
    },
  };

  // If we have auction data, create personalized metadata
  if (auction) {
    const auctionTitle = auction.title || 'Live Auction';
    const modelName = (auction as any).creator?.user_name || (auction as any).creator?.email || 'Model';

    const personalizedTitle = "It's Auction Time";
    const personalizedDescription = `Bid on ${auctionTitle} for ${modelName}`;

    return {
      title: personalizedTitle,
      openGraph: {
        title: personalizedTitle,
        type: 'website',
        description: personalizedDescription,
        url: `https://app.welovedecode.com/auctions/${auctionId}`,
        images: [
          {
            url: 'https://app.welovedecode.com/logonew.png',
            secureUrl: 'https://app.welovedecode.com/logonew.png',
            width: 1200,
            height: 630,
            alt: 'DECODE - Make Girls More Beautiful',
            type: 'image/png',
          }
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: personalizedTitle,
        description: personalizedDescription,
        images: {
          url: 'https://app.welovedecode.com/logonew.png',
          alt: 'DECODE - Make Girls More Beautiful',
        },
      },
    };
  }

  return defaultMetadata;
}

export default function AuctionDetailPage() {
  return <AuctionDetailClient />;
}
