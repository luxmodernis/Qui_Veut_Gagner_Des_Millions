import { cookies } from "next/headers";

const CODE_A = process.env.CODE_A ?? "1234";
const CODE_B = process.env.CODE_B ?? "5678";

export async function isControlAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("auth_control")?.value === CODE_A;
}

export async function isAdminAuthed(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get("auth_admin")?.value === CODE_B;
}

export function getCodeA() {
  return CODE_A;
}

export function getCodeB() {
  return CODE_B;
}
