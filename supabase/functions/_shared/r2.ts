// Firma de URLs presignadas S3-compatibles para Cloudflare R2 (AWS SigV4, hecha a mano
// con crypto.subtle — sin el SDK de AWS, mismo estilo liviano que _shared/wompi.ts).
// Referencia: docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message));
  return toHex(digest);
}

async function hmac(key: BufferSource, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

function uriEncode(str: string, encodeSlash: boolean): string {
  return Array.from(str)
    .map((ch) => {
      if (/[A-Za-z0-9\-_.~]/.test(ch)) return ch;
      if (ch === "/") return encodeSlash ? "%2F" : "/";
      return Array.from(new TextEncoder().encode(ch))
        .map((b) => "%" + b.toString(16).toUpperCase().padStart(2, "0"))
        .join("");
    })
    .join("");
}

function r2Config() {
  const accountId = Deno.env.get("R2_ACCOUNT_ID");
  const bucket = Deno.env.get("R2_BUCKET");
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID");
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY");
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error("Faltan los secrets de R2 (R2_ACCOUNT_ID / R2_BUCKET / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY)");
  }
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

export async function presignR2Url(opts: { method: "PUT" | "GET"; key: string; expiresSeconds: number }): Promise<string> {
  const { accountId, bucket, accessKeyId, secretAccessKey } = r2Config();
  const host = `${accountId}.r2.cloudflarestorage.com`;
  const region = "auto";
  const service = "s3";

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  const canonicalUri = `/${bucket}/${uriEncode(opts.key, false)}`;

  const queryParams: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${accessKeyId}/${credentialScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(opts.expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const canonicalQueryString = queryParams.map(([k, v]) => `${uriEncode(k, true)}=${uriEncode(v, true)}`).join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const canonicalRequest = [opts.method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, "UNSIGNED-PAYLOAD"].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");

  const kDate = await hmac(new TextEncoder().encode("AWS4" + secretAccessKey), dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}
