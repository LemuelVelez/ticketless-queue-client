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
  Mail,
  Eye,
  EyeOff,
  Wand2,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { adminApi } from "@/api/admin"
import { useSession } from "@/hooks/use-session"
import { api } from "@/lib/http"

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

type AccountUser = {
  id?: string
  _id?: string
  name: string
  email: string
  role?: AccountRole | string
  type?: string
  active: boolean
  readOnly?: boolean
}

type AccountRow = AccountUser & {
  role: AccountRole
}

const ROLE_ORDER: AccountRole[] = ["ADMIN", "STAFF", "STUDENT", "ALUMNI_VISITOR", "GUEST"]

function userId(u: AccountUser) {
  return u._id ?? u.id ?? ""
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

function generateTempPasswordClient() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
  const take = (n: number) => {
    try {
      const arr = new Uint32Array(n)
      crypto.getRandomValues(arr)
      return Array.from(arr)
        .map((x) => alphabet[x % alphabet.length])
        .join("")
    } catch {
      return Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("")
    }
  }
  // readable + meets typical complexity expectations
  return `${take(12)}A1!`
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

  // dialogs
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [resetOpen, setResetOpen] = React.useState(false)
  const [sendCredsOpen, setSendCredsOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  // selected user
  const [selected, setSelected] = React.useState<AccountUser | null>(null)

  // create form
  const [cName, setCName] = React.useState("")
  const [cEmail, setCEmail] = React.useState("")
  const [cPassword, setCPassword] = React.useState("")
  const [cShowPassword, setCShowPassword] = React.useState(false)
  const [cRole, setCRole] = React.useState<StaffAccountRole>("STAFF")
  const [cSendCreds, setCSendCreds] = React.useState(true)

  // edit form
  const [eName, setEName] = React.useState("")
  const [eRole, setERole] = React.useState<EditableRole>("STAFF")
  const [eActive, setEActive] = React.useState(true)

  // reset credential form (no email)
  const [newPassword, setNewPassword] = React.useState("")

  // send/resend credentials form (emails user)
  const [scUseCustomPassword, setScUseCustomPassword] = React.useState(false)
  const [scPassword, setScPassword] = React.useState("")
  const [scShowPassword, setScShowPassword] = React.useState(false)

  const editRoleOptions = React.useMemo<EditableRole[]>(() => {
    const sourceRole = selected ? normalizeRole(selected.role ?? selected.type) : eRole
    return getEditableRoleOptions(sourceRole)
  }, [selected, eRole])

  const fetchAll = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.listStaff()

      // Backward + forward compatible payload handling:
      // - { staff: [...] } (legacy)
      // - { users: [...] } (optional newer shape)
      const listRaw = Array.isArray((res as any)?.staff)
        ? (res as any).staff
        : Array.isArray((res as any)?.users)
          ? (res as any).users
          : []

      const normalized = (listRaw as any[]).map((u) => ({
        ...u,
        name: typeof u?.name === "string" && u.name.trim() ? u.name : "—",
        email: typeof u?.email === "string" ? u.email : "",
        active: Boolean(u?.active),
        role: normalizeRole(u?.role ?? u?.type),
        readOnly: Boolean(u?.readOnly),
      }))

      setUsers(normalized as AccountUser[])
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load accounts."
      toast.error(msg)
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
    setSelected(u)
    setEName(u.name ?? "")
    setEActive(!!u.active)
    setERole(u.role)
    setEditOpen(true)
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

  function openSendCredentials(u: AccountUser) {
    if (isReadOnlyAccount(u)) {
      toast.message("Sending login credentials is not available for this account type from this page.")
      return
    }
    setSelected(u)
    setScUseCustomPassword(false)
    setScPassword("")
    setScShowPassword(false)
    setSendCredsOpen(true)
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
    setCSendCreds(true)
  }

  async function handleCreate() {
    const name = cName.trim()
    const email = cEmail.trim()
    const password = cPassword

    if (!name) return toast.error("Name is required.")
    if (!email) return toast.error("Email is required.")
    if (!password) return toast.error("Password is required.")

    const payload: any = {
      name,
      email,
      password,
      role: cRole,
    }

    setSaving(true)
    try {
      const createdRes = await adminApi.createStaff(payload)

      const createdUser =
        (createdRes as any)?.staff ??
        (createdRes as any)?.user ??
        (createdRes as any)?.account ??
        (createdRes as any)?.data?.staff ??
        null

      const createdId = createdUser ? userId(createdUser as any) : ""

      if (cSendCreds) {
        if (createdId) {
          await adminApi.sendLoginCredentials(createdId, { password })
          toast.success("Account created and login credentials sent.")
        } else {
          toast.success("Account created.")
          toast.message("Could not detect the new user id to send credentials. You can resend from the user actions menu.")
        }
      } else {
        toast.success("Account created.")
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

  async function handleSaveEdit() {
    if (!selected) return
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
      await adminApi.updateStaff(id, payload as any)
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
      await adminApi.updateStaff(id, { password: newPassword })
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

  async function handleSendLoginCredentials() {
    if (!selected) return
    if (isReadOnlyAccount(selected)) {
      return toast.message("Sending login credentials is not available for this account type from this page.")
    }

    const id = userId(selected)
    if (!id) return toast.error("Invalid user id.")

    if (scUseCustomPassword) {
      if (!scPassword.trim()) return toast.error("Temporary password is required.")
      if (scPassword.trim().length < 8) return toast.error("Temporary password must be at least 8 characters.")
    }

    setSaving(true)
    try {
      const payload = scUseCustomPassword ? { password: scPassword } : {}
      await adminApi.sendLoginCredentials(id, payload as any)

      toast.success("Login credentials sent.")
      setSendCredsOpen(false)
      setSelected(null)
      setScUseCustomPassword(false)
      setScPassword("")
      setScShowPassword(false)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send login credentials."
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
      const apiAny = api as any

      if (typeof apiAny.delete === "function") {
        await apiAny.delete(`/admin/staff/${id}`)
      } else if (typeof apiAny.del === "function") {
        await apiAny.del(`/admin/staff/${id}`)
      } else {
        await adminApi.updateStaff(id, { active: false })
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
                <CardDescription>
                  Displaying all users (ADMIN, STAFF, STUDENT, ALUMNI/VISITOR, and GUEST).
                </CardDescription>
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

                                    <DropdownMenuItem onClick={() => openEdit(u)} className="cursor-pointer">
                                      Edit role/account
                                    </DropdownMenuItem>

                                    {readOnly ? (
                                      <DropdownMenuItem disabled className="gap-2">
                                        <Mail className="h-4 w-4" />
                                        Send credentials unavailable
                                      </DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => openSendCredentials(u)} className="cursor-pointer gap-2">
                                        <Mail className="h-4 w-4" />
                                        Send login credentials
                                      </DropdownMenuItem>
                                    )}

                                    {readOnly ? (
                                      <DropdownMenuItem disabled>Reset credential unavailable</DropdownMenuItem>
                                    ) : (
                                      <DropdownMenuItem onClick={() => openReset(u)} className="cursor-pointer">
                                        Reset credential (no email)
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg flex max-h-[85vh] flex-col overflow-hidden sm:max-h-none sm:overflow-visible">
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

            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="c-password">Temporary password</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCPassword(generateTempPasswordClient())}
                  disabled={saving}
                  className="gap-2"
                >
                  <Wand2 className="h-4 w-4" />
                  Generate
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  id="c-password"
                  value={cPassword}
                  onChange={(e) => setCPassword(e.target.value)}
                  placeholder="Set an initial password"
                  type={cShowPassword ? "text" : "password"}
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCShowPassword((v) => !v)}
                  aria-label={cShowPassword ? "Hide password" : "Show password"}
                  disabled={saving}
                >
                  {cShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
                This password will be sent to the user if you enable “Send login credentials”.
              </div>
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

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="grid gap-0.5">
                <div className="text-sm font-medium">Send login credentials</div>
                <div className="text-xs text-muted-foreground">
                  Emails the user their login details (and verification link if required).
                </div>
              </div>
              <Switch checked={cSendCreds} onCheckedChange={setCSendCreds} />
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

      {/* Edit dialog */}
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

      {/* Reset credential dialog (no email) */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset credential (no email)</DialogTitle>
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

      {/* Send / Resend login credentials (email) */}
      <Dialog open={sendCredsOpen} onOpenChange={setSendCredsOpen}>
        <DialogContent className="sm:max-w-lg flex max-h-[85vh] flex-col overflow-hidden sm:max-h-none sm:overflow-visible">
          <DialogHeader>
            <DialogTitle>Send login credentials</DialogTitle>
          </DialogHeader>

          <div className="grid flex-1 gap-4 overflow-y-auto pr-1 sm:overflow-visible sm:pr-0">
            <div className="rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium">This will email the user their login credentials.</div>
                  <div className="text-xs text-muted-foreground">
                    The server will reset the password and send a new temporary password to the user. If the user needs email
                    verification, the email will include a verification link.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={selected?.name ?? ""} readOnly />
            </div>

            <div className="grid gap-2">
              <Label>Email</Label>
              <Input value={selected?.email ?? ""} readOnly />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="grid gap-0.5">
                <div className="text-sm font-medium">Set custom temporary password</div>
                <div className="text-xs text-muted-foreground">
                  Turn on if you want to define the password. Otherwise, the server generates one automatically.
                </div>
              </div>
              <Switch checked={scUseCustomPassword} onCheckedChange={setScUseCustomPassword} />
            </div>

            {scUseCustomPassword ? (
              <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label htmlFor="sc-password">Temporary password</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setScPassword(generateTempPasswordClient())}
                    disabled={saving}
                    className="gap-2"
                  >
                    <Wand2 className="h-4 w-4" />
                    Generate
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Input
                    id="sc-password"
                    value={scPassword}
                    onChange={(e) => setScPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    type={scShowPassword ? "text" : "password"}
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setScShowPassword((v) => !v)}
                    aria-label={scShowPassword ? "Hide password" : "Show password"}
                    disabled={saving}
                  >
                    {scShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSendCredsOpen(false)
                setSelected(null)
                setScUseCustomPassword(false)
                setScPassword("")
                setScShowPassword(false)
              }}
              disabled={saving}
              className="w-full sm:w-auto sm:mr-2"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={() => void handleSendLoginCredentials()}
              disabled={saving}
              className="w-full gap-2 sm:w-auto"
            >
              <Mail className="h-4 w-4" />
              {saving ? "Sending…" : "Send email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the user (or disable them if your client can’t send DELETE).
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