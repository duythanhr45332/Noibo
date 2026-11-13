/**
 * Polyfills for Node 16 compatibility
 * - diagnostics_channel.tracingChannel (required by lru-cache v11+ in swagger-jsdoc)
 * - globalThis.ReadableStream (required by @google/genai)
 */
try {
    const dc = require('diagnostics_channel');
    if (dc && !dc.tracingChannel) {
        dc.tracingChannel = () => ({
            hasSubscribers: false,
            subscribe: () => {},
            unsubscribe: () => {},
            traceSync: (fn, ctx, thisArg, ...args) => fn.apply(thisArg, args),
            tracePromise: (fn, ctx, thisArg, ...args) => fn.apply(thisArg, args),
            traceCallback: (fn, position, ctx, thisArg, ...args) => fn.apply(thisArg, args),
        });
    }
} catch (e) {}

if (typeof globalThis.ReadableStream === 'undefined') {
    try {
        const { ReadableStream } = require('stream/web');
        globalThis.ReadableStream = ReadableStream;
    } catch (e) {}
}
