import { readFileSync } from "fs";
import { compile } from "handlebars";
import { join } from "path";

/* Exports two helper functions that were previously private to AIService */

export function loadSystemPrompt(): string {
  try {
    const promptPath = join(process.cwd(), "prompts", "taskforge-ai.md");
    const templateContent = readFileSync(promptPath, "utf-8");
    const template = compile(templateContent);

    const timezoneEnv = process.env.TIMEZONE || "Asia/Makassar";
    const timezoneOffset = process.env.TIMEZONE_OFFSET || "+08:00";

    const prompt = template({
      TIMEZONE: timezoneEnv,
      TIMEZONE_OFFSET: timezoneOffset,
      CURRENT_DATE: new Date().toLocaleDateString("en-US", {
        timeZone: timezoneEnv,
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    });

    const formattedDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `Today is ${formattedDate}.\n\n${prompt}`;
  } catch {
    const formattedDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return `Today is ${formattedDate}.\n\nYou are Calendar Assistant, a digital assistant for managing Google Calendar events. Always respond with valid JSON only.`;
  }
}

export function loadAgenticPrompt(): string {
  try {
    const promptPath = join(process.cwd(), "prompts", "agentic-tool-mode.md");
    const prompt = readFileSync(promptPath, "utf-8");

    const formattedDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    return `Today is ${formattedDate}.\n\n${prompt}`;
  } catch {
    const formattedDate = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return `Today is ${formattedDate}.\n\nYou are Calendar Assistant, a digital assistant for managing Google Calendar events with access to tools.`;
  }
}
