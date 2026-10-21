import { handleSandbox, type SandboxEnv } from '../../server/paypal-sandbox';

export const onRequest = ({ request, env }: { request: Request; env: SandboxEnv }) => handleSandbox(request, env);
