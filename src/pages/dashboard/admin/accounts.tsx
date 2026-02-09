/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { MoreHorizontal, Plus, RefreshCw, Shield, UserCog } from "lucide-react"

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

type AccountRole = "STAFF" | "ADMIN"

type AccountUser = {
    id?: string
    _id?: string
    name: string
    email: string
    role?: AccountRole
    active: boolean
}

type AccountRow = AccountUser & {
    role: AccountRole
}

function userId(u: AccountUser) {
    return u._id ?? u.id ?? ""
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
    return (
        <Badge variant="secondary" className="gap-1">
            <UserCog className="h-4 w-4" />
            STAFF
        </Badge>
    )
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
    const [deleteOpen, setDeleteOpen] = React.useState(false)

    // selected user
    const [selected, setSelected] = React.useState<AccountUser | null>(null)

    // create form
    const [cName, setCName] = React.useState("")
    const [cEmail, setCEmail] = React.useState("")
    const [cPassword, setCPassword] = React.useState("")
    const [cRole, setCRole] = React.useState<AccountRole>("STAFF")

    // edit form
    const [eName, setEName] = React.useState("")
    const [eRole, setERole] = React.useState<AccountRole>("STAFF")
    const [eActive, setEActive] = React.useState(true)

    // reset password form
    const [newPassword, setNewPassword] = React.useState("")

    const fetchAll = React.useCallback(async () => {
        setLoading(true)
        try {
            const staffRes = await adminApi.listStaff()
            setUsers((staffRes.staff ?? []) as any)
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
            const role = (u.role ?? "STAFF") as AccountRole
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
                const hay = `${u.name} ${u.email}`.toLowerCase()
                return hay.includes(query)
            })
            .sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1))
    }, [rows, q, tab])

    function openEdit(u: AccountRow) {
        setSelected(u)
        setEName(u.name ?? "")
        setEActive(!!u.active)
        setERole(u.role ?? "STAFF")
        setEditOpen(true)
    }

    function openReset(u: AccountUser) {
        setSelected(u)
        setNewPassword("")
        setResetOpen(true)
    }

    function openDelete(u: AccountUser) {
        setSelected(u)
        setDeleteOpen(true)
    }

    function resetCreateForm() {
        setCName("")
        setCEmail("")
        setCPassword("")
        setCRole("STAFF")
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
            await adminApi.createStaff(payload)
            toast.success("Account created.")
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
        const id = userId(selected)
        if (!id) return toast.error("Invalid user id.")
        if (!newPassword) return toast.error("New password is required.")

        setSaving(true)
        try {
            await adminApi.updateStaff(id, { password: newPassword })
            toast.success("Password updated.")
            setResetOpen(false)
            setSelected(null)
            setNewPassword("")
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Failed to update password."
            toast.error(msg)
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteAccount() {
        if (!selected) return
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
        return { total, active, inactive }
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
                                    Create users, update roles, reset passwords, and manage account access.
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
                                    placeholder="Search name or email…"
                                    className="w-full min-w-0 sm:w-80"
                                />
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <Badge variant="secondary">Total: {stats.total}</Badge>
                                <Badge variant="default">Active: {stats.active}</Badge>
                                <Badge variant="secondary">Inactive: {stats.inactive}</Badge>
                            </div>
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
                                                    const id = userId(u) || u.email
                                                    const role = (u.role ?? "STAFF") as AccountRole

                                                    return (
                                                        <TableRow key={id}>
                                                            <TableCell className="font-medium">
                                                                <div className="flex min-w-0 flex-col">
                                                                    <span className="truncate">{u.name}</span>
                                                                    <span className="truncate text-xs text-muted-foreground md:hidden">
                                                                        {u.email}
                                                                    </span>
                                                                </div>
                                                            </TableCell>

                                                            <TableCell className="hidden md:table-cell">
                                                                <span className="text-muted-foreground">{u.email}</span>
                                                            </TableCell>

                                                            <TableCell>{roleBadge(role)}</TableCell>

                                                            <TableCell className="text-right">
                                                                <Badge variant={u.active ? "default" : "secondary"}>
                                                                    {u.active ? "Active" : "Inactive"}
                                                                </Badge>
                                                            </TableCell>

                                                            <TableCell className="text-right">
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" aria-label="Row actions">
                                                                            <MoreHorizontal className="h-4 w-4" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>

                                                                    <DropdownMenuContent align="end" className="w-52">
                                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                                        <DropdownMenuSeparator />

                                                                        <DropdownMenuItem
                                                                            onClick={() => openEdit(u)}
                                                                            className="cursor-pointer"
                                                                        >
                                                                            Edit account
                                                                        </DropdownMenuItem>

                                                                        <DropdownMenuItem
                                                                            onClick={() => openReset(u)}
                                                                            className="cursor-pointer"
                                                                        >
                                                                            Reset password
                                                                        </DropdownMenuItem>

                                                                        <DropdownMenuSeparator />

                                                                        <DropdownMenuItem
                                                                            onClick={() => openDelete(u)}
                                                                            className="cursor-pointer text-destructive focus:text-destructive"
                                                                        >
                                                                            Delete account
                                                                        </DropdownMenuItem>
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
                            <Input
                                id="c-name"
                                value={cName}
                                onChange={(e) => setCName(e.target.value)}
                                placeholder="Full name"
                            />
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
                            <Label htmlFor="c-password">Temporary password</Label>
                            <Input
                                id="c-password"
                                value={cPassword}
                                onChange={(e) => setCPassword(e.target.value)}
                                placeholder="Set an initial password"
                                type="password"
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Role</Label>
                            <Select value={cRole} onValueChange={(v) => setCRole(v as AccountRole)}>
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

                        <Button
                            type="button"
                            onClick={() => void handleCreate()}
                            disabled={saving}
                            className="w-full sm:w-auto"
                        >
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
                            <Select value={eRole} onValueChange={(v) => setERole(v as AccountRole)}>
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

            {/* Reset password dialog */}
            <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Reset password</DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-2">
                        <Label htmlFor="new-password">New password</Label>
                        <Input
                            id="new-password"
                            type="password"
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter a new password"
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

                        <Button
                            type="button"
                            onClick={() => void handleResetPassword()}
                            disabled={saving}
                            className="w-full sm:w-auto"
                        >
                            {saving ? "Updating…" : "Update password"}
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
