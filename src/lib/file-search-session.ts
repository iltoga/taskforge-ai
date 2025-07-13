import { ProcessedFile } from "@/types/files";
import { cookies } from "next/headers";

const SESSION_KEY = "fileSearchSignature";

/**
 * A Server Action to set the file search signature in a secure, httpOnly cookie.
 * @param signature The signature string to store.
 */
export async function setFileSearchSignature(signature: string): Promise<void> {
  (await cookies()).set(SESSION_KEY, signature, {
    httpOnly: true, // Prevents client-side JS from accessing the cookie
    secure: process.env.NODE_ENV === "production", // Only send over HTTPS in production
    path: "/", // Available on all pages
    sameSite: "lax", // Good default for security
  });
}

/**
 * A Server Action to reset (delete) the file search signature cookie.
 */
export async function resetFileSearchSignature(): Promise<void> {
  (await cookies()).delete(SESSION_KEY);
}

/**
 * Retrieves the file search signature from the secure, httpOnly cookie.
 * @returns The signature string or null if not set.
 */
export async function getFileSearchSignature(): Promise<string | null> {
  const cookieStore = await cookies();
  const signature = cookieStore.get(SESSION_KEY);
  return signature ? signature.value : null;
}

/**
 * Creates a consistent, unique signature for a list of files.
 * This is used to check if the file set has changed since the last initialization.
 * It combines file name and size for a robust signature and sorts the result
 * to ensure file order doesn't affect the outcome.
 * @param files The list of processed files.
 * @returns A JSON string representing the unique signature of the file set.
 */
export const createFileSignature = (files: ProcessedFile[]): string => {
  if (!files || files.length === 0) {
    return "[]";
  }
  // Create a composite key for each file from its name and size.
  // Sorting this array ensures that the order of files in the input array
  // does not produce a different signature.
  const fileSignatures = files.map((f) => `${f.name}:${f.size}`).sort();

  return JSON.stringify(fileSignatures);
};
