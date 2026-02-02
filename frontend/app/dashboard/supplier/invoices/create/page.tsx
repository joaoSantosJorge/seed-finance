'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, Input, Button } from '@/components/ui';
import { useCreateInvoice } from '@/hooks';
import { parseUnits } from 'viem';
import { type Address } from 'viem';

export default function CreateInvoicePage() {
  const router = useRouter();
  const { createInvoice, isPending, isConfirming, isSuccess, error, reset } = useCreateInvoice();

  const [formData, setFormData] = useState({
    buyerAddress: '',
    faceValue: '',
    discountRate: '5',
    maturityDays: '30',
    externalId: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.buyerAddress) {
      newErrors.buyerAddress = 'Buyer address is required';
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(formData.buyerAddress)) {
      newErrors.buyerAddress = 'Invalid Ethereum address';
    }

    if (!formData.faceValue || parseFloat(formData.faceValue) <= 0) {
      newErrors.faceValue = 'Face value must be greater than 0';
    }

    const discountRate = parseFloat(formData.discountRate);
    if (isNaN(discountRate) || discountRate < 0 || discountRate > 100) {
      newErrors.discountRate = 'Discount rate must be between 0 and 100';
    }

    const days = parseInt(formData.maturityDays);
    if (isNaN(days) || days < 1 || days > 365) {
      newErrors.maturityDays = 'Maturity must be between 1 and 365 days';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset();

    if (!validateForm()) return;

    const faceValue = parseUnits(formData.faceValue, 6);
    const discountRateBps = Math.round(parseFloat(formData.discountRate) * 100);
    const maturityDate = new Date();
    maturityDate.setDate(maturityDate.getDate() + parseInt(formData.maturityDays));

    createInvoice({
      buyer: formData.buyerAddress as Address,
      faceValue,
      discountRateBps,
      maturityDate,
      externalId: formData.externalId || undefined,
    });
  };

  // Calculate funding preview
  const calculateFunding = () => {
    if (!formData.faceValue || !formData.discountRate || !formData.maturityDays) return null;

    const faceValue = parseFloat(formData.faceValue);
    const discountRate = parseFloat(formData.discountRate) / 100;
    const days = parseInt(formData.maturityDays);

    const discount = faceValue * discountRate * (days / 365);
    const funding = faceValue - discount;

    return {
      faceValue: faceValue.toFixed(2),
      discount: discount.toFixed(2),
      funding: funding.toFixed(2),
    };
  };

  const fundingPreview = calculateFunding();

  // Redirect on success
  if (isSuccess) {
    router.push('/dashboard/supplier/invoices');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/supplier/invoices"
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-cool-gray" />
        </Link>
        <div>
          <h1 className="text-h1 text-white">Create Invoice</h1>
          <p className="text-body text-cool-gray mt-1">
            Submit a new invoice for early payment
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <div className="space-y-6 p-6 pt-0">
            {/* Buyer Address */}
            <div>
              <label className="block text-body-sm text-cool-gray mb-2">
                Buyer Address *
              </label>
              <Input
                type="text"
                placeholder="0x..."
                value={formData.buyerAddress}
                onChange={(e) => setFormData({ ...formData, buyerAddress: e.target.value })}
                className={errors.buyerAddress ? 'border-error' : ''}
              />
              {errors.buyerAddress && (
                <p className="text-error text-body-sm mt-1">{errors.buyerAddress}</p>
              )}
            </div>

            {/* Face Value */}
            <div>
              <label className="block text-body-sm text-cool-gray mb-2">
                Face Value (USDC) *
              </label>
              <Input
                type="number"
                placeholder="10000"
                min="0"
                step="0.01"
                value={formData.faceValue}
                onChange={(e) => setFormData({ ...formData, faceValue: e.target.value })}
                className={errors.faceValue ? 'border-error' : ''}
              />
              {errors.faceValue && (
                <p className="text-error text-body-sm mt-1">{errors.faceValue}</p>
              )}
            </div>

            {/* Discount Rate */}
            <div>
              <label className="block text-body-sm text-cool-gray mb-2">
                Annual Discount Rate (%) *
              </label>
              <Input
                type="number"
                placeholder="5"
                min="0"
                max="100"
                step="0.1"
                value={formData.discountRate}
                onChange={(e) => setFormData({ ...formData, discountRate: e.target.value })}
                className={errors.discountRate ? 'border-error' : ''}
              />
              {errors.discountRate && (
                <p className="text-error text-body-sm mt-1">{errors.discountRate}</p>
              )}
              <p className="text-cool-gray text-body-sm mt-1">
                This is the annualized rate you pay for early payment
              </p>
            </div>

            {/* Maturity Days */}
            <div>
              <label className="block text-body-sm text-cool-gray mb-2">
                Days Until Maturity *
              </label>
              <Input
                type="number"
                placeholder="30"
                min="1"
                max="365"
                value={formData.maturityDays}
                onChange={(e) => setFormData({ ...formData, maturityDays: e.target.value })}
                className={errors.maturityDays ? 'border-error' : ''}
              />
              {errors.maturityDays && (
                <p className="text-error text-body-sm mt-1">{errors.maturityDays}</p>
              )}
            </div>

            {/* External ID */}
            <div>
              <label className="block text-body-sm text-cool-gray mb-2">
                External Reference (Optional)
              </label>
              <Input
                type="text"
                placeholder="INV-2024-001"
                value={formData.externalId}
                onChange={(e) => setFormData({ ...formData, externalId: e.target.value })}
              />
            </div>
          </div>
        </Card>

        {/* Funding Preview */}
        {fundingPreview && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Funding Preview</CardTitle>
            </CardHeader>
            <div className="space-y-3 p-6 pt-0">
              <div className="flex justify-between">
                <span className="text-cool-gray text-body">Face Value</span>
                <span className="text-white text-body">{fundingPreview.faceValue} USDC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cool-gray text-body">Discount</span>
                <span className="text-warning text-body">-{fundingPreview.discount} USDC</span>
              </div>
              <div className="border-t border-slate-700 pt-3 flex justify-between">
                <span className="text-white text-body font-medium">You Receive</span>
                <span className="text-success text-h3">{fundingPreview.funding} USDC</span>
              </div>
            </div>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-error/10 border border-error/20 rounded-lg">
            <p className="text-error text-body-sm">{error.message}</p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-4 mt-6">
          <Link href="/dashboard/supplier/invoices" className="flex-1">
            <Button variant="secondary" className="w-full">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={isPending || isConfirming}
            className="flex-1"
          >
            {isPending || isConfirming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isPending ? 'Confirm in Wallet' : 'Creating...'}
              </>
            ) : (
              'Create Invoice'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
