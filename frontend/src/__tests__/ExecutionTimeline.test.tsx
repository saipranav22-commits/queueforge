import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ExecutionTimeline } from '../components/ui/ExecutionTimeline';
import type { JobDetail } from '../types/job';

describe('ExecutionTimeline', () => {
  const baseJob: JobDetail = {
    jobId: '12345678-abcd-1111-2222-333344445555',
    jobType: 'GENERATE_REPORT',
    status: 'COMPLETED',
    priority: 80,
    attemptCount: 2,
    retryCount: 1,
    maxRetries: 3,
    failureCategory: null,
    lastErrorMessage: null,
    scheduledAt: '2026-11-19T10:00:00Z',
    createdAt: '2026-11-19T10:00:00Z',
    updatedAt: '2026-11-19T10:00:05Z',
    completedAt: '2026-11-19T10:00:05Z',
    idempotencyKey: 'idem-test-123',
    tenantId: 'tenant-alpha',
    lockedBy: null,
    payload: { test: true },
    executionLogs: [
      {
        id: 1,
        jobId: '12345678-abcd-1111-2222-333344445555',
        workerId: 'worker-node-1:qf-worker-1',
        attempt: 1,
        status: 'FAILED',
        executionTimeMs: 150,
        errorMessage: 'Transient downstream timeout',
        createdAt: '2026-11-19T10:00:02Z',
      },
      {
        id: 2,
        jobId: '12345678-abcd-1111-2222-333344445555',
        workerId: 'worker-node-2:qf-worker-1',
        attempt: 2,
        status: 'COMPLETED',
        executionTimeMs: 220,
        errorMessage: null,
        createdAt: '2026-11-19T10:00:05Z',
      },
    ],
  };

  it('renders enqueued event, attempts, workers, durations, and terminal state', () => {
    render(<ExecutionTimeline job={baseJob} />);

    expect(screen.getByText('Job Enqueued')).toBeInTheDocument();
    expect(screen.getByText('Priority: 80')).toBeInTheDocument();
    expect(screen.getByText('Execution Attempt #1')).toBeInTheDocument();
    expect(screen.getByText(/worker-node-1/)).toBeInTheDocument();
    expect(screen.getByText(/150ms/)).toBeInTheDocument();
    expect(screen.getByText('Transient downstream timeout')).toBeInTheDocument();

    expect(screen.getByText('Execution Attempt #2')).toBeInTheDocument();
    expect(screen.getByText(/worker-node-2/)).toBeInTheDocument();
    expect(screen.getByText(/220ms/)).toBeInTheDocument();
    expect(screen.getByText('Terminal Success Committed')).toBeInTheDocument();
  });

  it('renders dead-letter state when job status is DEAD_LETTER', () => {
    const deadLetterJob: JobDetail = {
      ...baseJob,
      status: 'DEAD_LETTER',
      failureCategory: 'PERMANENT',
      lastErrorMessage: 'Fatal database violation',
      executionLogs: [
        {
          id: 1,
          jobId: '12345678-abcd-1111-2222-333344445555',
          workerId: 'worker-node-1',
          attempt: 1,
          status: 'DEAD_LETTER',
          executionTimeMs: 300,
          errorMessage: 'Fatal database violation',
          createdAt: '2026-11-19T10:00:02Z',
        },
      ],
    };

    render(<ExecutionTimeline job={deadLetterJob} />);
    expect(screen.getByText(/Dead-Letter Partition: Max Retries Exhausted/)).toBeInTheDocument();
    expect(screen.getByText('PERMANENT')).toBeInTheDocument();
  });
});
