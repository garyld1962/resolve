"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createDecision } from "@/db/queries/decisions";
import { DEFAULT_PROJECT_SLUG } from "@/lib/default-project";

const TITLE_MAX = 120;

export type RecordFormState = {
  error?: string;
  values?: {
    title: string;
    rationale: string;
    tags: string;
    linearIssueIds: string;
    author: string;
  };
};

function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function recordDecisionAction(
  _prev: RecordFormState,
  formData: FormData,
): Promise<RecordFormState> {
  const title = String(formData.get("title") ?? "").trim();
  const rationale = String(formData.get("rationale") ?? "").trim();
  const tags = String(formData.get("tags") ?? "");
  const linearIssueIds = String(formData.get("linearIssueIds") ?? "");
  const author = String(formData.get("author") ?? "").trim();

  const values = { title, rationale, tags, linearIssueIds, author };

  if (!title) return { error: "Title is required.", values };
  if (title.length > TITLE_MAX)
    return { error: `Title must be ≤ ${TITLE_MAX} characters.`, values };
  if (!rationale) return { error: "Rationale is required.", values };
  if (!author) return { error: "Author is required.", values };

  const { id } = await createDecision({
    projectSlug: DEFAULT_PROJECT_SLUG,
    title,
    rationale,
    tags: splitList(tags),
    linearIssueIds: splitList(linearIssueIds),
    author,
  });

  revalidatePath("/");
  redirect(`/decisions/${id}`);
}
