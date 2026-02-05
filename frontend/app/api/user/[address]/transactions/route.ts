/**
 * User Transactions API
 *
 * GET /api/user/:address/transactions?limit=50&offset=0&type=deposit|withdraw
 *
 * Returns paginated transaction history for a user.
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

interface RouteParams {
  params: Promise<{ address: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const eventType = searchParams.get('type'); // 'deposit' | 'withdraw' | null

    const normalizedAddress = address.toLowerCase();

    // Build where clause
    const where: { userAddress: string; eventType?: string } = {
      userAddress: normalizedAddress,
    };
    if (eventType === 'deposit' || eventType === 'withdraw') {
      where.eventType = eventType;
    }

    // Fetch transactions and total count in parallel
    const [transactions, total] = await Promise.all([
      prisma.userTransaction.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
        select: {
          txHash: true,
          eventType: true,
          assets: true,
          shares: true,
          sharePriceAtTime: true,
          timestamp: true,
          blockNumber: true,
        },
      }),
      prisma.userTransaction.count({ where }),
    ]);

    // Define transaction type
    type Transaction = {
      txHash: string;
      eventType: string;
      assets: bigint;
      shares: bigint;
      sharePriceAtTime: bigint;
      timestamp: Date;
      blockNumber: bigint;
    };

    // Format response
    const formattedTransactions = transactions.map((tx: Transaction) => ({
      txHash: tx.txHash,
      type: tx.eventType as 'deposit' | 'withdraw',
      assets: (Number(tx.assets) / 1e6).toFixed(2),
      shares: (Number(tx.shares) / 1e6).toFixed(6),
      sharePrice: (Number(tx.sharePriceAtTime) / 1e6).toFixed(6),
      timestamp: tx.timestamp.toISOString(),
      blockNumber: tx.blockNumber.toString(),
    }));

    return NextResponse.json({
      transactions: formattedTransactions,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      hasMore: offset + transactions.length < total,
    });
  } catch (error) {
    console.error('[API] User transactions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user transactions' },
      { status: 500 }
    );
  }
}
