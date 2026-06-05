"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { Translation } from "@/types";

const VALID: Translation[] = ["NIV", "NLT", "MSG"];

export async function setTranslation(translation: Translation): Promise<void> {
  if (!VALID.includes(translation)) return;
  cookies().set("translation", translation, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
  revalidatePath("/");
}
