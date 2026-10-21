import { handle, type Env } from './handler.ts';
declare const Deno: { env: { toObject(): Record<string, string> }; serve(handler: (request: Request) => Promise<Response>): void };
Deno.serve(request => handle(request, Deno.env.toObject() as Env));
