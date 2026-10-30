import { createHash, createHmac } from "crypto";

// Cloudflare R2 (compatible con S3). Sin librerías: solo URLs firmadas
// (SigV4) para que el navegador suba/baje las fotos directo, sin pasar por
// nuestro servidor. Variables de entorno (Vercel):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET

export const isR2Configured = Boolean(
  process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET
);

const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");
const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data).digest();
const enc = (s: string) =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());

export function presignRaw(opts: {
  method: "GET" | "PUT" | "DELETE";
  host: string;
  path: string; // ya con "/" inicial, sin codificar
  accessKey: string;
  secretKey: string;
  region: string;
  expires: number;
  extraQuery?: Record<string, string>;
  now?: Date;
}): string {
  const now = opts.now ?? new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20130524T000000Z
  const dateStamp = amzDate.slice(0, 8);
  const scope = `${dateStamp}/${opts.region}/s3/aws4_request`;

  const query: Record<string, string> = {
    ...(opts.extraQuery ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${opts.accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(opts.expires),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${enc(k)}=${enc(query[k])}`)
    .join("&");
  const canonicalPath = opts.path
    .split("/")
    .map((seg) => enc(seg))
    .join("/");
  const canonicalRequest = [
    opts.method,
    canonicalPath,
    canonicalQuery,
    `host:${opts.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const kDate = hmac("AWS4" + opts.secretKey, dateStamp);
  const kRegion = hmac(kDate, opts.region);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");
  return `https://${opts.host}${canonicalPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function presign(method: "GET" | "PUT" | "DELETE", key: string, expires: number, extraQuery?: Record<string, string>) {
  return presignRaw({
    method,
    host: `${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    path: `/${process.env.R2_BUCKET}/${key}`,
    accessKey: process.env.R2_ACCESS_KEY_ID!,
    secretKey: process.env.R2_SECRET_ACCESS_KEY!,
    region: "auto",
    expires,
    extraQuery,
  });
}

/** URL para que el navegador SUBA un archivo (válida 15 min; los videos pesados piden más tiempo). */
export const r2UploadUrl = (key: string, expires = 900) => presign("PUT", key, expires);

/** URL para VER una foto (válida 1 hora). */
export const r2ViewUrl = (key: string) => presign("GET", key, 3600);

/** URL para DESCARGAR una foto con su nombre (válida 1 hora). */
export const r2DownloadUrl = (key: string, fileName: string) =>
  presign("GET", key, 3600, {
    "response-content-disposition": `attachment; filename="${fileName.replace(/[^\w.\- ]/g, "_")}"`,
  });

/** Borra un archivo del bucket (desde el servidor). Devuelve true si quedó borrado. */
export async function r2Delete(key: string): Promise<boolean> {
  try {
    const res = await fetch(presign("DELETE", key, 60), { method: "DELETE" });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}
