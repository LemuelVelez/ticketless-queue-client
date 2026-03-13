import * as React from "react"

import type {
    Department,
    ServiceWindow,
    TransactionPurpose,
    TransactionScope,
} from "@/components/admin/departments/types"
import { Badge } from "@/components/ui/badge"

import { DEFAULT_MANAGER, type PurposeBulkDraft } from "@/components/admin/departments/constants"

export function isEnabledFlag(value: boolean | undefined) {
    return value !== false
}

export function statusBadge(enabled: boolean | undefined) {
    const isEnabled = isEnabledFlag(enabled)
    return <Badge variant={isEnabled ? "default" : "secondary"}>{isEnabled ? "Enabled" : "Disabled"}</Badge>
}

export function normalizeManagerKey(value: unknown, fallback = DEFAULT_MANAGER) {
    const normalized = String(value || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_")

    return normalized || fallback
}

export function prettyManager(value?: string) {
    const normalized = String(value || "").trim()
    if (!normalized) return DEFAULT_MANAGER

    return normalized
        .toLowerCase()
        .split("_")
        .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
        .join(" ")
}

export function uniqueScopes(scopes: string[]): TransactionScope[] {
    const seen = new Set<string>()
    const output: TransactionScope[] = []

    for (const raw of scopes) {
        const scope = String(raw || "").trim().toUpperCase()
        if (scope !== "INTERNAL" && scope !== "EXTERNAL") continue
        if (seen.has(scope)) continue

        seen.add(scope)
        output.push(scope as TransactionScope)
    }

    return output
}

export function safeInt(value: string, fallback: number) {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return fallback
    return parsed
}

export function uniqueStringIds(values: Array<string | null | undefined>) {
    const seen = new Set<string>()
    const output: string[] = []

    for (const raw of values) {
        const value = String(raw ?? "").trim()
        if (!value) continue
        if (seen.has(value)) continue

        seen.add(value)
        output.push(value)
    }

    return output
}

export function getWindowDepartmentIds(win?: ServiceWindow | null): string[] {
    if (!win) return []

    return uniqueStringIds([...(Array.isArray(win.departmentIds) ? win.departmentIds : []), win.department ?? ""])
}

export function purposeScopeBadges(scopes: string[]) {
    const normalized = uniqueScopes(scopes || [])
    if (!normalized.length) return <Badge variant="secondary">—</Badge>

    return (
        <div className="flex flex-wrap gap-1">
            {normalized.map((scope) => (
                <Badge key={scope} variant="outline">
                    {scope}
                </Badge>
            ))}
        </div>
    )
}

export function purposeDepartmentText(purpose: TransactionPurpose, deptById: Map<string, Department>) {
    const ids = purpose.departmentIds || []

    if (!ids.length) {
        return <Badge variant="secondary">All departments</Badge>
    }

    const names = ids.map((id) => deptById.get(id)?.name || id)
    const preview = names.slice(0, 2).join(", ")

    return (
        <div className="min-w-0">
            <span className="truncate text-sm text-muted-foreground" title={names.join(", ")}>
                {preview}
                {names.length > 2 ? ` +${names.length - 2}` : ""}
            </span>
        </div>
    )
}

export function toggleScope(
    state: TransactionScope[],
    setter: React.Dispatch<React.SetStateAction<TransactionScope[]>>,
    scope: TransactionScope,
    checked: boolean
) {
    if (checked) {
        if (state.includes(scope)) return
        setter([...state, scope])
        return
    }

    setter(state.filter((value) => value !== scope))
}

export function toggleDepartmentId(
    state: string[],
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    deptId: string,
    checked: boolean
) {
    if (checked) {
        if (state.includes(deptId)) return
        setter([...state, deptId])
        return
    }

    setter(state.filter((value) => value !== deptId))
}

export function toPurposeDraft(purpose: TransactionPurpose): PurposeBulkDraft {
    const scopes = uniqueScopes(purpose.scopes || [])

    return {
        id: purpose.id,
        category: normalizeManagerKey(purpose.category || DEFAULT_MANAGER),
        key: purpose.key ?? "",
        label: purpose.label ?? "",
        scopes: scopes.length ? scopes : ["INTERNAL", "EXTERNAL"],
        applyToAllDepartments: (purpose.departmentIds || []).length === 0,
        departmentIds: [...(purpose.departmentIds || [])],
        enabled: isEnabledFlag(purpose.enabled),
        sortOrder: Number.isFinite(Number(purpose.sortOrder)) ? Number(purpose.sortOrder) : 1000,
    }
}

export function validatePurposeDraft(draft: PurposeBulkDraft): string | null {
    const key = String(draft.key || "").trim()
    const label = String(draft.label || "").trim()
    const scopes = uniqueScopes(draft.scopes || [])
    const sortOrder = Number(draft.sortOrder)
    const departmentIds = draft.applyToAllDepartments ? [] : uniqueStringIds(draft.departmentIds || [])

    if (!key) return "Purpose key is required."
    if (!label) return "Purpose label is required."
    if (!scopes.length) return "Select at least one scope."
    if (!draft.applyToAllDepartments && departmentIds.length === 0) {
        return "Select at least one department or apply to all."
    }
    if (!Number.isFinite(sortOrder)) return "Sort order must be a valid number."

    return null
}