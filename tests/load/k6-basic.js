/* global __ENV */

import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:3001';

export const options = {
  vus: 10,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<800'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/health`);
  check(response, {
    'health returns 200': (res) => res.status === 200,
    'health payload contains status': (res) => {
      try {
        const parsed = JSON.parse(res.body);
        return parsed.status === 'healthy' || parsed.status === 'degraded';
      } catch {
        return false;
      }
    },
  });
  sleep(1);
}
