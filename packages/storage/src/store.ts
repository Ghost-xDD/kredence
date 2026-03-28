import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
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

  const blob = new NodeBlob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  // node:buffer File is runtime-compatible with BlobLike; cast to satisfy storacha types
  const file = new NodeFile([blob], filename) as unknown as File;

  const cid = await client.uploadFile(file);
  const cidStr = cid.toString();

  // uploadFile returns a raw block CID (bafkrei…), not a directory CID.
  // Raw block CIDs are served at the root URL with no filename path.
  return {
    cid: cidStr,
    url: `https://${cidStr}.ipfs.storacha.link`,
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
 * Uses the storacha.link public gateway.
 *
 * CID type determines URL shape:
 *   - UnixFS directory CIDs (bafybei…): append filename path to navigate into the dir.
 *   - Raw block CIDs (bafkrei…): access the root directly — no path component.
 *     `client.uploadFile()` returns raw block CIDs, so the filename is irrelevant.
 */
export async function retrieveJSON<T = unknown>(
  cid: string,
  filename = "data.json"
): Promise<T> {
  const isDirectory = cid.startsWith("bafybei");
  const url = isDirectory
    ? `https://${cid}.ipfs.storacha.link/${filename}`
    : `https://${cid}.ipfs.storacha.link`;

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
    const isDirectory = cid.startsWith("bafybei");
    const url = isDirectory
      ? `https://${cid}.ipfs.storacha.link/${filename}`
      : `https://${cid}.ipfs.storacha.link`;
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}
