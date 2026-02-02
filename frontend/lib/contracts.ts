import { appConfig, USDC_DECIMALS, SEED_DECIMALS } from './config';

export { USDC_DECIMALS, SEED_DECIMALS };

// Backward-compatible wrapper - chainId parameter is ignored, uses appConfig
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getContractAddresses(chainId?: number) {
  return appConfig.contracts;
}

export function getExplorerTxUrl(txHash: string): string;
export function getExplorerTxUrl(chainId: number, txHash: string): string;
export function getExplorerTxUrl(
  chainIdOrTxHash: number | string,
  txHash?: string
): string {
  const hash =
    typeof chainIdOrTxHash === 'string' ? chainIdOrTxHash : txHash || '';
  return appConfig.explorerUrl ? `${appConfig.explorerUrl}/tx/${hash}` : '';
}

export function getExplorerAddressUrl(address: string): string;
export function getExplorerAddressUrl(chainId: number, address: string): string;
export function getExplorerAddressUrl(
  chainIdOrAddress: number | string,
  address?: string
): string {
  const addr =
    typeof chainIdOrAddress === 'string' ? chainIdOrAddress : address || '';
  return appConfig.explorerUrl
    ? `${appConfig.explorerUrl}/address/${addr}`
    : '';
}
