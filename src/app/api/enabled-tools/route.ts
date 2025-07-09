import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const configPath = path.join(
      process.cwd(),
      "settings",
      "enabled-tools.json"
    );
    const file = await fs.readFile(configPath, "utf-8");
    const enabledTools = JSON.parse(file);
    return NextResponse.json({ enabledTools });
  } catch {
    return NextResponse.json(
      { error: "Failed to load enabled tools" },
      { status: 500 }
    );
  }
}
