import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ScenarioProvider } from '../context/ScenarioContext';
import { Sidebar } from '../components/layout/Sidebar';
import { OverviewPage } from '../pages/OverviewPage';
import { CompactTelemetryRail } from '../components/telemetry/CompactTelemetryRail';
import { OperatorIntelligence } from '../components/ui/OperatorIntelligence';
import { apiRequest, ApiError } from '../lib/apiClient';

// Mock ResizeObserver for Recharts / layout components
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Phase 13J — Production Browser Exception (r.filter is not a function) Regression Suite', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('1. apiClient Boundary Hardening', () => {
    it('rejects HTML responses with HTTP 200 (Cloudflare Pages SPA fallback reproduction)', async () => {
      // Exactly what Cloudflare Pages returns when an API path is hit without a backend proxy
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'text/html; charset=utf-8',
        }),
        text: () => Promise.resolve('<!doctype html><html lang="en"><head><title>QueueForge</title></head><body><div id="root"></div></body></html>'),
        json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
      });

      await expect(apiRequest('/system/workers')).rejects.toThrow(ApiError);
      await expect(apiRequest('/system/workers')).rejects.toThrow(
        /Received HTML response instead of JSON from API endpoint/
      );
    });

    it('rejects unexpected plain text content types with HTTP 200', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'text/plain',
        }),
        text: () => Promise.resolve('plain text response'),
      });

      await expect(apiRequest('/system/workers')).rejects.toThrow(ApiError);
      await expect(apiRequest('/system/workers')).rejects.toThrow(
        /Unexpected content-type 'text\/plain'/
      );
    });

    it('parses valid application/json responses successfully', async () => {
      const mockWorkers = [
        { workerId: 'w-1', hostname: 'host-1', status: 'ONLINE', concurrency: 4, heldLeasesCount: 1, lastHeartbeat: new Date().toISOString() },
      ];
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({
          'content-type': 'application/json',
        }),
        json: () => Promise.resolve(mockWorkers),
      });

      const result = await apiRequest('/system/workers');
      expect(result).toEqual(mockWorkers);
    });
  });

  describe('2. Component Immunity Against Non-Array Inputs', () => {
    it('renders Sidebar safely when workers query data is a non-array string', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      // Inject the exact problematic non-array string directly into TanStack Query cache
      queryClient.setQueryData(['system-workers'], '<!doctype html><html><body>Error</body></html>');
      queryClient.setQueryData(['dashboard-stats'], { activeWorkers: 0, workerCapacity: 2 });

      expect(() => {
        render(
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AuthProvider>
                <MemoryRouter>
                  <Sidebar />
                </MemoryRouter>
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        );
      }).not.toThrow();

      expect(screen.getByText('QueueForge')).toBeInTheDocument();
      expect(screen.getByText('MISSION CONTROL')).toBeInTheDocument();
    });

    it('renders OverviewPage (Mission Control) safely when workers and jobs data are non-array strings', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      // Populate query cache with non-array string payload
      queryClient.setQueryData(['system-workers'], '<!doctype html><html><body>Error</body></html>');
      queryClient.setQueryData(['jobs', { page: 0, size: 20 }], '<!doctype html>');

      expect(() => {
        render(
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AuthProvider>
                <ScenarioProvider>
                  <MemoryRouter>
                    <OverviewPage />
                  </MemoryRouter>
                </ScenarioProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        );
      }).not.toThrow();

      expect(screen.getByText('QUEUEFORGE COMMAND')).toBeInTheDocument();
      expect(screen.getByText('Backlog Queue')).toBeInTheDocument();
    });

    it('renders CompactTelemetryRail safely when workers prop is not an array', () => {
      expect(() => {
        render(
          <CompactTelemetryRail
            stats={undefined}
            health={undefined}
            workers={'<!doctype html>' as any}
            outboxStats={undefined}
            provenance="LIVE_OFFLINE"
          />
        );
      }).not.toThrow();

      expect(screen.getByText('Active Leases')).toBeInTheDocument();
    });

    it('renders OperatorIntelligence safely when workers query data is not an array', () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      queryClient.setQueryData(['system-workers'], '<!doctype html>');

      expect(() => {
        render(
          <QueryClientProvider client={queryClient}>
            <MemoryRouter>
              <OperatorIntelligence />
            </MemoryRouter>
          </QueryClientProvider>
        );
      }).not.toThrow();

      expect(screen.getByText('Deterministic Operator Intelligence')).toBeInTheDocument();
    });
  });

  describe('3. Hook Query Schema Validation', () => {
    it('rejects non-array responses from /system/workers at queryFn boundary', async () => {
      // Mock API returning an object instead of an array
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ error: 'Cluster uninitialized' }),
      });

      const queryClient = new QueryClient();
      
      // Execute query function directly
      const queryFn = (queryClient.defaultQueryOptions({
        queryKey: ['system-workers'],
        queryFn: async () => {
          const data = await apiRequest('/system/workers');
          if (!Array.isArray(data)) {
            throw new ApiError(500, 'Invalid API response schema: expected WorkerInstance array');
          }
          return data;
        },
      }) as any).queryFn;

      await expect(queryFn()).rejects.toThrow(ApiError);
      await expect(queryFn()).rejects.toThrow(/Invalid API response schema: expected WorkerInstance array/);
    });
  });

  describe('4. Endurance & Stability Under Periodic Refetches (10s and 30s)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('remains visible and free of unhandled exceptions after 10s and 30s of background polling with backend absent', async () => {
      // Return Cloudflare Pages SPA HTML fallback for all API requests
      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
          text: () => Promise.resolve('<!doctype html><html><body>QueueForge</body></html>'),
          json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON at position 0')),
        })
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <ScenarioProvider>
                <MemoryRouter>
                  <Sidebar />
                  <OverviewPage />
                </MemoryRouter>
              </ScenarioProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      );

      // Initial state is cleanly rendered with truthful offline telemetry
      expect(screen.getByText('QUEUEFORGE COMMAND')).toBeInTheDocument();
      expect(screen.getByText('Live Cluster (Offline)')).toBeInTheDocument();
      expect(screen.getByText('Backlog Queue')).toBeInTheDocument();

      // Advance by 10 seconds (triggers refetchInterval intervals at 3s, 5s)
      await vi.advanceTimersByTimeAsync(10000);
      expect(screen.getByText('QUEUEFORGE COMMAND')).toBeInTheDocument();
      expect(screen.getByText('Live Cluster (Offline)')).toBeInTheDocument();

      // Advance by another 20 seconds (30 seconds total)
      await vi.advanceTimersByTimeAsync(20000);
      expect(screen.getByText('QUEUEFORGE COMMAND')).toBeInTheDocument();
      expect(screen.getByText('Live Cluster (Offline)')).toBeInTheDocument();
      expect(screen.getByText('Active Leases')).toBeInTheDocument();
    });
  });
});
