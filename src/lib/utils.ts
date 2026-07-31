import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse & clamp pagination query params from a URLSearchParams.
 *
 * Raw `parseInt(get("page"))` returns NaN for junk input (`?page=abc`) or a
 * negative/zero value for `?page=-5`, either of which flows into Prisma's
 * `skip: (page - 1) * limit` and throws ("Argument skip: got NaN") or silently
 * misbehaves. Centralising the clamp means every paginated route is safe by
 * construction and a caller can never reintroduce the bug.
 *
 * - page  ≥ 1 (default 1)
 * - limit clamped to 1..maxLimit (default 20, hard-capped so a client can't
 *   request an unbounded page and exhaust the DB).
 */
export function parsePagination(
  searchParams: URLSearchParams,
  { defaultLimit = 20, maxLimit = 100 }: { defaultLimit?: number; maxLimit?: number } = {}
): { page: number; limit: number; skip: number } {
  const rawPage = Number(searchParams.get("page"))
  const rawLimit = Number(searchParams.get("limit"))

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
  const limit =
    Number.isFinite(rawLimit) && rawLimit >= 1
      ? Math.min(Math.floor(rawLimit), maxLimit)
      : defaultLimit

  return { page, limit, skip: (page - 1) * limit }
}
