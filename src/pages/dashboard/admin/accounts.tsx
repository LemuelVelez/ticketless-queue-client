/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
  MoreHorizontal,
  Plus,
  RefreshCw,
  Shield,
  User,
  UserCog,
  GraduationCap,
  Users,
  Eye,
  EyeOff,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { toApiPath } from "@/api/api"
import { useSession } from "@/hooks/use-session"
import { api, ApiError } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AccountRole = "STAFF" | "ADMIN" | "STUDENT" | "ALUMNI_VISITOR" | "GUEST"
type StaffAccountRole = "STAFF" | "ADMIN"
type EditableRole = AccountRole
type AccountSource = "staff" | "participant"

type AccountUser = {
  id?: string
  _id?: string
  name: string
  email: string
  role?: AccountRole | string
  type?: string
  active: boolean
  readOnly?: boolean
  source?: AccountSource
}

type AccountRow = AccountUser & {
  role: AccountRole
}

type AccountListResponse = {
  staff: AccountUser[]
  participants: AccountUser[]
  errors: string[]
}

const ROLE_ORDER: AccountRole[] = ["ADMIN", "STAFF", "STUDENT", "ALUMNI_VISITOR", "GUEST"]

function userId(u: AccountUser) {
  return u._id ?? u.id ?? ""
}

function encodeAccountId(value: string) {
  return encodeURIComponent(String(value ?? "").trim())
}

const ACCOUNT_API_PATHS = {
  list: toApiPath("/admin/staff"),
  participants: toApiPath("/admin/participants"),
  create: toApiPath("/admin/staff"),
  byId: (id: string) => toApiPath(`/admin/staff/${encodeAccountId(id)}`),
  resendLoginCredentialsCandidates: (id: string) => [
    toApiPath(`/admin/staff/${encodeAccountId(id)}/resend-login-credentials`),
    toApiPath(`/admin/staff/${encodeAccountId(id)}/resend-credentials`),
    toApiPath(`/admin/staff/${encodeAccountId(id)}/resend-login`),
  ],
} as const

const accountApi = {
  async listAccounts(): Promise<AccountListResponse> {
    const [staffResult, participantResult] = await Promise.allSettled([
      api.getData<AccountUser[]>(ACCOUNT_API_PATHS.list, {
        auth: "staff",
        params: { includeInactive: true },
      }),
      api.getData<AccountUser[]>(ACCOUNT_API_PATHS.participants, {
        auth: "staff",
        params: { includeInactive: true },
      }),
    ])

    const errors: string[] = []

    const staff =
      staffResult.status === "fulfilled"
        ? Array.isArray(staffResult.value)
          ? staffResult.value
          : []
        : []

    const participants =
      participantResult.status === "fulfilled"
        ? Array.isArray(participantResult.value)
          ? participantResult.value
          : []
        : []

    if (staffResult.status === "rejected") {
      errors.push(
        staffResult.reason instanceof Error ? staffResult.reason.message : "Failed to load staff accounts."
      )
    }

    if (participantResult.status === "rejected") {
      errors.push(
        participantResult.reason instanceof Error ? participantResult.reason.message : "Failed to load participant accounts."
      )
    }

    return { staff, participants, errors }
  },

  createAccount(payload: Record<string, unknown>) {
    return api.postData<Record<string, unknown>>(ACCOUNT_API_PATHS.create, payload, {
      auth: "staff",
    })
  },

  async updateAccount(id: string, payload: Record<string, unknown>) {
    const path = ACCOUNT_API_PATHS.byId(id)

    try {
      return await api.patchData<Record<string, unknown>>(path, payload, {
        auth: "staff",
      })
    } catch (e) {
      if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
        return api.putData<Record<string, unknown>>(path, payload, {
          auth: "staff",
        })
      }

      throw e
    }
  },

  async resendLoginCredentials(id: string) {
    let lastError: unknown = null

    for (const path of ACCOUNT_API_PATHS.resendLoginCredentialsCandidates(id)) {
      try {
        return await api.postData<Record<string, unknown>>(path, undefined, {
          auth: "staff",
        })
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
          lastError = e
          continue
        }

        throw e
      }
    }

    if (lastError instanceof Error) throw lastError
    throw new Error("Failed to resend login credentials.")
  },

  deleteAccount(id: string) {
    return api.deleteData<Record<string, unknown>>(ACCOUNT_API_PATHS.byId(id), {
      auth: "staff",
    })
  },
}

function normalizeRole(role: unknown): AccountRole {
  const r = String(role ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s/-]+/g, "_")

  if (r === "ADMIN") return "ADMIN"
  if (r === "STAFF") return "STAFF"
  if (r === "STUDENT") return "STUDENT"
  if (r === "ALUMNI_VISITOR" || r === "ALUMNI" || r === "VISITOR") return "ALUMNI_VISITOR"
  if (r === "GUEST") return "GUEST"

  return "GUEST"
}

function isStaffAccountRole(role: AccountRole): role is StaffAccountRole {
  return role === "ADMIN" || role === "STAFF"
}

function getEditableRoleOptions(role: AccountRole): EditableRole[] {
  if (isStaffAccountRole(role)) {
    return ["STAFF", "ADMIN"]
  }
  return ["STUDENT", "ALUMNI_VISITOR", "GUEST"]
}

function isReadOnlyAccount(u: Pick<AccountUser, "readOnly"> | null | undefined) {
  return Boolean(u?.readOnly)
}

function roleOptionLabel(role: EditableRole) {
  return role === "ALUMNI_VISITOR" ? "ALUMNI/VISITOR" : role
}

function roleBadge(role: AccountRole) {
  if (role === "ADMIN") {
    return (
      <Badge className="gap-1" variant="default">
        <Shield className="h-4 w-4" />
        ADMIN
      </Badge>
    )
  }

  if (role === "STAFF") {
    return (
      <Badge variant="secondary" className="gap-1">
        <UserCog className="h-4 w-4" />
        STAFF
      </Badge>
    )
  }

  if (role === "STUDENT") {
    return (
      <Badge variant="outline" className="gap-1">
        <GraduationCap className="h-4 w-4" />
        STUDENT
      </Badge>
    )
  }

  if (role === "ALUMNI_VISITOR") {
    return (
      <Badge variant="outline" className="gap-1">
        <Users className="h-4 w-4" />
        ALUMNI/VISITOR
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className="gap-1">
      <User className="h-4 w-4" />
      GUEST
    </Badge>
  )
}

function generateTempPassword(length = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const safeLen = Math.max(8, Math.min(32, Math.floor(length)))
  try {
    const buf = new Uint32Array(safeLen)
    window.crypto.getRandomValues(buf)
    let out = ""
    for (let i = 0; i < safeLen; i++) out += chars[buf[i] % chars.length]
    return out
  } catch {
    let out = ""
    for (let i = 0; i < safeLen; i++) out += chars[Math.floor(Math.random() * chars.length)]
    return out
  }
}

function looksLikeEmail(v: unknown) {
  const s = String(v ?? "").trim()
  return s.includes("@") && s.includes(".") && !s.toLowerCase().startsWith("mobile:")
}

export default function AdminAccountsPage() {
  const location = useLocation()
  const { user: sessionUser } = useSession()

  const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
    if (!sessionUser) return undefined
    return {
      name: sessionUser.name ?? "Admin",
      email: sessionUser.email ?? "",
    }
  }, [sessionUser])

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const [users, setUsers] = React.useState<AccountUser[]>([])

  const [q, setQ] = React.useState("")
  const [tab, setTab] = React.useState<"all" | "active" | "inactive">("all")

  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [resendOpen, setResendOpen] = React.useState(false)

  const [selected, setSelected] = React.useState<AccountUser | null>(null)

  const [cName, setCName] = React.useState("")
  const [cEmail, setCEmail] = React.useState("")
  const [cPassword, setCPassword] = React.useState("")
  const [cShowPassword, setCShowPassword] = React.useState(false)
  const [cRole, setCRole] = React.useState<StaffAccountRole>("STAFF")
  const [cSendCredentials, setCSendCredentials] = React.useState(true)

  const [eName, setEName] = React.useState("")
  const [eRole, setERole] = React.useState<EditableRole>("STAFF")
  const [eActive, setEActive] = React.useState(true)

  const [newPassword, setNewPassword] = React.useState("")

  const editRoleOptions = React.useMemo<EditableRole[]>(() => {
    const sourceRole = selected ? normalizeRole(selected.role ?? selected.type) : eRole
    return getEditableRoleOptions(sourceRole)
  }, [selected, eRole])

  const fetchAll = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await accountApi.listAccounts()

      const normalizedStaff = (res.staff ?? []).map((u) => ({
        ...u,
        name: typeof u?.name === "string" && u.name.trim() ? u.name : "—",
        email: typeof u?.email === "string" ? u.email : "",
        active: typeof u?.active === "boolean" ? u.active : true,
        role: normalizeRole(u?.role ?? u?.type),
        readOnly: Boolean(u?.readOnly),
        source: "staff" as const,
      }))

      const normalizedParticipants = (res.participants ?? []).map((u) => ({
        ...u,
        name: typeof u?.name === "string" && u.name.trim() ? u.name : "—",
        email: typeof u?.email === "string" ? u.email : "",
        active: typeof u?.active === "boolean" ? u.active : true,
        role: normalizeRole(u?.role ?? u?.type),
        readOnly: true,
        source: "participant" as const,
      }))

      const merged = [...normalizedStaff, ...normalizedParticipants]
      const deduped = new Map<string, AccountUser>()

      for (const entry of merged) {
        const idKey = userId(entry)
        const emailKey = String(entry.email ?? "").trim().toLowerCase()
        const nameKey = String(entry.name ?? "").trim().toLowerCase()
        const key = idKey || emailKey || `${entry.role}:${nameKey}`

        if (!key) continue

        const existing = deduped.get(key)
        if (!existing) {
          deduped.set(key, entry)
          continue
        }

        if (entry.source === "staff" && existing.source !== "staff") {
          deduped.set(key, entry)
        }
      }

      setUsers(Array.from(deduped.values()))

      if (res.errors.length > 0) {
        if (deduped.size > 0) {
          toast.error("Some accounts could not be loaded.", {
            description: res.errors.join(" "),
          })
        } else {
          throw new Error(res.errors.join(" "))
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load accounts."
      toast.error(msg)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const rows = React.useMemo<AccountRow[]>(() => {
    return (users ?? []).map((u) => {
      const role = normalizeRole(u.role ?? u.type)
      return {
        ...u,
        role,
      }
    })
  }, [users])

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase()

    return rows
      .filter((u) => {
        if (tab === "active" && !u.active) return false
        if (tab === "inactive" && u.active) return false

        if (!query) return true
        const hay = `${u.name} ${u.email} ${u.role}`.toLowerCase()
        return hay.includes(query)
      })
      .sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1))
  }, [rows, q, tab])

  function openEdit(u: AccountRow) {
    if (isReadOnlyAccount(u)) {
      toast.message("Editing is not available for this account type from this page.")
      return
    }

    setSelected(u)
    setEName(u.name ?? "")
    setEActive(!!u.active)
    setERole(u.role)
    setEditOpen(true)
  }

  function openResend(u: AccountUser) {
    const role = normalizeRole(u.role ?? u.type)
    const email = String(u.email ?? "").trim()

    if (isReadOnlyAccount(u)) {
      toast.message("Resend credentials is not available for this account type from this page.")
      return
    }

    if (!isStaffAccountRole(role)) {
      toast.message("Resend credentials is only available for STAFF/ADMIN email accounts.")
      return
    }

    if (!looksLikeEmail(email)) {
      toast.error("This account has no valid email address.")
      return
    }

    setSelected(u)
    setResendOpen(true)
  }

  function openReset(u: AccountUser) {
    if (isReadOnlyAccount(u)) {
      toast.message("Credential reset is not available for this account type from this page.")
      return
    }

    setSelected(u)
    setNewPassword("")
    setResetOpen(true)
  }

  function openDelete(u: AccountUser) {
    if (isReadOnlyAccount(u)) {
      toast.message("Delete is not available for this account type from this page.")
      return
    }

    setSelected(u)
    setDeleteOpen(true)
  }

  function resetCreateForm() {
    setCName("")
    setCEmail("")
    setCPassword("")
    setCShowPassword(false)
    setCRole("STAFF")
    setCSendCredentials(true)
  }

  async function handleCreate() {
    const name = cName.trim()
    const email = cEmail.trim()
    const password = cPassword.trim()

    if (!name) return toast.error("Name is required.")
    if (!email) return toast.error("Email is required.")

    if (!cSendCredentials && !password) {
      return toast.error("Password is required when email credentials is disabled.")
    }

    const payload: any = {
      name,
      email,
      role: cRole,
      sendCredentials: cSendCredentials,
    }

    if (password) payload.password = password

    setSaving(true)
    try {
      const res = await accountApi.createAccount(payload)

      const creds = (res as any)?.credentials
      const attempted = Boolean(creds?.attempted)
      const sent = Boolean(creds?.sent)
      const err = typeof creds?.error === "string" ? creds.error : null

      if (attempted && sent) {
        toast.success("Account created.", { description: `Login credentials were emailed to ${email}.` })
      } else if (attempted && !sent) {
        toast.error("Account created, but email failed to send.", {
          description: err ? err : "Please verify email configuration (GMAIL_USER / GMAIL_APP_PASSWORD).",
        })
      } else {
        toast.success("Account created.", { description: "Credentials email was not sent." })
      }

      setCreateOpen(false)
      resetCreateForm()
      await fetchAll()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create account."
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleResendCredentials() {
    if (!selected) return

    const id = userId(selected)
    if (!id) return toast.error("Invalid user id.")

    const role = normalizeRole(selected.role ?? selected.type)
    const email = String(selected.email ?? "").trim()

    if (!isStaffAccountRole(role)) {
      toast.message("Resend credentials is only available for STAFF/ADMIN email accounts.")
      return
    }

    if (!looksLikeEmail(email)) {
      toast.error("This account has no valid email address.")
      return
    }

    const t = (toast as any).loading ? (toast as any).loading("Resending login credentials…") : null

    setSaving(true)
    try {
      await accountApi.resendLoginCredentials(id)
      if (t) (toast as any).dismiss?.(t)
      toast.success("Login credentials resent.", { description: `A new temporary password was emailed to ${email}.` })
      setResendOpen(false)
      setSelected(null)
    } catch (e) {
      if (t) (toast as any).dismiss?.(t)
      const msg = e instanceof Error ? e.message : "Failed to resend login credentials."
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (!selected) return
    if (isReadOnlyAccount(selected)) {
      return toast.message("Editing is not available for this account type from this page.")
    }

    const id = userId(selected)
    if (!id) return toast.error("Invalid user id.")

    const name = eName.trim()
    if (!name) return toast.error("Name is required.")

    const payload: Record<string, unknown> = {
      name,
      active: eActive,
      role: eRole,
    }

    setSaving(true)
    try {
      await accountApi.updateAccount(id, payload)
      toast.success("Account updated.")
      setEditOpen(false)
      setSelected(null)
      await fetchAll()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update account."
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword() {
    if (!selected) return
    if (isReadOnlyAccount(selected)) {
      return toast.message("Credential reset is not available for this account type from this page.")
    }

    const id = userId(selected)
    if (!id) return toast.error("Invalid user id.")
    if (!newPassword) return toast.error("New credential is required.")

    setSaving(true)
    try {
      await accountApi.updateAccount(id, { password: newPassword })
      toast.success("Credential updated.")
      setResetOpen(false)
      setSelected(null)
      setNewPassword("")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update credential."
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount() {
    if (!selected) return
    if (isReadOnlyAccount(selected)) {
      return toast.message("Delete is not available for this account type from this page.")
    }

    const id = userId(selected)
    if (!id) return toast.error("Invalid user id.")

    setSaving(true)
    try {
      try {
        await accountApi.deleteAccount(id)
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 405 || e.status === 501)) {
          await accountApi.updateAccount(id, { active: false })
        } else {
          throw e
        }
      }

      toast.success("Account removed.")
      setDeleteOpen(false)
      setSelected(null)
      await fetchAll()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete account."
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const stats = React.useMemo(() => {
    const total = rows.length
    const active = rows.filter((s) => s.active).length
    const inactive = total - active

    const byRole = rows.reduce(
      (acc, row) => {
        acc[row.role] += 1
        return acc
      },
      {
        ADMIN: 0,
        STAFF: 0,
        STUDENT: 0,
        ALUMNI_VISITOR: 0,
        GUEST: 0,
      } as Record<AccountRole, number>,
    )

    return { total, active, inactive, byRole }
  }, [rows])

  return (
    <DashboardLayout title="Accounts" navItems={ADMIN_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
      <div className="grid w-full min-w-0 grid-cols-1 gap-6">
        <Card className="min-w-0">
          <CardHeader className="gap-2">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <CardTitle>Account Management</CardTitle>
                <CardDescription>Displaying all users (ADMIN, STAFF, STUDENT, ALUMNI/VISITOR, and GUEST).</CardDescription>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  variant="outline"
                  onClick={() => void fetchAll()}
                  disabled={loading || saving}
                  className="w-full gap-2 sm:w-auto"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </Button>

                <Button
                  onClick={() => {
                    resetCreateForm()
                    setCreateOpen(true)
                  }}
                  className="w-full gap-2 sm:w-auto"
                  disabled={saving}
                >
                  <Plus className="h-4 w-4" />
                  New user
                </Button>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, email, or role…"
                  className="w-full min-w-0 sm:w-80"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">Total: {stats.total}</Badge>
                <Badge variant="default">Active: {stats.active}</Badge>
                <Badge variant="secondary">Inactive: {stats.inactive}</Badge>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ROLE_ORDER.map((r) => (
                <Badge key={r} variant="outline" className="gap-1">
                  {r === "ALUMNI_VISITOR" ? "ALUMNI/VISITOR" : r}: {stats.byRole[r]}
                </Badge>
              ))}
            </div>
          </CardHeader>

          <CardContent className="min-w-0">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="grid w-full grid-cols-3 md:w-90">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-4">
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden md:table-cell">Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Status</TableHead>
                          <TableHead className="w-14" />
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        {filtered.map((u) => {
                          const id = userId(u) || `${u.email}-${u.name}`
                          const role = normalizeRole(u.role)
                          const emailDisplay = u.email?.trim() ? u.email : "—"
                          const readOnly = isReadOnlyAccount(u)
                          const canEdit = !readOnly
                          const canResend = !readOnly && isStaffAccountRole(role) && looksLikeEmail(emailDisplay)

                          return (
                            <TableRow key={id}>
                              <TableCell className="font-medium">
                                <div className="flex min-w-0 flex-col">
                                  <span className="truncate">{u.name}</span>
                                  <span className="truncate text-xs text-muted-foreground md:hidden">{emailDisplay}</span>
                                </div>
                              </TableCell>

                              <TableCell className="hidden md:table-cell">
                                <span className="text-muted-foreground">{emailDisplay}</span>
                              </TableCell>

                              <TableCell>{roleBadge(role)}</TableCell>

                              <TableCell className="text-right">
                                <Badge variant={u.active ? "default" : "secondary"}>{u.active ? "Active" : "Inactive"}</Badge>
                              </TableCell>

                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="Row actions">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>

                                  <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />

                                    {canEdit ? (
                                      <DropdownMenuItem onClick={() => openEdit(u)} className="cursor-pointer">
                                        Edit role/account
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem disabled>Edit unavailable</DropdownMenuItem>
                                    )}

                                    {canResend ? (
                                      <DropdownMenuItem onClick={() => openResend(u)} className="cursor-pointer">
                                        Resend login credentials
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem disabled>Resend credentials unavailable</DropdownMenuItem>
                                    )}

                                    {readOnly ? (
                                      <DropdownMenuItem disabled>Reset credential unavailable</DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => openReset(u)} className="cursor-pointer">
                                        Reset credential
                                      </DropdownMenuItem>
                                    )}

                                    <DropdownMenuSeparator />

                                    {readOnly ? (
                                      <DropdownMenuItem disabled>Delete unavailable</DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem
                                        onClick={() => openDelete(u)}
                                        className="cursor-pointer text-destructive focus:text-destructive"
                                      >
                                        Delete account
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          )
                        })}

                        {filtered.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                              No accounts match your filters.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg flex max-h-screen flex-col overflow-hidden sm:max-h-none sm:overflow-visible">
          <DialogHeader>
            <DialogTitle>Create new user</DialogTitle>
          </DialogHeader>

          <div className="grid flex-1 gap-4 overflow-y-auto pr-1 sm:overflow-visible sm:pr-0">
            <div className="grid gap-2">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Full name" />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
                placeholder="name@school.edu"
                type="email"
                autoComplete="email"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="grid gap-0.5">
                <div className="text-sm font-medium">Email login credentials</div>
                <div className="text-xs text-muted-foreground">
                  Send the user their email + temporary password via email. (Recommended)
                </div>
              </div>
              <Switch checked={cSendCredentials} onCheckedChange={setCSendCredentials} />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="c-password">Temporary password</Label>
                {cSendCredentials ? (
                  <Badge variant="secondary" className="font-normal">
                    Email will include this password
                  </Badge>
                ) : (
                  <Badge variant="outline" className="font-normal">
                    Email sending disabled
                  </Badge>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  id="c-password"
                  value={cPassword}
                  onChange={(e) => setCPassword(e.target.value)}
                  placeholder={cSendCredentials ? "Leave blank to auto-generate" : "Set an initial password"}
                  type={cShowPassword ? "text" : "password"}
                  autoComplete="new-password"
                />

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCPassword(generateTempPassword(12))}
                  disabled={saving}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCShowPassword((v) => !v)}
                  disabled={saving}
                  aria-label={cShowPassword ? "Hide password" : "Show password"}
                >
                  {cShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              {cSendCredentials ? (
                <p className="text-xs text-muted-foreground">
                  Tip: If you leave it blank, the system will auto-generate a secure temporary password and email it to the user.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Since email sending is disabled, you must set a password manually and share it securely to the user.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={cRole} onValueChange={(v) => setCRole(v as StaffAccountRole)}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="STAFF">STAFF</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false)
                resetCreateForm()
              }}
              disabled={saving}
              className="w-full sm:w-auto sm:mr-2"
            >
              Cancel
            </Button>

            <Button type="button" onClick={() => void handleCreate()} disabled={saving} className="w-full sm:w-auto">
              {saving ? "Creating…" : "Create user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="e-name">Name</Label>
              <Input id="e-name" value={eName} onChange={(e) => setEName(e.target.value)} />
            </div>

            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={selected?.email ?? ""} readOnly />
            </div>

            <div className="grid gap-2">
              <Label>Role</Label>
              <Select value={eRole} onValueChange={(v) => setERole(v as EditableRole)}>
                <SelectTrigger className="w-full min-w-0">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {editRoleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleOptionLabel(role)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="grid gap-0.5">
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Disable to block login without deleting.</div>
              </div>
              <Switch checked={eActive} onCheckedChange={setEActive} />
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditOpen(false)
                setSelected(null)
              }}
              disabled={saving}
              className="w-full sm:w-auto sm:mr-2"
            >
              Cancel
            </Button>

            <Button type="button" onClick={() => void handleSaveEdit()} disabled={saving} className="w-full sm:w-auto">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={resendOpen} onOpenChange={setResendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend login credentials?</AlertDialogTitle>
            <AlertDialogDescription>
              This will generate a <b>new temporary password</b> and email it to the user. The old password will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={saving}
              onClick={() => {
                setResendOpen(false)
                setSelected(null)
              }}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault()
                void handleResendCredentials()
              }}
            >
              {saving ? "Resending…" : "Resend credentials"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset credential</DialogTitle>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="new-password">New credential</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter a new credential"
            />
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResetOpen(false)
                setSelected(null)
                setNewPassword("")
              }}
              disabled={saving}
              className="w-full sm:w-auto sm:mr-2"
            >
              Cancel
            </Button>

            <Button type="button" onClick={() => void handleResetPassword()} disabled={saving} className="w-full sm:w-auto">
              {saving ? "Updating…" : "Update credential"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the user (or disable them if your backend does not support DELETE for this route).
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={saving}
              onClick={() => {
                setDeleteOpen(false)
                setSelected(null)
              }}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={saving}
              onClick={(e) => {
                e.preventDefault()
                void handleDeleteAccount()
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {saving ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  )
}