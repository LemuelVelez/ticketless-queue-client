/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
    Camera,
    Eye,
    EyeOff,
    KeyRound,
    Save,
    User2,
} from "lucide-react"

import { DashboardLayout } from "@/components/dashboard-layout"
import { ADMIN_NAV_ITEMS } from "@/components/dashboard-nav"
import type { DashboardUser } from "@/components/nav-user"

import { API_PATHS } from "@/api/api"
import {
    getAuthStorage,
    getAuthToken,
    getAuthUser,
    setAuthSession,
    setAuthUser,
} from "@/lib/auth"
import { api } from "@/lib/http"
import { useSession } from "@/hooks/use-session"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

type SettingsUser = {
    id?: string
    _id?: string
    role?: string
    name?: string | null
    email?: string | null
    assignedDepartment?: string | null
    assignedWindow?: string | null
    avatarKey?: string | null
    avatarUrl?: string | null
    firstName?: string | null
    middleName?: string | null
    lastName?: string | null
    [key: string]: unknown
}

type SettingsResponse = {
    token?: string | null
    user?: SettingsUser | null
    current?: SettingsUser | { user?: SettingsUser | null } | null
    avatarUrl?: string | null
    avatarKey?: string | null
    url?: string | null
    [key: string]: unknown
}

type AvatarPresignResponse = {
    uploadUrl?: string | null
    key?: string | null
    objectUrl?: string | null
    url?: string | null
    [key: string]: unknown
}

type ProfileBaseline = {
    name: string
    email: string
}

type SyncStoredAuthOptions = {
    refreshSession?: boolean
}

const SETTINGS_CURRENT_PATH = API_PATHS.settings.current
const SETTINGS_AVATAR_PATH = API_PATHS.settings.avatar
const SETTINGS_AVATAR_PRESIGN_PATH = API_PATHS.settings.avatarPresign

function initials(name?: string) {
    const s = String(name ?? "").trim()
    if (!s) return "U"
    const parts = s.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] ?? "U"
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : ""
    return (a + b).toUpperCase()
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function hasOwn(value: unknown, key: string) {
    return isRecord(value) && Object.prototype.hasOwnProperty.call(value, key)
}

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") return null
    const clean = value.trim()
    return clean ? clean : null
}

function normalizeEmailValue(value: unknown): string {
    return String(value ?? "").trim().toLowerCase()
}

function resolveName(user?: SettingsUser | null): string | null {
    if (!user) return null

    const directName = normalizeString(user.name)
    if (directName) return directName

    const parts = [user.firstName, user.middleName, user.lastName]
        .map(normalizeString)
        .filter(Boolean)

    return parts.length ? parts.join(" ") : null
}

function extractSettingsUser(payload: unknown): SettingsUser | null {
    if (!isRecord(payload)) return null

    if (isRecord(payload.user)) return payload.user as SettingsUser

    if (isRecord(payload.current)) {
        if (isRecord(payload.current.user)) return payload.current.user as SettingsUser
        return payload.current as SettingsUser
    }

    if (
        "id" in payload ||
        "_id" in payload ||
        "name" in payload ||
        "email" in payload ||
        "avatarUrl" in payload
    ) {
        return payload as SettingsUser
    }

    return null
}

function extractToken(payload: unknown): string | null {
    if (!isRecord(payload)) return null
    return normalizeString(payload.token)
}

function extractAvatarKey(payload: unknown): string | null | undefined {
    if (!isRecord(payload)) return undefined

    if (hasOwn(payload, "avatarKey")) {
        const direct = normalizeString(payload.avatarKey)
        if (direct) return direct
        if (payload.avatarKey === null) return null
    }

    const user = extractSettingsUser(payload)
    if (user && Object.prototype.hasOwnProperty.call(user, "avatarKey")) {
        if (user.avatarKey === null) return null
        return normalizeString(user.avatarKey)
    }

    return undefined
}

function extractAvatarUrlState(payload: unknown): string | null | undefined {
    if (!isRecord(payload)) return undefined

    if (hasOwn(payload, "avatarUrl")) {
        const direct = normalizeString(payload.avatarUrl)
        if (direct) return direct
        if (payload.avatarUrl === null) return null
    }

    if (hasOwn(payload, "url")) {
        const direct = normalizeString(payload.url)
        if (direct) return direct
        if (payload.url === null) return null
    }

    const user = extractSettingsUser(payload)
    if (user && Object.prototype.hasOwnProperty.call(user, "avatarUrl")) {
        const nested = normalizeString(user.avatarUrl)
        if (nested) return nested
        if (user.avatarUrl === null) return null
    }

    return undefined
}

const settingsApi = {
    current() {
        return api.getData<SettingsResponse>(SETTINGS_CURRENT_PATH, {
            auth: "staff",
        })
    },
    update(body: Record<string, unknown>) {
        return api.patchData<SettingsResponse>(SETTINGS_CURRENT_PATH, body, {
            auth: "staff",
        })
    },
    presignAvatarUpload(body: { contentType: string; fileName: string }) {
        return api.postData<AvatarPresignResponse>(
            SETTINGS_AVATAR_PRESIGN_PATH,
            body,
            { auth: "staff" }
        )
    },
    uploadAvatar(file: File) {
        const formData = new FormData()
        formData.append("avatar", file)
        return api.postData<SettingsResponse>(SETTINGS_AVATAR_PATH, formData, {
            auth: "staff",
        })
    },
}

export default function AdminSettingsPage() {
    const location = useLocation()
    const { user: sessionUser, refresh } = useSession()

    const stored = getAuthUser()

    const sessionNameRef = React.useRef<string>(
        normalizeString(sessionUser?.name) ?? "Admin"
    )
    const sessionEmailRef = React.useRef<string>(
        normalizeString(sessionUser?.email) ?? ""
    )

    React.useEffect(() => {
        sessionNameRef.current =
            normalizeString(sessionUser?.name) ?? sessionNameRef.current
        sessionEmailRef.current =
            normalizeString(sessionUser?.email) ?? sessionEmailRef.current
    }, [sessionUser?.email, sessionUser?.name])

    const baseName =
        normalizeString((stored?.name as string | undefined) ?? null) ??
        normalizeString(sessionUser?.name) ??
        "Admin"
    const baseEmail =
        normalizeString((stored?.email as string | undefined) ?? null) ??
        normalizeString(sessionUser?.email) ??
        ""

    const dashboardUser: DashboardUser | undefined = React.useMemo(() => {
        const name = baseName || "Admin"
        const email = baseEmail || ""
        return { name, email }
    }, [baseEmail, baseName])

    const [loading, setLoading] = React.useState(true)

    const [avatarUrl, setAvatarUrl] = React.useState<string | null>(
        normalizeString((stored?.avatarUrl as string | undefined) ?? null)
    )
    const [avatarLoading, setAvatarLoading] = React.useState(false)
    const [avatarUploading, setAvatarUploading] = React.useState(false)

    const fileRef = React.useRef<HTMLInputElement | null>(null)

    const [name, setName] = React.useState(baseName)
    const [email, setEmail] = React.useState(baseEmail)
    const [baselineProfile, setBaselineProfile] = React.useState<ProfileBaseline>({
        name: baseName,
        email: normalizeEmailValue(baseEmail),
    })

    const [currentPasswordForProfile, setCurrentPasswordForProfile] =
        React.useState("")
    const [savingProfile, setSavingProfile] = React.useState(false)

    const [currentPassword, setCurrentPassword] = React.useState("")
    const [newPassword, setNewPassword] = React.useState("")
    const [confirmPassword, setConfirmPassword] = React.useState("")
    const [savingPassword, setSavingPassword] = React.useState(false)

    const [showProfileCurrentPassword, setShowProfileCurrentPassword] =
        React.useState(false)
    const [showCurrentPassword, setShowCurrentPassword] = React.useState(false)
    const [showNewPassword, setShowNewPassword] = React.useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = React.useState(false)

    const rememberMe = React.useMemo(() => getAuthStorage() === "local", [])

    const normalizedCurrentName = React.useMemo(
        () => String(name ?? "").trim(),
        [name]
    )
    const normalizedCurrentEmail = React.useMemo(
        () => normalizeEmailValue(email),
        [email]
    )

    const emailChanged = React.useMemo(() => {
        return normalizedCurrentEmail !== baselineProfile.email
    }, [baselineProfile.email, normalizedCurrentEmail])

    const profileChanged = React.useMemo(() => {
        return (
            normalizedCurrentName !== String(baselineProfile.name ?? "").trim() ||
            normalizedCurrentEmail !== baselineProfile.email
        )
    }, [
        baselineProfile.email,
        baselineProfile.name,
        normalizedCurrentEmail,
        normalizedCurrentName,
    ])

    const syncStoredAuthFromPayload = React.useCallback(
        async (
            payload: unknown,
            options: SyncStoredAuthOptions = {}
        ) => {
            const { refreshSession = true } = options

            const extractedUser = extractSettingsUser(payload)
            const avatarKey = extractAvatarKey(payload)
            const avatarUrlState = extractAvatarUrlState(payload)

            if (
                !extractedUser &&
                avatarKey === undefined &&
                avatarUrlState === undefined
            ) {
                if (refreshSession) {
                    try {
                        await refresh()
                    } catch {
                        // ignore refresh errors here; UI already has local state
                    }
                }
                return
            }

            const mergedUser = {
                ...(getAuthUser() ?? {}),
                ...(extractedUser ?? {}),
                ...(avatarKey !== undefined ? { avatarKey } : {}),
                ...(avatarUrlState !== undefined
                    ? { avatarUrl: avatarUrlState }
                    : {}),
            }

            const token = extractToken(payload) ?? getAuthToken()

            if (token) {
                setAuthSession(token, mergedUser as any, rememberMe)
            } else {
                setAuthUser(mergedUser as any, rememberMe)
            }

            if (refreshSession) {
                try {
                    await refresh()
                } catch {
                    // ignore refresh errors; stored auth is already updated
                }
            }
        },
        [rememberMe, refresh]
    )

    const refreshCurrentSettings = React.useCallback(async () => {
        setAvatarLoading(true)
        try {
            const res = await settingsApi.current()
            const currentUser = extractSettingsUser(res)

            const resolvedName =
                resolveName(currentUser) ??
                normalizeString((getAuthUser()?.name as string | undefined) ?? null) ??
                sessionNameRef.current ??
                "Admin"

            const resolvedEmail =
                normalizeString(currentUser?.email) ??
                normalizeString(
                    (getAuthUser()?.email as string | undefined) ?? null
                ) ??
                sessionEmailRef.current ??
                ""

            const nextAvatarUrlState = extractAvatarUrlState(res)
            const fallbackStoredAvatar =
                normalizeString(
                    (getAuthUser()?.avatarUrl as string | undefined) ?? null
                ) ?? null

            setName(resolvedName || "")
            setEmail(resolvedEmail || "")
            setBaselineProfile({
                name: resolvedName || "",
                email: normalizeEmailValue(resolvedEmail || ""),
            })
            setAvatarUrl(
                nextAvatarUrlState !== undefined
                    ? nextAvatarUrlState
                    : fallbackStoredAvatar
            )

            await syncStoredAuthFromPayload(res, { refreshSession: false })
        } catch {
            setAvatarUrl(
                normalizeString(
                    (getAuthUser()?.avatarUrl as string | undefined) ?? null
                ) ?? null
            )
        } finally {
            setAvatarLoading(false)
        }
    }, [syncStoredAuthFromPayload])

    React.useEffect(() => {
        let active = true

        void (async () => {
            if (!active) return
            setLoading(true)
            try {
                await refreshCurrentSettings()
            } finally {
                if (active) {
                    setLoading(false)
                }
            }
        })()

        return () => {
            active = false
        }
    }, [refreshCurrentSettings])

    const openAvatarPicker = React.useCallback(() => {
        if (!fileRef.current) return
        fileRef.current.value = ""
        fileRef.current.click()
    }, [])

    async function onSaveProfile() {
        const nextName = normalizedCurrentName
        const nextEmail = normalizedCurrentEmail

        if (!nextName) {
            toast.error("Name is required.")
            return
        }

        if (emailChanged && !currentPasswordForProfile) {
            toast.error("Current password is required to change email.")
            return
        }

        setSavingProfile(true)
        try {
            const resp = await settingsApi.update({
                name: nextName,
                email: nextEmail || undefined,
                currentPassword: emailChanged
                    ? currentPasswordForProfile
                    : undefined,
            })

            await syncStoredAuthFromPayload(resp, { refreshSession: true })

            const updatedUser = extractSettingsUser(resp)
            const savedName = resolveName(updatedUser) ?? nextName
            const savedEmail =
                normalizeString(updatedUser?.email) ?? nextEmail

            setCurrentPasswordForProfile("")
            setName(savedName)
            setEmail(savedEmail)
            setBaselineProfile({
                name: savedName,
                email: normalizeEmailValue(savedEmail),
            })

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
            const resp = await settingsApi.update({
                currentPassword,
                newPassword,
            })

            await syncStoredAuthFromPayload(resp, { refreshSession: true })
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
            try {
                const presign = await settingsApi.presignAvatarUpload({
                    contentType: file.type,
                    fileName: file.name,
                })

                const uploadUrl = normalizeString(presign.uploadUrl)
                const objectUrl =
                    normalizeString(presign.objectUrl) ??
                    normalizeString(presign.url)
                const key = normalizeString(presign.key)

                if (!uploadUrl || !objectUrl || !key) {
                    throw new Error("Avatar presign response is incomplete.")
                }

                const putRes = await fetch(uploadUrl, {
                    method: "PUT",
                    headers: { "Content-Type": file.type },
                    body: file,
                })

                if (!putRes.ok) {
                    throw new Error(`Upload failed (${putRes.status})`)
                }

                const resp = await settingsApi.update({
                    avatarKey: key,
                    avatarUrl: objectUrl,
                })

                await syncStoredAuthFromPayload(
                    {
                        ...resp,
                        avatarKey: key,
                        avatarUrl: objectUrl,
                    },
                    { refreshSession: true }
                )
                setAvatarUrl(objectUrl)
            } catch {
                const resp = await settingsApi.uploadAvatar(file)
                await syncStoredAuthFromPayload(resp, { refreshSession: true })

                const uploadedAvatarUrl = extractAvatarUrlState(resp)
                if (uploadedAvatarUrl !== undefined) {
                    setAvatarUrl(uploadedAvatarUrl)
                }
            }

            await refreshCurrentSettings()
            toast.success("Avatar updated.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to upload avatar.")
        } finally {
            setAvatarUploading(false)
            if (fileRef.current) {
                fileRef.current.value = ""
            }
        }
    }

    async function onRemoveAvatar() {
        setAvatarUploading(true)
        try {
            const resp = await settingsApi.update({
                avatarKey: null,
                avatarUrl: null,
            })

            await syncStoredAuthFromPayload(
                {
                    ...resp,
                    avatarKey: null,
                    avatarUrl: null,
                },
                { refreshSession: true }
            )
            setAvatarUrl(null)
            toast.success("Avatar removed.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to remove avatar.")
        } finally {
            setAvatarUploading(false)
            if (fileRef.current) {
                fileRef.current.value = ""
            }
        }
    }

    return (
        <DashboardLayout
            title="Admin settings"
            navItems={ADMIN_NAV_ITEMS}
            user={dashboardUser}
            activePath={location.pathname}
        >
            <div className="grid w-full min-w-0 grid-cols-1 gap-6">
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <User2 className="h-5 w-5" />
                            Settings
                        </CardTitle>
                        <CardDescription>
                            Update your avatar and credentials.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="min-w-0">
                        {loading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-24 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        ) : (
                            <div className="grid gap-6 lg:grid-cols-12">
                                <Card className="lg:col-span-5">
                                    <CardHeader>
                                        <CardTitle>Avatar</CardTitle>
                                        <CardDescription>
                                            Upload a profile image.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-start">
                                            <div className="h-24 w-24 overflow-hidden rounded-full border bg-muted">
                                                {avatarLoading ? (
                                                    <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
                                                        …
                                                    </div>
                                                ) : avatarUrl ? (
                                                    <img
                                                        src={avatarUrl}
                                                        alt="Avatar"
                                                        className="h-full w-full object-cover"
                                                    />
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
                                                    onChange={(e) => {
                                                        const pickedFile =
                                                            e.target.files?.[0] ?? null
                                                        e.target.value = ""
                                                        void onPickAvatarFile(
                                                            pickedFile
                                                        )
                                                    }}
                                                />

                                                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                                                    <Button
                                                        type="button"
                                                        onClick={openAvatarPicker}
                                                        disabled={avatarUploading}
                                                        className="w-full gap-2 sm:w-auto"
                                                    >
                                                        <Camera className="h-4 w-4" />
                                                        {avatarUploading
                                                            ? "Uploading…"
                                                            : "Upload"}
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        onClick={() =>
                                                            void refreshCurrentSettings()
                                                        }
                                                        disabled={
                                                            avatarUploading ||
                                                            avatarLoading
                                                        }
                                                        className="w-full sm:w-auto"
                                                    >
                                                        Refresh
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() =>
                                                            void onRemoveAvatar()
                                                        }
                                                        disabled={
                                                            avatarUploading ||
                                                            avatarLoading ||
                                                            !avatarUrl
                                                        }
                                                        className="w-full sm:w-auto"
                                                    >
                                                        Remove
                                                    </Button>
                                                </div>

                                                <div className="text-center text-xs text-muted-foreground sm:text-left">
                                                    Max 5MB. Recommended square
                                                    image.
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="lg:col-span-7">
                                    <CardHeader>
                                        <CardTitle>Profile</CardTitle>
                                        <CardDescription>
                                            Edit your name and email.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="name">Name</Label>
                                                <Input
                                                    id="name"
                                                    value={name}
                                                    onChange={(e) =>
                                                        setName(e.target.value)
                                                    }
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="email">Email</Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) =>
                                                        setEmail(e.target.value)
                                                    }
                                                />
                                            </div>
                                        </div>

                                        {emailChanged ? (
                                            <div className="space-y-2">
                                                <Label htmlFor="profileCurrentPassword">
                                                    Current password
                                                </Label>

                                                <div className="relative">
                                                    <Input
                                                        id="profileCurrentPassword"
                                                        type={
                                                            showProfileCurrentPassword
                                                                ? "text"
                                                                : "password"
                                                        }
                                                        value={
                                                            currentPasswordForProfile
                                                        }
                                                        onChange={(e) =>
                                                            setCurrentPasswordForProfile(
                                                                e.target.value
                                                            )
                                                        }
                                                        autoComplete="current-password"
                                                        className="pr-10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                        onClick={() =>
                                                            setShowProfileCurrentPassword(
                                                                (v) => !v
                                                            )
                                                        }
                                                        aria-label={
                                                            showProfileCurrentPassword
                                                                ? "Hide password"
                                                                : "Show password"
                                                        }
                                                    >
                                                        {showProfileCurrentPassword ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : null}

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button
                                                type="button"
                                                onClick={() => void onSaveProfile()}
                                                disabled={savingProfile || !profileChanged}
                                                className="gap-2"
                                            >
                                                <Save className="h-4 w-4" />
                                                {savingProfile
                                                    ? "Saving…"
                                                    : "Save profile"}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="lg:col-span-12">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <KeyRound className="h-5 w-5" />
                                            Password
                                        </CardTitle>
                                        <CardDescription>
                                            Change your password.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 lg:grid-cols-3">
                                            <div className="space-y-2">
                                                <Label htmlFor="currentPassword">
                                                    Current password
                                                </Label>

                                                <div className="relative">
                                                    <Input
                                                        id="currentPassword"
                                                        type={
                                                            showCurrentPassword
                                                                ? "text"
                                                                : "password"
                                                        }
                                                        value={currentPassword}
                                                        onChange={(e) =>
                                                            setCurrentPassword(
                                                                e.target.value
                                                            )
                                                        }
                                                        autoComplete="current-password"
                                                        className="pr-10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                        onClick={() =>
                                                            setShowCurrentPassword(
                                                                (v) => !v
                                                            )
                                                        }
                                                        aria-label={
                                                            showCurrentPassword
                                                                ? "Hide password"
                                                                : "Show password"
                                                        }
                                                    >
                                                        {showCurrentPassword ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="newPassword">
                                                    New password
                                                </Label>

                                                <div className="relative">
                                                    <Input
                                                        id="newPassword"
                                                        type={
                                                            showNewPassword
                                                                ? "text"
                                                                : "password"
                                                        }
                                                        value={newPassword}
                                                        onChange={(e) =>
                                                            setNewPassword(
                                                                e.target.value
                                                            )
                                                        }
                                                        autoComplete="new-password"
                                                        className="pr-10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                        onClick={() =>
                                                            setShowNewPassword(
                                                                (v) => !v
                                                            )
                                                        }
                                                        aria-label={
                                                            showNewPassword
                                                                ? "Hide password"
                                                                : "Show password"
                                                        }
                                                    >
                                                        {showNewPassword ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="confirmPassword">
                                                    Confirm new password
                                                </Label>

                                                <div className="relative">
                                                    <Input
                                                        id="confirmPassword"
                                                        type={
                                                            showConfirmPassword
                                                                ? "text"
                                                                : "password"
                                                        }
                                                        value={confirmPassword}
                                                        onChange={(e) =>
                                                            setConfirmPassword(
                                                                e.target.value
                                                            )
                                                        }
                                                        autoComplete="new-password"
                                                        className="pr-10"
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                                                        onClick={() =>
                                                            setShowConfirmPassword(
                                                                (v) => !v
                                                            )
                                                        }
                                                        aria-label={
                                                            showConfirmPassword
                                                                ? "Hide password"
                                                                : "Show password"
                                                        }
                                                    >
                                                        {showConfirmPassword ? (
                                                            <EyeOff className="h-4 w-4" />
                                                        ) : (
                                                            <Eye className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                            <Button
                                                type="button"
                                                onClick={() => void onSavePassword()}
                                                disabled={savingPassword}
                                                className="gap-2"
                                            >
                                                <Save className="h-4 w-4" />
                                                {savingPassword
                                                    ? "Saving…"
                                                    : "Save password"}
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