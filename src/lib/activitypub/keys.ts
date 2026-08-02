import crypto from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Fetches (or lazily generates) the RSA keypair used to sign this author's
 * outgoing ActivityPub activities. Keys are generated on first use and
 * stored in activitypub_keys, a table with no client-facing RLS policies —
 * only reachable via the service-role client.
 */
export async function getOrCreateActorKeys(profileId: string): Promise<{ privateKeyPem: string; publicKeyPem: string }> {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("activitypub_keys")
    .select("private_key_pem, public_key_pem")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing) {
    return { privateKeyPem: existing.private_key_pem, publicKeyPem: existing.public_key_pem };
  }

  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  const { error } = await supabase.from("activitypub_keys").insert({
    profile_id: profileId,
    private_key_pem: privateKey,
    public_key_pem: publicKey,
  });

  // Ignore unique-violation races (another request generated it first) and
  // just re-read below; surface any other error.
  if (error && error.code !== "23505") {
    throw new Error(`Failed to store ActivityPub keys: ${error.message}`);
  }

  if (error?.code === "23505") {
    const { data: raceWinner } = await supabase
      .from("activitypub_keys")
      .select("private_key_pem, public_key_pem")
      .eq("profile_id", profileId)
      .single();
    if (raceWinner) return { privateKeyPem: raceWinner.private_key_pem, publicKeyPem: raceWinner.public_key_pem };
  }

  return { privateKeyPem: privateKey, publicKeyPem: publicKey };
}

/** Public key only — safe to call without the service client for read-heavy Actor document requests. */
export async function getActorPublicKey(profileId: string): Promise<string> {
  const { publicKeyPem } = await getOrCreateActorKeys(profileId);
  return publicKeyPem;
}
