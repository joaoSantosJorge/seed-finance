'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { useContractAddresses as useDiamondAddresses } from '@/hooks/operator/useDiamondAdmin';
import { getContractAddresses } from '@/lib/contracts';
import { useChainId } from 'wagmi';
import { formatAddress } from '@/lib/formatters';
import { ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface AddressRowProps {
  label: string;
  address: string;
  explorerUrl: string;
}

function AddressRow({ label, address, explorerUrl }: AddressRowProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isZeroAddress = address === '0x0000000000000000000000000000000000000000';

  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-color)] last:border-b-0">
      <div>
        <p className="text-body-sm text-cool-gray uppercase tracking-wider">{label}</p>
        <p className={`font-mono text-body ${isZeroAddress ? 'text-cool-gray' : 'text-white'}`}>
          {isZeroAddress ? 'Not Configured' : formatAddress(address)}
        </p>
      </div>
      {!isZeroAddress && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-2 text-cool-gray hover:text-white transition-colors"
            title="Copy Address"
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <a
            href={`${explorerUrl}/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-cool-gray hover:text-white transition-colors"
            title="View on Explorer"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}

export function ContractAddressesCard() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  const { data: diamondAddresses, isLoading } = useDiamondAddresses();

  // Determine explorer URL based on chain
  const explorerUrl =
    chainId === 1243
      ? 'https://arcscan.app'
      : chainId === 5042002
        ? 'https://testnet.arcscan.app'
        : 'https://etherscan.io';

  // Parse diamond addresses (executionPool, liquidityPool, usdc)
  const executionPoolFromDiamond = diamondAddresses?.[0] ?? addresses.executionPool;
  const liquidityPoolFromDiamond = diamondAddresses?.[1] ?? addresses.liquidityPool;
  const usdcFromDiamond = diamondAddresses?.[2] ?? addresses.usdc;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contract Addresses</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract Addresses</CardTitle>
      </CardHeader>

      <div className="space-y-1">
        <AddressRow
          label="Invoice Diamond"
          address={addresses.invoiceDiamond}
          explorerUrl={explorerUrl}
        />
        <AddressRow
          label="Execution Pool"
          address={executionPoolFromDiamond}
          explorerUrl={explorerUrl}
        />
        <AddressRow
          label="Liquidity Pool"
          address={liquidityPoolFromDiamond}
          explorerUrl={explorerUrl}
        />
        <AddressRow
          label="Treasury Manager"
          address={addresses.treasuryManager}
          explorerUrl={explorerUrl}
        />
        <AddressRow
          label="USDC"
          address={usdcFromDiamond}
          explorerUrl={explorerUrl}
        />
      </div>

      <div className="mt-4 pt-4 border-t-2 border-[var(--border-color)]">
        <p className="text-body-sm text-cool-gray">
          Network: {chainId === 1243 ? 'Arc Mainnet' : chainId === 5042002 ? 'Arc Testnet' : `Chain ${chainId}`}
        </p>
      </div>
    </Card>
  );
}
