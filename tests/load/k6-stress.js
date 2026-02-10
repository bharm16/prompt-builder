/* global __ENV */

import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL || 'http://localhost:3001';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.03'],
    http_req_duration: ['p(95)<1200'],
  },
};

export default function () {
  const response = http.get(`${baseUrl}/health`);
  check(response, {
    'health returns 200': (res) => res.status === 200,
  });
  sleep(0.5);
}
