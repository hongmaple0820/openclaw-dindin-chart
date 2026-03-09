import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get } = vi.hoisted(() => ({
  get: vi.fn()
}));

vi.mock('./index', () => ({
  default: {
    get
  }
}));

import observabilityApi from './observability';

describe('observabilityApi', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('maps each frontend method to the expected backend route', () => {
    const logParams = { level: 'error', limit: 10 };
    const metricParams = { name: 'request_duration_ms', limit: 20 };

    observabilityApi.getDashboard();
    observabilityApi.getLogs(logParams);
    observabilityApi.getMetrics(metricParams);
    observabilityApi.getStats();
    observabilityApi.checkHealth();
    observabilityApi.getSystemInfo();

    expect(get).toHaveBeenNthCalledWith(1, '/observability/dashboard');
    expect(get).toHaveBeenNthCalledWith(2, '/observability/logs', { params: logParams });
    expect(get).toHaveBeenNthCalledWith(3, '/observability/metrics', { params: metricParams });
    expect(get).toHaveBeenNthCalledWith(4, '/observability/stats');
    expect(get).toHaveBeenNthCalledWith(5, '/observability/health');
    expect(get).toHaveBeenNthCalledWith(6, '/observability/system');
  });
});
