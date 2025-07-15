import * as userChatDataService from "@/services/user-chat-data-service";
import { ChatHistory } from "@/types/chat";
import { ProcessedFile } from "@/types/files";
import { useSession } from "next-auth/react";
import { auth } from "../../auth";

/**
 * NextAuth.js v5 User-Based Session Management Service
 *
 * This service provides persistent chat data storage using user-based records
 * instead of session-based storage. Data persists across login/logout cycles
 * and is only cleared when the user explicitly clicks "Clear Chat".
 *
 * Provides storage and retrieval of structured data including:
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

  await userChatDataService.updateUserChatData(session.user.id, data);
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

  return await userChatDataService.getUserChatData(session.user.id);
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
    // Update user data through the session manager
    await updateSessionData(data);

    // Trigger session refresh to get updated data
    await update();
  };

  // Note: For client components, we need to fetch the data separately
  // since it's no longer stored in the session object
  return {
    chatHistory: [], // Will be loaded separately on client
    processedFiles: [], // Will be loaded separately on client
    fileSearchSignature: null, // Will be loaded separately on client
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
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  await userChatDataService.setFileSearchSignature(session.user.id, signature);
}

/**
 * Server Action to reset (delete) the file search signature from database session
 * Replaces resetFileSearchSignature from cookie-based system
 */
export async function resetFileSearchSignature(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  await userChatDataService.resetFileSearchSignature(session.user.id);
}

/**
 * Retrieves the file search signature from database session
 * Replaces getFileSearchSignature from cookie-based system
 */
export async function getFileSearchSignature(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return await userChatDataService.getFileSearchSignature(session.user.id);
}

/**
 * Creates a consistent, unique signature for a list of files.
 * This is used to check if the file set has changed since the last initialization.
 * It combines file name and size for a robust signature and sorts the result
 * to ensure file order doesn't affect the outcome.
 * (Re-exported from user chat data service)
 */
export const createFileSignature = userChatDataService.createFileSignature;

/**
 * Chat history management functions
 */

/**
 * Server Action to add a message to chat history
 */
export async function addChatMessage(message: ChatHistory[0]): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  await userChatDataService.addChatMessage(session.user.id, message);
}

/**
 * Server Action to update entire chat history
 */
export async function setChatHistory(chatHistory: ChatHistory): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  await userChatDataService.setChatHistory(session.user.id, chatHistory);
}

/**
 * Server Action to clear chat history
 */
export async function clearChatHistory(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  await userChatDataService.clearChatHistory(session.user.id);
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
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  await userChatDataService.setProcessedFiles(session.user.id, processedFiles);
}

/**
 * Server Action to add a processed file
 */
export async function addProcessedFile(file: ProcessedFile): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  await userChatDataService.addProcessedFile(session.user.id, file);
}

/**
 * Server Action to remove a processed file by name
 */
export async function removeProcessedFile(fileName: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  await userChatDataService.removeProcessedFile(session.user.id, fileName);
}

/**
 * Server Action to clear processed files
 */
export async function clearProcessedFiles(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  await userChatDataService.clearProcessedFiles(session.user.id);
}

/**
 * Clear all user chat data (used by "Clear Chat" button)
 * This replaces the old cookie-based session clearing
 */
export async function clearAllChatData(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("No authenticated user found");
  }
  await userChatDataService.clearUserChatData(session.user.id);
}
