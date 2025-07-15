/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatHistory } from "@/types/chat";
import { ProcessedFile } from "@/types/files";
import { PrismaClient } from "@prisma/client";

// Create global Prisma instance to avoid multiple connections
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * User Chat Data Service
 *
 * Manages persistent chat data for users including:
 * - Chat history (conversations)
 * - Processed files (uploaded files metadata)
 * - File search signature (cache validation)
 *
 * This data persists across user login/logout cycles and is only
 * cleared when the user explicitly clicks "Clear Chat"
 */

export interface UserChatData {
  chatHistory: ChatHistory;
  processedFiles: ProcessedFile[];
  fileSearchSignature: string | null;
}

/**
 * Get user's persistent chat data
 */
export async function getUserChatData(userId: string): Promise<UserChatData> {
  try {
    const userChatData = await (prisma as any).userChatData.findUnique({
      where: { userId },
    });

    if (!userChatData) {
      // Return empty data if no record exists
      return {
        chatHistory: [],
        processedFiles: [],
        fileSearchSignature: null,
      };
    }

    return {
      chatHistory: (userChatData.chatHistory as unknown as ChatHistory) || [],
      processedFiles:
        (userChatData.processedFiles as unknown as ProcessedFile[]) || [],
      fileSearchSignature: userChatData.fileSearchSignature || null,
    };
  } catch (error) {
    console.error("Error getting user chat data:", error);
    return {
      chatHistory: [],
      processedFiles: [],
      fileSearchSignature: null,
    };
  }
}

/**
 * Update user's chat data (partial update)
 */
export async function updateUserChatData(
  userId: string,
  data: Partial<UserChatData>
): Promise<void> {
  try {
    // Check if record exists
    const existingData = await (prisma as any).userChatData.findUnique({
      where: { userId },
    });

    if (existingData) {
      // Update existing record
      await (prisma as any).userChatData.update({
        where: { userId },
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
    } else {
      // Create new record
      await (prisma as any).userChatData.create({
        data: {
          userId,
          chatHistory: data.chatHistory
            ? JSON.parse(JSON.stringify(data.chatHistory))
            : undefined,
          processedFiles: data.processedFiles
            ? JSON.parse(JSON.stringify(data.processedFiles))
            : undefined,
          fileSearchSignature: data.fileSearchSignature || null,
        },
      });
    }
  } catch (error) {
    console.error("Error updating user chat data:", error);
    throw error;
  }
}

/**
 * Clear all chat data for a user (used by "Clear Chat" button)
 */
export async function clearUserChatData(userId: string): Promise<void> {
  try {
    // Check if record exists
    const existingData = await (prisma as any).userChatData.findUnique({
      where: { userId },
    });

    if (existingData) {
      // Update to clear all data
      await (prisma as any).userChatData.update({
        where: { userId },
        data: {
          chatHistory: null,
          processedFiles: null,
          fileSearchSignature: null,
        },
      });
    }
    // If no record exists, nothing to clear
  } catch (error) {
    console.error("Error clearing user chat data:", error);
    throw error;
  }
}

/**
 * Add a message to user's chat history
 */
export async function addChatMessage(
  userId: string,
  message: ChatHistory[0]
): Promise<void> {
  const currentData = await getUserChatData(userId);
  await updateUserChatData(userId, {
    chatHistory: [...currentData.chatHistory, message],
  });
}

/**
 * Set user's entire chat history
 */
export async function setChatHistory(
  userId: string,
  chatHistory: ChatHistory
): Promise<void> {
  await updateUserChatData(userId, { chatHistory });
}

/**
 * Clear user's chat history only
 */
export async function clearChatHistory(userId: string): Promise<void> {
  await updateUserChatData(userId, { chatHistory: [] });
}

/**
 * Set user's processed files
 */
export async function setProcessedFiles(
  userId: string,
  processedFiles: ProcessedFile[]
): Promise<void> {
  await updateUserChatData(userId, { processedFiles });
}

/**
 * Add a processed file to user's data
 */
export async function addProcessedFile(
  userId: string,
  file: ProcessedFile
): Promise<void> {
  const currentData = await getUserChatData(userId);
  await updateUserChatData(userId, {
    processedFiles: [...currentData.processedFiles, file],
  });
}

/**
 * Remove a processed file by name
 */
export async function removeProcessedFile(
  userId: string,
  fileName: string
): Promise<void> {
  const currentData = await getUserChatData(userId);
  await updateUserChatData(userId, {
    processedFiles: currentData.processedFiles.filter(
      (f) => f.name !== fileName
    ),
  });
}

/**
 * Clear user's processed files only
 */
export async function clearProcessedFiles(userId: string): Promise<void> {
  await updateUserChatData(userId, { processedFiles: [] });
}

/**
 * Set user's file search signature
 */
export async function setFileSearchSignature(
  userId: string,
  signature: string
): Promise<void> {
  await updateUserChatData(userId, { fileSearchSignature: signature });
}

/**
 * Reset (clear) user's file search signature
 */
export async function resetFileSearchSignature(userId: string): Promise<void> {
  await updateUserChatData(userId, { fileSearchSignature: null });
}

/**
 * Get user's file search signature
 */
export async function getFileSearchSignature(
  userId: string
): Promise<string | null> {
  const data = await getUserChatData(userId);
  return data.fileSearchSignature;
}

/**
 * Creates a consistent, unique signature for a list of files.
 * This is used to check if the file set has changed since the last initialization.
 * It combines file name and size for a robust signature and sorts the result
 * to ensure file order doesn't affect the outcome.
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
