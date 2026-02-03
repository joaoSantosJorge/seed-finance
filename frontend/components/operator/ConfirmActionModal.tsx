'use client';

import { useState, useEffect } from 'react';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger';
  requireConfirmText?: boolean;
  confirmPrompt?: string;
  isLoading?: boolean;
}

export function ConfirmActionModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  requireConfirmText = false,
  confirmPrompt = 'CONFIRM',
  isLoading = false,
}: ConfirmActionModalProps) {
  const [inputValue, setInputValue] = useState('');

  // Reset input when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  const canConfirm = !requireConfirmText || inputValue === confirmPrompt;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
    >
      <div className="space-y-4">
        {/* Warning Icon */}
        <div className={`flex items-center gap-3 p-4 rounded-lg ${
          variant === 'danger'
            ? 'bg-red-500/10 border border-red-500/20'
            : 'bg-yellow-500/10 border border-yellow-500/20'
        }`}>
          <AlertTriangle className={`w-6 h-6 ${
            variant === 'danger' ? 'text-red-500' : 'text-yellow-500'
          }`} />
          <p className="text-body text-white">{description}</p>
        </div>

        {/* Confirm Input */}
        {requireConfirmText && (
          <div className="space-y-2">
            <p className="text-body-sm text-cool-gray">
              Type <span className="font-mono text-white">{confirmPrompt}</span> to confirm:
            </p>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmPrompt}
              className="w-full px-4 py-2 bg-[var(--bg-secondary)] border-2 border-[var(--border-color)] text-white font-mono text-sm focus:outline-none focus:border-[var(--text-primary)]"
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  );
}
