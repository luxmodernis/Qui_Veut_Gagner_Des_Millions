import { NextRequest, NextResponse } from "next/server";
import { getQuestions } from "@/lib/redis";
import { getCodeA, getCodeB } from "@/lib/auth";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const admin = req.cookies.get("auth_admin")?.value === getCodeB();
  const host = req.cookies.get("auth_control")?.value === getCodeA();
  if (!admin && !host) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const questions = await getQuestions();
  return NextResponse.json(questions);
}
