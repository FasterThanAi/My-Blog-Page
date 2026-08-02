import crypto from "node:crypto";

/**
 * Minimal implementation of the HTTP Signatures scheme (draft-cavage) used
 * throughout the fediverse (Mastodon, Pleroma, etc.) to authenticate
 * ActivityPub requests. Two directions:
 *  - signRequest: used when WE deliver an activity (e.g. an Accept) to a
 *    remote actor's inbox, so they can verify it really came from us.
 *  - verifyInboundSignature: used when a remote server POSTs to OUR inbox,
 *    so we can verify it really came from the actor it claims to be.
 */

export interface SignedHeaders {
  Host: string;
  Date: string;
  Digest: string;
  "Content-Type": string;
  Signature: string;
}

export function signRequest({
  method,
  targetPath,
  host,
  body,
  keyId,
  privateKeyPem,
}: {
  method: "GET" | "POST";
  targetPath: string;
  host: string;
  body: string;
  keyId: string;
  privateKeyPem: string;
}): SignedHeaders {
  const date = new Date().toUTCString();
  const digest = `SHA-256=${crypto.createHash("sha256").update(body).digest("base64")}`;
  const requestTarget = `${method.toLowerCase()} ${targetPath}`;

  const signingString = [`(request-target): ${requestTarget}`, `host: ${host}`, `date: ${date}`, `digest: ${digest}`].join(
    "\n"
  );

  const signature = crypto.sign("sha256", Buffer.from(signingString), {
    key: privateKeyPem,
    padding: crypto.constants.RSA_PKCS1_PADDING,
  });

  const signatureHeader = [
    `keyId="${keyId}"`,
    `algorithm="rsa-sha256"`,
    `headers="(request-target) host date digest"`,
    `signature="${signature.toString("base64")}"`,
  ].join(",");

  return {
    Host: host,
    Date: date,
    Digest: digest,
    "Content-Type": "application/activity+json",
    Signature: signatureHeader,
  };
}

interface ParsedSignature {
  keyId: string;
  algorithm: string;
  headers: string[];
  signature: string;
}

function parseSignatureHeader(header: string): ParsedSignature | null {
  const parts = Object.fromEntries(
    Array.from(header.matchAll(/(\w+)="([^"]*)"/g)).map((m) => [m[1], m[2]])
  );
  if (!parts.keyId || !parts.signature) return null;
  return {
    keyId: parts.keyId,
    algorithm: parts.algorithm || "rsa-sha256",
    headers: (parts.headers || "date").split(" "),
    signature: parts.signature,
  };
}

/**
 * Verifies an inbound ActivityPub request's HTTP Signature. Fetches the
 * signing actor's public key from their keyId URL, reconstructs the exact
 * signing string from the headers the signature claims to cover, and
 * verifies with the actor's public key. Returns the verified actor id
 * (keyId's actor) on success, or null if verification fails for any
 * reason (missing header, malformed signature, fetch failure, mismatch).
 */
export async function verifyInboundSignature(request: Request, rawBody: string): Promise<string | null> {
  try {
    const signatureHeader = request.headers.get("signature");
    if (!signatureHeader) return null;

    const parsed = parseSignatureHeader(signatureHeader);
    if (!parsed) return null;

    // Fetch the remote actor's public key
    const actorUrl = parsed.keyId.split("#")[0];
    const actorRes = await fetch(actorUrl, { headers: { Accept: "application/activity+json" } });
    if (!actorRes.ok) return null;
    const actor = await actorRes.json();
    const publicKeyPem: string | undefined = actor?.publicKey?.publicKeyPem;
    if (!publicKeyPem) return null;

    const url = new URL(request.url);
    const method = request.method.toLowerCase();

    const signingLines = parsed.headers.map((h) => {
      if (h === "(request-target)") return `(request-target): ${method} ${url.pathname}${url.search}`;
      if (h === "digest") {
        const expectedDigest = `SHA-256=${crypto.createHash("sha256").update(rawBody).digest("base64")}`;
        const providedDigest = request.headers.get("digest");
        if (providedDigest && providedDigest !== expectedDigest) return `digest: MISMATCH`;
        return `digest: ${expectedDigest}`;
      }
      return `${h}: ${request.headers.get(h) || ""}`;
    });

    const signingString = signingLines.join("\n");
    if (signingString.includes("digest: MISMATCH")) return null;

    const verified = crypto.verify(
      "sha256",
      Buffer.from(signingString),
      { key: publicKeyPem, padding: crypto.constants.RSA_PKCS1_PADDING },
      Buffer.from(parsed.signature, "base64")
    );

    return verified ? (actor.id as string) : null;
  } catch {
    return null;
  }
}
