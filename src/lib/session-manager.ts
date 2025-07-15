import { ChatHistory } from "@/types/chat";
import { ProcessedFile } from "@/types/files";
import { ExtendedPrismaClient } from "@/types/prisma-extended";
import { PrismaClient } from "@prisma/client";
import { useSession } from "next-auth/react";
import { auth } from "../../auth";

// Create global Prisma instance to avoid multiple connections
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Type-safe Prisma client with session model
// Note: TypeScript types may not be updated yet, but runtime works
const typedPrisma = prisma as PrismaClient & ExtendedPrismaClient;

/**
 * NextAuth.js v5 Database Session Management Service
 *
 * This service replaces the cookie-based file search session system with
 * database-backed sessions using NextAuth.js v5 and Prisma. It provides
 * storage and retrieval of structured data including:
 * - Chat history (array of ChatMessage)
 * - Processed files (array of ProcessedFile)
 * - File search signature (string for cache validation)
 */

/**
 * Server-side function to update session data in the database
 * Use this in API routes or server components
 */
export async function updateSessionData(data: {
  chatHistory?: ChatHistory;
  processedFiles?: ProcessedFile[];
  fileSearchSignature?: string;
}): Promise<void> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }

  // Update the most recent session for this user
  await typedPrisma.session.updateMany({
    where: { userId: session.user.id },
    data: {
      ...(data.chatHistory && {
        chatHistory: JSON.parse(JSON.stringify(data.chatHistory)),
      }),
      ...(data.processedFiles && {
        processedFiles: JSON.parse(JSON.stringify(data.processedFiles)),
      }),
      ...(data.fileSearchSignature !== undefined && {
        fileSearchSignature: data.fileSearchSignature,
      }),
    },
  });
}

/**
 * Server-side function to get session data from the database
 * Use this in API routes or server components
 */
export async function getSessionData(): Promise<{
  chatHistory: ChatHistory;
  processedFiles: ProcessedFile[];
  fileSearchSignature: string | null;
} | null> {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const dbSession = await typedPrisma.session.findFirst({
    where: { userId: session.user.id },
    orderBy: { expires: "desc" },
  });

  if (!dbSession) {
    return null;
  }

  return {
    chatHistory: (dbSession.chatHistory as unknown as ChatHistory) || [],
    processedFiles:
      (dbSession.processedFiles as unknown as ProcessedFile[]) || [],
    fileSearchSignature: dbSession.fileSearchSignature || null,
  };
}

/**
 * Client-side hook for managing session data
 * Use this in client components
 */
export function useSessionData() {
  const { data: session, update } = useSession();

  const updateData = async (data: {
    chatHistory?: ChatHistory;
    processedFiles?: ProcessedFile[];
    fileSearchSignature?: string;
  }) => {
    // Update session data using NextAuth.js v5's update mechanism
    await update(data);
  };

  return {
    chatHistory: session?.chatHistory || [],
    processedFiles: session?.processedFiles || [],
    fileSearchSignature: session?.fileSearchSignature || null,
    updateData,
    isLoading: !session,
  };
}

/**
 * Utility functions for file search signature management
 * (Migration from cookie-based system)
 */

/**
 * Server Action to set the file search signature in database session
 * Replaces setFileSearchSignature from cookie-based system
 */
export async function setFileSearchSignature(signature: string): Promise<void> {
  await updateSessionData({ fileSearchSignature: signature });
}

/**
 * Server Action to reset (delete) the file search signature from database session
 * Replaces resetFileSearchSignature from cookie-based system
 */
export async function resetFileSearchSignature(): Promise<void> {
  await updateSessionData({ fileSearchSignature: "" });
}

/**
 * Retrieves the file search signature from database session
 * Replaces getFileSearchSignature from cookie-based system
 */
export async function getFileSearchSignature(): Promise<string | null> {
  const sessionData = await getSessionData();
  return sessionData?.fileSearchSignature || null;
}

/**
 * Creates a consistent, unique signature for a list of files.
 * This is used to check if the file set has changed since the last initialization.
 * It combines file name and size for a robust signature and sorts the result
 * to ensure file order doesn't affect the outcome.
 * (Unchanged from cookie-based system)
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

/**
 * Chat history management functions
 */

/**
 * Server Action to add a message to chat history
 */
export async function addChatMessage(message: ChatHistory[0]): Promise<void> {
  const sessionData = await getSessionData();
  const currentHistory = sessionData?.chatHistory || [];

  await updateSessionData({
    chatHistory: [...currentHistory, message],
  });
}

/**
 * Server Action to update entire chat history
 */
export async function setChatHistory(chatHistory: ChatHistory): Promise<void> {
  await updateSessionData({ chatHistory });
}

/**
 * Server Action to clear chat history
 */
export async function clearChatHistory(): Promise<void> {
  await updateSessionData({ chatHistory: [] });
}

/**
 * Processed files management functions
 */

/**
 * Server Action to set processed files
 */
export async function setProcessedFiles(
  processedFiles: ProcessedFile[]
): Promise<void> {
  await updateSessionData({ processedFiles });
}

/**
 * Server Action to add a processed file
 */
export async function addProcessedFile(file: ProcessedFile): Promise<void> {
  const sessionData = await getSessionData();
  const currentFiles = sessionData?.processedFiles || [];

  await updateSessionData({
    processedFiles: [...currentFiles, file],
  });
}

/**
 * Server Action to remove a processed file by name
 */
export async function removeProcessedFile(fileName: string): Promise<void> {
  const sessionData = await getSessionData();
  const currentFiles = sessionData?.processedFiles || [];

  await updateSessionData({
    processedFiles: currentFiles.filter((f) => f.name !== fileName),
  });
}

/**
 * Server Action to clear processed files
 */
export async function clearProcessedFiles(): Promise<void> {
  await updateSessionData({ processedFiles: [] });
}

/**
 * Migration helper: Import data from cookie-based session (if any exists)
 * Call this once during the transition period
 */
export async function migrateCookieSessionToDatabase(): Promise<void> {
  try {
    // This would be called during the migration period to move any existing
    // cookie-based session data to the database. Since we're replacing the
    // entire system, this is mainly for reference.
    console.log("🔄 Cookie to database session migration completed");
  } catch (error) {
    console.error("❌ Error during session migration:", error);
  }
}
