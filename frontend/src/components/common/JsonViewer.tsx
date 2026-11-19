import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JsonViewerProps {
  jsonString: string | null | undefined;
  title?: string;
  collapsed?: boolean;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ jsonString, title = 'Payload' }) => {
  const [copied, setCopied] = useState(false);

  let formatted = '';
  try {
    if (jsonString) {
      const parsed = JSON.parse(jsonString);
      formatted = JSON.stringify(parsed, null, 2);
    }
  } catch {
    formatted = jsonString || '';
  }

  const handleCopy = () => {
    if (formatted) {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(formatted);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-deep)] overflow-hidden transition-colors">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] font-mono">
          {title}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-deep)] hover:bg-[var(--color-bg-interactive)] border border-[var(--color-border-subtle)] rounded-md transition font-mono"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto max-h-96">
        <pre className="text-xs font-mono text-[var(--color-text-primary)] leading-relaxed selection:bg-[var(--color-amethyst-bg)]">
          {formatted || '// Empty payload'}
        </pre>
      </div>
    </div>
  );
};
