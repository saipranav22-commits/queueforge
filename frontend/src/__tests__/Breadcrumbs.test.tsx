import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';

describe('Breadcrumbs', () => {
  it('renders zone and subsystem for overview', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Breadcrumbs />
      </MemoryRouter>
    );

    expect(screen.getByText('MISSION CONTROL')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
  });

  it('renders zone and subsystem for workloads route', () => {
    render(
      <MemoryRouter initialEntries={['/jobs']}>
        <Breadcrumbs />
      </MemoryRouter>
    );

    expect(screen.getByText('WORKLOADS')).toBeInTheDocument();
    expect(screen.getByText('Job Explorer')).toBeInTheDocument();
  });

  it('renders zone and subsystem for reliability route', () => {
    render(
      <MemoryRouter initialEntries={['/dlq']}>
        <Breadcrumbs />
      </MemoryRouter>
    );

    expect(screen.getByText('RELIABILITY')).toBeInTheDocument();
    expect(screen.getByText('Dead-Letter Queue')).toBeInTheDocument();
  });
});
