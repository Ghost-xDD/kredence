import { getStorachaClient } from "./client.js";

export type UploadResult = {
  cid: string;
  url: string;
};

/**
 * Upload a JSON-serializable object to Storacha.
 * Returns the root CID and a gateway URL for retrieval.
 */
export async function uploadJSON(
  data: unknown,
  filename = "data.json"
): Promise<UploadResult> {
  const client = await getStorachaClient();

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const file = new File([blob], filename);

  const cid = await client.uploadFile(file);
  const cidStr = cid.toString();

  return {
    cid: cidStr,
    url: `https://${cidStr}.ipfs.w3s.link/${filename}`,
  };
}

/**
 * Upload raw text content to Storacha.
 */
export async function uploadText(
  content: string,
  filename: string
): Promise<UploadResult> {
  return uploadJSON(content, filename);
}

/**
 * Retrieve a JSON artifact from Storacha by CID.
 * Uses the w3s.link public gateway.
 */
export async function retrieveJSON<T = unknown>(
  cid: string,
  filename = "data.json"
): Promise<T> {
  const url = `https://${cid}.ipfs.w3s.link/${filename}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Failed to retrieve CID ${cid}: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Check if a CID is retrievable from the public gateway.
 * Useful for verifying persistence before the demo.
 */
export async function verifyCID(cid: string, filename = "data.json"): Promise<boolean> {
  try {
    const url = `https://${cid}.ipfs.w3s.link/${filename}`;
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}
