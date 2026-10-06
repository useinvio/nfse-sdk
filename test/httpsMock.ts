import https from 'node:https';
import { EventEmitter } from 'node:events';
import type { TestContext } from 'node:test';

export function mockHttps(t: TestContext, body: unknown = {}, status = 200, error?: Error) {
  const calls: Array<{ options: https.RequestOptions; payload: string }> = [];
  t.mock.method(https, 'request', (options: https.RequestOptions, callback: (res: unknown) => void) => {
    const call = { options, payload: '' };
    calls.push(call);
    const req = Object.assign(new EventEmitter(), {
      write(chunk: string) { call.payload += chunk; },
      end() {
        queueMicrotask(() => {
          if (error) { req.emit('error', error); return; }
          const res = Object.assign(new EventEmitter(), { statusCode: status, headers: { 'content-type': 'application/json' } });
          callback(res);
          res.emit('data', Buffer.from(JSON.stringify(body)));
          res.emit('end');
        });
      },
      destroy(reason: Error) { req.emit('error', reason); },
    });
    return req;
  });
  return calls;
}
