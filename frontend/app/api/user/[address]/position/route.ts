/**
 * User Position API
 *
 * GET /api/user/:address/position
 *
 * Returns user's cost basis and realized/unrealized gains.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { address } = await params;
    const normalizedAddress = address.toLowerCase();

    // Fetch user position
    const position = await prisma.userPosition.findUnique({
      where: { userAddress: normalizedAddress },
      include: {
        shareLots: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });

    if (!position) {
      // Return empty position if user has no history
      return NextResponse.json({
        address: normalizedAddress,
        costBasis: '0.00',
        totalDeposited: '0.00',
        totalWithdrawn: '0.00',
        realizedGain: '0.00',
        unrealizedGain: '0.00',
        unrealizedGainPercent: 0,
        currentShares: '0',
        firstDepositAt: null,
        transactionCount: 0,
      });
    }

    // Calculate current shares from lots
    const currentSharesBigInt = position.shareLots.reduce(
      (sum: bigint, lot: { shares: bigint }) => sum + lot.shares,
      0n
    );
    const currentShares = Number(currentSharesBigInt) / 1e6;

    // Get current share price from latest snapshot
    const latestSnapshot = await prisma.sharePriceSnapshot.findFirst({
      orderBy: { timestamp: 'desc' },
      select: { sharePrice: true },
    });

    const currentSharePrice = latestSnapshot
      ? Number(latestSnapshot.sharePrice) / 1e6
      : 1.0;

    // Calculate unrealized gain
    const costBasis = Number(position.costBasis) / 1e6;
    const currentValue = currentShares * currentSharePrice;
    const unrealizedGain = currentValue - costBasis;
    const unrealizedGainPercent =
      costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;

    return NextResponse.json({
      address: normalizedAddress,
      costBasis: costBasis.toFixed(2),
      totalDeposited: (Number(position.totalDeposited) / 1e6).toFixed(2),
      totalWithdrawn: (Number(position.totalWithdrawn) / 1e6).toFixed(2),
      realizedGain: (Number(position.realizedGain) / 1e6).toFixed(2),
      unrealizedGain: unrealizedGain.toFixed(2),
      unrealizedGainPercent: parseFloat(unrealizedGainPercent.toFixed(2)),
      currentShares: currentShares.toFixed(6),
      currentValue: currentValue.toFixed(2),
      currentSharePrice: currentSharePrice.toFixed(6),
      firstDepositAt: position.firstDepositAt?.toISOString() ?? null,
      lastActivityAt: position.lastActivityAt?.toISOString() ?? null,
      transactionCount: position.transactionCount,
    });
  } catch (error) {
    console.error('[API] User position error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user position' },
      { status: 500 }
    );
  }
}
