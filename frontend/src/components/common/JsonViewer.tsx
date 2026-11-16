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
      navigator.clipboard.writeText(formatted);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/80 bg-slate-900/50">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800/60 hover:bg-slate-800 rounded-md transition"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="p-4 overflow-x-auto max-h-96">
        <pre className="text-xs font-mono text-slate-300 leading-relaxed selection:bg-blue-600/30">
          {formatted || '// Empty payload'}
        </pre>
      </div>
    </div>
  );
};
