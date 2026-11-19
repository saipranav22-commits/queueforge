import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { Pagination } from '../components/common/Pagination';

describe('Pagination', () => {
  it('renders index counts and handles page changes', () => {
    const onPageChange = vi.fn();

    render(
      <Pagination
        currentPage={1}
        totalPages={5}
        totalElements={48}
        pageSize={10}
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();

    const prevBtn = screen.getByRole('button', { name: /Previous/i });
    const nextBtn = screen.getByRole('button', { name: /Next/i });

    expect(prevBtn).not.toBeDisabled();
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(0);

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables previous on first page and next on last page', () => {
    const { rerender } = render(
      <Pagination
        currentPage={0}
        totalPages={3}
        totalElements={25}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Previous/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Next/i })).not.toBeDisabled();

    rerender(
      <Pagination
        currentPage={2}
        totalPages={3}
        totalElements={25}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Previous/i })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled();
  });

  it('renders null when totalElements is 0', () => {
    const { container } = render(
      <Pagination
        currentPage={0}
        totalPages={0}
        totalElements={0}
        pageSize={10}
        onPageChange={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });
});
