interface Env {
  HYRO_INSTALLERS: R2Bucket;
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
}

interface R2Bucket {
  get(key: string): Promise<{ body: ReadableStream; size: number; httpEtag: string } | null>;
}

interface Context {
  request: Request;
  env: Env;
}

const json = (status: number, error: string) => new Response(JSON.stringify({ error }), {
  status,
  headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});

export async function onRequestPost({ request, env }: Context): Promise<Response> {
  let bearer = request.headers.get('authorization');
  let buildId: unknown;
  if (request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
    const form = await request.formData();
    const token = form.get('access_token');
    if (typeof token === 'string') bearer = `Bearer ${token}`;
    buildId = form.get('build_id');
  } else {
    try { buildId = (await request.json() as { build_id?: unknown }).build_id; }
    catch { return json(400, 'invalid_json'); }
  }
  if (!bearer?.startsWith('Bearer ')) return json(401, 'unauthorized');
  if (!env.HYRO_INSTALLERS || !env.PUBLIC_SUPABASE_URL || !env.PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return json(503, 'download_unavailable');
  }

  if (typeof buildId !== 'string' || !/^[0-9a-f-]{36}$/i.test(buildId)) return json(400, 'invalid_build');

  const headers = {
    apikey: env.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    authorization: bearer,
  };
  const auth = await fetch(`${env.PUBLIC_SUPABASE_URL}/auth/v1/user`, { headers });
  if (!auth.ok) return json(401, 'unauthorized');

  const params = new URLSearchParams({
    id: `eq.${buildId}`,
    is_active: 'eq.true',
    select: 'object_key,file_name,size_bytes,sha256',
  });
  const result = await fetch(`${env.PUBLIC_SUPABASE_URL}/rest/v1/product_builds?${params}`, { headers });
  if (!result.ok) return json(503, 'download_unavailable');
  const builds = await result.json() as Array<{
    object_key: string;
    file_name: string;
    size_bytes: number;
    sha256: string;
  }>;
  const build = builds[0];
  if (!build) return json(404, 'not_found');

  const object = await env.HYRO_INSTALLERS.get(build.object_key);
  if (!object || object.size !== build.size_bytes) return json(503, 'download_unavailable');
  return new Response(object.body, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': `attachment; filename="${build.file_name}"`,
      'content-length': String(object.size),
      'etag': object.httpEtag,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    },
  });
}
