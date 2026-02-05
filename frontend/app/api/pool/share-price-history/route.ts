/**
 * Share Price History API
 *
 * GET /api/pool/share-price-history?period=7d|30d|90d|all
 *
 * Returns historical share price data for charting.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

type Period = '7d' | '30d' | '90d' | 'all';

const PERIOD_DAYS: Record<Period, number | null> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') as Period) || '30d';
    const days = PERIOD_DAYS[period];

    // Calculate date range
    const fromDate = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : undefined;

    // Fetch share price snapshots
    const snapshots = await prisma.sharePriceSnapshot.findMany({
      where: fromDate ? { timestamp: { gte: fromDate } } : undefined,
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        sharePrice: true,
      },
    });

    // Convert to response format
    const dataPoints = snapshots.map((s: { timestamp: Date; sharePrice: bigint }) => ({
      timestamp: Math.floor(s.timestamp.getTime() / 1000),
      sharePrice: Number(s.sharePrice) / 1e6, // Convert from 6 decimals to float
    }));

    // Calculate change
    let change = { absolute: 0, percent: 0 };
    if (dataPoints.length >= 2) {
      const first = dataPoints[0].sharePrice;
      const last = dataPoints[dataPoints.length - 1].sharePrice;
      const absolute = last - first;
      const percent = first > 0 ? (absolute / first) * 100 : 0;
      change = { absolute, percent };
    }

    return NextResponse.json({
      period,
      dataPoints,
      change,
    });
  } catch (error) {
    console.error('[API] Share price history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share price history' },
      { status: 500 }
    );
  }
}
