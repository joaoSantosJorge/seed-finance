/**
 * Pool State History API
 *
 * GET /api/pool/state-history?period=7d|30d|90d|all
 *
 * Returns historical pool state data for analytics charts
 * (utilization rate, yield breakdown, etc.)
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

    // Fetch pool state snapshots
    const snapshots = await prisma.poolStateSnapshot.findMany({
      where: fromDate ? { timestamp: { gte: fromDate } } : undefined,
      orderBy: { timestamp: 'asc' },
      select: {
        timestamp: true,
        utilizationRate: true,
        totalInvoiceYield: true,
        totalTreasuryYield: true,
        totalAssets: true,
        totalDeployed: true,
        totalInTreasury: true,
        availableLiquidity: true,
      },
    });

    // Define snapshot type
    type PoolSnapshot = {
      timestamp: Date;
      utilizationRate: number;
      totalInvoiceYield: bigint;
      totalTreasuryYield: bigint;
      totalAssets: bigint;
      totalDeployed: bigint;
      totalInTreasury: bigint;
      availableLiquidity: bigint;
    };

    // Convert to response format
    const dataPoints = snapshots.map((s: PoolSnapshot) => ({
      timestamp: Math.floor(s.timestamp.getTime() / 1000),
      utilizationRate: s.utilizationRate / 100, // Convert basis points to percent
      totalInvoiceYield: Number(s.totalInvoiceYield) / 1e6,
      totalTreasuryYield: Number(s.totalTreasuryYield) / 1e6,
      totalAssets: Number(s.totalAssets) / 1e6,
      totalDeployed: Number(s.totalDeployed) / 1e6,
      totalInTreasury: Number(s.totalInTreasury) / 1e6,
      availableLiquidity: Number(s.availableLiquidity) / 1e6,
    }));

    // Calculate yield change over period
    let yieldChange = { invoice: 0, treasury: 0, total: 0 };
    if (dataPoints.length >= 2) {
      const first = dataPoints[0];
      const last = dataPoints[dataPoints.length - 1];
      yieldChange = {
        invoice: last.totalInvoiceYield - first.totalInvoiceYield,
        treasury: last.totalTreasuryYield - first.totalTreasuryYield,
        total:
          last.totalInvoiceYield +
          last.totalTreasuryYield -
          first.totalInvoiceYield -
          first.totalTreasuryYield,
      };
    }

    return NextResponse.json({
      period,
      dataPoints,
      yieldChange,
    });
  } catch (error) {
    console.error('[API] Pool state history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pool state history' },
      { status: 500 }
    );
  }
}
