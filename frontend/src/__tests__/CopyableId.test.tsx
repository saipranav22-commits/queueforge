import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { CopyableId } from '../components/ui/CopyableId';

describe('CopyableId', () => {
  it('truncates UUID to prefix length and renders properly', () => {
    const fullId = '12345678-abcd-ef01-2345-6789abcdef01';
    render(<CopyableId id={fullId} prefixLen={8} />);

    expect(screen.getByText('12345678...')).toBeInTheDocument();
  });

  it('renders full ID when prefixLen is greater than length', () => {
    const shortId = 'abc';
    render(<CopyableId id={shortId} prefixLen={8} />);

    expect(screen.getByText('abc')).toBeInTheDocument();
  });

  it('copies text to clipboard when clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const fullId = 'test-id-12345';
    render(<CopyableId id={fullId} />);

    const button = screen.getByRole('button');
    await fireEvent.click(button);

    expect(writeTextMock).toHaveBeenCalledWith('test-id-12345');
  });
});
