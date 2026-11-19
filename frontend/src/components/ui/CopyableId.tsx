import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import clsx from 'clsx';

interface CopyableIdProps {
  id: string;
  prefixLen?: number;
  suffixLen?: number;
  label?: string;
  className?: string;
}

export const CopyableId: React.FC<CopyableIdProps> = ({
  id,
  prefixLen = 8,
  suffixLen = 0,
  label,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement('textarea');
      textarea.value = id;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayText =
    suffixLen > 0 && id.length > prefixLen + suffixLen
      ? `${id.slice(0, prefixLen)}...${id.slice(-suffixLen)}`
      : prefixLen > 0 && id.length > prefixLen
      ? `${id.slice(0, prefixLen)}...`
      : id;

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={copied ? 'Copied full ID to clipboard!' : `Copy: ${id}`}
      className={clsx(
        'group inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-xs',
        'bg-[var(--qf-surface-interactive)] hover:bg-[var(--qf-surface-hover)] border border-[var(--border-color)]',
        'text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer qf-focus-ring',
        className
      )}
    >
      {label && <span className="text-[var(--text-tertiary)] font-sans">{label}:</span>}
      <span className="font-semibold">{displayText}</span>
      {copied ? (
        <Check className="w-3 h-3 text-[var(--qf-status-success)] flex-shrink-0 animate-in zoom-in-50" />
      ) : (
        <Copy className="w-3 h-3 opacity-40 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
      )}
    </button>
  );
};
