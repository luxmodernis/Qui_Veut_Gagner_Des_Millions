import { NextRequest, NextResponse } from "next/server";
import { getQuestions } from "@/lib/redis";
import { getCodeB } from "@/lib/auth";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("auth_admin")?.value;
  if (cookie !== getCodeB()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const questions = await getQuestions();
  return NextResponse.json(questions);
}
