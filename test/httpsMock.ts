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

export interface MockReply {
  status?: number;
  body?: unknown;
  /** Raw body bytes; overrides `body`. */
  raw?: Buffer;
  contentType?: string;
  error?: Error;
}

/** Replies in order (the last reply repeats) and records every request. */
export function mockHttpsSequence(t: TestContext, replies: MockReply[]) {
  const calls: Array<{ options: https.RequestOptions; payload: string }> = [];
  t.mock.method(https, 'request', (options: https.RequestOptions, callback: (res: unknown) => void) => {
    const call = { options, payload: '' };
    const reply = replies[Math.min(calls.length, replies.length - 1)];
    calls.push(call);
    const req = Object.assign(new EventEmitter(), {
      write(chunk: string) { call.payload += chunk; },
      end() {
        queueMicrotask(() => {
          if (reply.error) { req.emit('error', reply.error); return; }
          const res = Object.assign(new EventEmitter(), {
            statusCode: reply.status ?? 200,
            headers: { 'content-type': reply.contentType ?? 'application/json' },
          });
          callback(res);
          res.emit('data', reply.raw ?? Buffer.from(JSON.stringify(reply.body ?? {})));
          res.emit('end');
        });
      },
      destroy(reason: Error) { req.emit('error', reason); },
    });
    return req;
  });
  return calls;
}
