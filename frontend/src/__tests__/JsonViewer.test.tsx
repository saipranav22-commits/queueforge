import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { JsonViewer } from '../components/common/JsonViewer';

describe('JsonViewer', () => {
  it('renders JSON payload formatted and copies to clipboard', () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const sample = JSON.stringify({ orderId: '12345', amount: 99.95 });

    render(<JsonViewer jsonString={sample} title="Test Payload" />);

    expect(screen.getByText('Test Payload')).toBeInTheDocument();
    expect(screen.getByText(/"orderId": "12345"/)).toBeInTheDocument();
    expect(screen.getByText(/"amount": 99.95/)).toBeInTheDocument();

    const copyBtn = screen.getByRole('button', { name: /Copy/i });
    expect(copyBtn).toBeInTheDocument();
    fireEvent.click(copyBtn);
    expect(screen.getByText('Copied')).toBeInTheDocument();
    expect(writeTextMock).toHaveBeenCalled();
  });

  it('renders fallback when payload is empty or null', () => {
    render(<JsonViewer jsonString={null} />);
    expect(screen.getByText('// Empty payload')).toBeInTheDocument();
  });
});
