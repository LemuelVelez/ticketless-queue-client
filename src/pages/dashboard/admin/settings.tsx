/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Camera, Eye, EyeOff, KeyRound, Save, User2 } from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { authApi } from "@/api/auth"
import { getAuthStorage, getAuthUser, setAuthSession } from "@/lib/auth"
import { useSession } from "@/hooks/use-session"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

function initials(name?: string) {
    const s = String(name ?? "").trim()
    if (!s) return "U"
    const parts = s.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] ?? "U"
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
    return (a + b).toUpperCase()
}

export default function AdminSettingsPage() {
    const location = useLocation()
    const { user: sessionUser } = useSession()

    const stored = getAuthUser()
    const baseName = (stored?.name as string | undefined) ?? sessionUser?.name ?? "Admin"
    const baseEmail = (stored?.email as string | undefined) ?? sessionUser?.email ?? ""

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        const name = baseName || "Admin"
        const email = baseEmail || ""
        return { name, email }
    }, [baseName, baseEmail])

    const [loading, setLoading] = React.useState(true)

    const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null)
    const [avatarLoading, setAvatarLoading] = React.useState(false)
    const [avatarUploading, setAvatarUploading] = React.useState(false)

    const fileRef = React.useRef<HTMLInputElement | null>(null)

    // Profile form
    const [name, setName] = React.useState(baseName)
    const [email, setEmail] = React.useState(baseEmail)
    const [currentPasswordForProfile, setCurrentPasswordForProfile] = React.useState("")
    const [savingProfile, setSavingProfile] = React.useState(false)

    // Password form
    const [currentPassword, setCurrentPassword] = React.useState("")
    const [newPassword, setNewPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")
    const [savingPassword, setSavingPassword] = React.useState(false)

    // ✅ Show/Hide password toggles
    const [showProfileCurrentPassword, setShowProfileCurrentPassword] = React.useState(false)
    const [showCurrentPassword, setShowCurrentPassword] = React.useState(false)
    const [showNewPassword, setShowNewPassword] = React.useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

    const rememberMe = React.useMemo(() => getAuthStorage() === "local", [])

    const refreshAvatarUrl = React.useCallback(async () => {
        setAvatarLoading(true)
        try {
            const res = await authApi.getMyAvatarUrl()
            setAvatarUrl(res.url ?? null)
        } catch (e) {
            setAvatarUrl(null)
        } finally {
            setAvatarLoading(false)
        }
    }, [])

    React.useEffect(() => {
        ; (async () => {
            setLoading(true)
            try {
                const latest = getAuthUser()
                setName(((latest?.name as string | undefined) ?? sessionUser?.name ?? baseName) || "")
                setEmail(((latest?.email as string | undefined) ?? sessionUser?.email ?? baseEmail) || "")
                await refreshAvatarUrl()
            } finally {
                setLoading(false)
            }
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    function applyAuthSession(token: string, user: any) {
        setAuthSession(token, user, rememberMe)
        if (user?.name !== undefined) setName(user.name)
        if (user?.email !== undefined) setEmail(user.email)
    }

    async function onSaveProfile() {
        const nextName = name.trim()
        const nextEmail = email.trim().toLowerCase()

        if (!nextName) {
            toast.error("Name is required.")
            return
        }

        const storedEmail = (getAuthUser()?.email as string | undefined) ?? baseEmail
        const isEmailChanging = Boolean(storedEmail && nextEmail && storedEmail.toLowerCase() !== nextEmail)

        if (isEmailChanging && !currentPasswordForProfile) {
            toast.error("Current password is required to change email.")
            return
        }

        setSavingProfile(true)
        try {
            const resp = await authApi.updateMe({
                name: nextName,
                email: nextEmail || undefined,
                currentPassword: isEmailChanging ? currentPasswordForProfile : undefined,
            })

            applyAuthSession(resp.token, resp.user)
            setCurrentPasswordForProfile("")
            toast.success("Profile updated.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to update profile.")
        } finally {
            setSavingProfile(false)
        }
    }

    async function onSavePassword() {
        if (!currentPassword) {
            toast.error("Current password is required.")
            return
        }
        if (!newPassword || newPassword.length < 8) {
            toast.error("New password must be at least 8 characters.")
            return
        }
        if (newPassword !== confirmPassword) {
            toast.error("New password and confirm password do not match.")
            return
        }

        setSavingPassword(true)
        try {
            const resp = await authApi.updateMe({
                currentPassword,
                newPassword,
            })

            applyAuthSession(resp.token, resp.user)
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            toast.success("Password updated.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to update password.")
        } finally {
            setSavingPassword(false)
        }
    }

    async function onPickAvatarFile(file: File | null) {
        if (!file) return

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.")
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error("Please use an image up to 5MB.")
            return
        }

        setAvatarUploading(true)
        try {
            // First try direct-to-S3 presigned upload (fastest)
            try {
                const presign = await authApi.presignAvatarUpload({
                    contentType: file.type,
                    fileName: file.name,
                })

                const putRes = await fetch(presign.uploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": file.type },
                    body: file,
                })

                if (!putRes.ok) {
                    throw new Error(`Upload failed (${putRes.status})`)
                }

                const resp = await authApi.updateMe({
                    avatarKey: presign.key,
                    avatarUrl: presign.objectUrl,
                })

                applyAuthSession(resp.token, resp.user)
            } catch (e) {
                // Fallback: backend-proxy upload (works even if S3 CORS is not configured)
                const resp = await authApi.uploadMyAvatar(file)
                applyAuthSession(resp.token, resp.user)
            }

            await refreshAvatarUrl()
            toast.success("Avatar updated.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to upload avatar.")
        } finally {
            setAvatarUploading(false)
        }
    }

    async function onRemoveAvatar() {
        setAvatarUploading(true)
        try {
            const resp = await authApi.updateMe({
                avatarKey: null,
                avatarUrl: null,
            })
            applyAuthSession(resp.token, resp.user)
            setAvatarUrl(null)
            toast.success("Avatar removed.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to remove avatar.")
        } finally {
            setAvatarUploading(false)
        }
    }

    return (
        <DashboardLayout title="Admin settings" navItems={ADMIN_NAV_ITEMS} user={dashboardUser} activePath={location.pathname}>
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User2 className="h-5 w-5" />
                            Settings
                        </CardTitle>
                        <CardDescription>Update your avatar and credentials.</CardDescription>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-12">
                                {/* Avatar */}
                                <Card className="lg:col-span-5">
                                    <CardHeader>
                                        <CardTitle>Avatar</CardTitle>
                                        <CardDescription>Upload a profile image.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-start">
                                            <div className="h-24 w-24 overflow-hidden rounded-full border bg-muted">
                                                {avatarLoading ? (
                                                    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">…</div>
                                                ) : avatarUrl ? (
                                                    <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-xl font-semibold">
                                                        {initials(name)}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:items-start">
                                                <input
                                                    ref={fileRef}
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => void onPickAvatarFile(e.target.files?.[0] ?? null)}
                                                />

                                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                                    <Button
                                                        type="button"
                                                        onClick={() => fileRef.current?.click()}
                                                        disabled={avatarUploading}
                                                        className="w-full gap-2 sm:w-auto"
                                                    >
                                                        <Camera className="h-4 w-4" />
                                                        {avatarUploading ? "Uploading…" : "Upload"}
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() => void refreshAvatarUrl()}
                                                        disabled={avatarUploading || avatarLoading}
                                                        className="w-full sm:w-auto"
                                                    >
                                                        Refresh
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() => void onRemoveAvatar()}
                                                        disabled={
                                                            avatarUploading ||
                                                            (!avatarUrl && !((getAuthUser() as any)?.avatarKey || (getAuthUser() as any)?.avatarUrl))
                                                        }
                                                        className="w-full sm:w-auto"
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>

                                                <div className="text-center text-xs text-muted-foreground sm:text-left">
                                                    Max 5MB. Recommended square image.
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Profile */}
                                <Card className="lg:col-span-7">
                                    <CardHeader>
                                        <CardTitle>Profile</CardTitle>
                                        <CardDescription>Edit your name and email.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="name">Name</Label>
                                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email</Label>
                                                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="currentPasswordForProfile">
                                                Current password (required only when changing email)
                                            </Label>

                                            <div className="relative">
                                                <Input
                                                    id="currentPasswordForProfile"
                                                    type={showProfileCurrentPassword ? "text" : "password"}
                                                    value={currentPasswordForProfile}
                                                    onChange={(e) => setCurrentPasswordForProfile(e.target.value)}
                                                    autoComplete="current-password"
                                                    className="pr-10"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                    onClick={() => setShowProfileCurrentPassword((v) => !v)}
                                                    aria-label={showProfileCurrentPassword ? "Hide password" : "Show password"}
                                                >
                                                    {showProfileCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button type="button" onClick={() => void onSaveProfile()} disabled={savingProfile} className="gap-2">
                                                <Save className="h-4 w-4" />
                                                {savingProfile ? "Saving…" : "Save profile"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Password */}
                                <Card className="lg:col-span-12">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <KeyRound className="h-5 w-5" />
                                            Password
                                        </CardTitle>
                                        <CardDescription>Change your password.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 lg:grid-cols-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="currentPassword">Current password</Label>

                                                <div className="relative">
                                                    <Input
                                                        id="currentPassword"
                                                        type={showCurrentPassword ? "text" : "password"}
                                                        value={currentPassword}
                                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                                        autoComplete="current-password"
                                                        className="pr-10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                        onClick={() => setShowCurrentPassword((v) => !v)}
                                                        aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                                                    >
                                                        {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="newPassword">New password</Label>

                                                <div className="relative">
                                                    <Input
                                                        id="newPassword"
                                                        type={showNewPassword ? "text" : "password"}
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        autoComplete="new-password"
                                                        className="pr-10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                        onClick={() => setShowNewPassword((v) => !v)}
                                                        aria-label={showNewPassword ? "Hide password" : "Show password"}
                                                    >
                                                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="confirmPassword">Confirm new password</Label>

                                                <div className="relative">
                                                    <Input
                                                        id="confirmPassword"
                                                        type={showConfirmPassword ? "text" : "password"}
                                                        value={confirmPassword}
                                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                                        autoComplete="new-password"
                                                        className="pr-10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                        onClick={() => setShowConfirmPassword((v) => !v)}
                                                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                                    >
                                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button type="button" onClick={() => void onSavePassword()} disabled={savingPassword} className="gap-2">
                                                <Save className="h-4 w-4" />
                                                {savingPassword ? "Saving…" : "Save password"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </DashboardLayout>
    )
}
