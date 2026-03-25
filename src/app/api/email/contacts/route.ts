import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import path from "path";

const memoryPath = path.join(process.cwd(), "data", "emails", "memory.json");

export async function GET() {
  try {
    const memory = JSON.parse(readFileSync(memoryPath, "utf-8"));
    return NextResponse.json({ contacts: memory.contacts || {} });
  } catch {
    return NextResponse.json({ contacts: {} });
  }
}
