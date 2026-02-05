import React from "react"
import { Navigate, useLocation } from "react-router-dom"
import type { UserRole } from "@/api/auth"
import type { AllowedRoles } from "@/lib/rolebase"
import { ROLE, canAccessRole } from "@/lib/rolebase"
import { useSession } from "@/hooks/use-session"

export type RoleGuardProps = {
    /**
     * Roles that are allowed to access the children.
     * Example: "ADMIN" or ["ADMIN", "STAFF"]
     * Default: ["ADMIN", "STAFF"]
     */
    allow?: AllowedRoles

    /**
     * Optional minimum role rank required.
     * Example: minRole="STAFF" allows STAFF and ADMIN.
     */
    minRole?: UserRole

    /**
     * Where to send unauthenticated users.
     * Default: "/login"
     */
    redirectTo?: string

    /**
     * Where to send authenticated but unauthorized users.
     * Default: "/"
     */
    unauthorizedTo?: string

    /**
     * Rendered while session is resolving.
     * Default: null
     */
    loadingFallback?: React.ReactNode

    children: React.ReactNode
}

/**
 * Route/UI guard that:
 * 1) waits for session load
 * 2) redirects to login if not authenticated
 * 3) redirects if role is not allowed
 */
export function RoleGuard(props: RoleGuardProps) {
    const {
        allow = [ROLE.ADMIN, ROLE.STAFF],
        minRole,
        children,
        redirectTo = "/login",
        unauthorizedTo = "/",
        loadingFallback = null,
    } = props

    const { user, loading } = useSession()
    const location = useLocation()

    if (loading) {
        return React.createElement(React.Fragment, null, loadingFallback)
    }

    if (!user) {
        return React.createElement(Navigate, {
            to: redirectTo,
            replace: true,
            state: { from: location },
        })
    }

    const allowed = canAccessRole(user.role, { anyOf: allow, min: minRole })
    if (!allowed) {
        return React.createElement(Navigate, {
            to: unauthorizedTo,
            replace: true,
        })
    }

    return React.createElement(React.Fragment, null, children)
}
