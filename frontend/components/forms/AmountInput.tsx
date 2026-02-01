'use client';

import { Input } from '@/components/ui';
import { parseUnits } from 'viem';
import { USDC_DECIMALS } from '@/lib/contracts';

interface AmountInputProps {
  value: string;
  onChange: (value: string, rawValue: bigint) => void;
  maxValue?: bigint;
  decimals?: number;
  label?: string;
  placeholder?: string;
  rightElement?: React.ReactNode;
  error?: string;
  disabled?: boolean;
}

export function AmountInput({
  value,
  onChange,
  decimals = USDC_DECIMALS,
  label,
  placeholder = '0.00',
  rightElement,
  error,
  disabled = false,
}: AmountInputProps) {
  // maxValue is available for potential future use (e.g., max validation)
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;

    // Allow empty input
    if (inputValue === '') {
      onChange('', 0n);
      return;
    }

    // Validate number format
    if (!/^\d*\.?\d*$/.test(inputValue)) {
      return;
    }

    // Limit decimal places
    const parts = inputValue.split('.');
    if (parts[1] && parts[1].length > decimals) {
      return;
    }

    try {
      const rawValue = parseUnits(inputValue || '0', decimals);
      onChange(inputValue, rawValue);
    } catch {
      // Invalid number, ignore
    }
  };

  return (
    <Input
      label={label}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      rightElement={rightElement}
      error={error}
      disabled={disabled}
      className="text-lg"
    />
  );
}

interface QuickAmountButtonsProps {
  maxValue: bigint;
  onSelect: (value: bigint) => void;
  decimals?: number;
}

export function QuickAmountButtons({
  maxValue,
  onSelect,
}: QuickAmountButtonsProps) {
  const percentages = [25, 50, 75, 100];

  const handleSelect = (pct: number) => {
    const amount = (maxValue * BigInt(pct)) / 100n;
    onSelect(amount);
  };

  return (
    <div className="flex gap-2">
      {percentages.map((pct) => (
        <button
          key={pct}
          type="button"
          onClick={() => handleSelect(pct)}
          className="px-3 py-1.5 text-body-sm font-medium text-cool-gray bg-slate-700 rounded-md hover:text-white hover:bg-slate-600 transition-colors"
        >
          {pct === 100 ? 'MAX' : `${pct}%`}
        </button>
      ))}
    </div>
  );
}
