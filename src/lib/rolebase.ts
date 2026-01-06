import type { UserRole } from "@/api/auth"

export const ROLE = {
    ADMIN: "ADMIN",
    STAFF: "STAFF",
} as const

// Allow a single role or any readonly array of roles (works with `as const`)
export type AllowedRoles = UserRole | ReadonlyArray<UserRole>

const ROLE_RANK: Record<UserRole, number> = {
    STAFF: 1,
    ADMIN: 2,
}

function isRoleArray(allowed: AllowedRoles): allowed is ReadonlyArray<UserRole> {
    return Array.isArray(allowed)
}

/**
 * Normalize a role or list of roles into a plain mutable array.
 */
export function normalizeAllowedRoles(allowed: AllowedRoles): UserRole[] {
    return isRoleArray(allowed) ? Array.from(allowed) : [allowed]
}

/**
 * Exact role match check (any-of).
 */
export function hasAllowedRole(current: UserRole, allowed: AllowedRoles): boolean {
    return normalizeAllowedRoles(allowed).includes(current)
}

/**
 * Hierarchy check (at-least). ADMIN is considered >= STAFF.
 */
export function roleAtLeast(current: UserRole, minimum: UserRole): boolean {
    return ROLE_RANK[current] >= ROLE_RANK[minimum]
}

/**
 * Flexible access helper:
 * - anyOf: exact match against allowed roles
 * - min: minimum role rank required (ADMIN >= STAFF)
 */
export function canAccessRole(
    current: UserRole,
    opts: { anyOf?: AllowedRoles; min?: UserRole },
): boolean {
    if (opts.anyOf && hasAllowedRole(current, opts.anyOf)) return true
    if (opts.min && roleAtLeast(current, opts.min)) return true
    return false
}
