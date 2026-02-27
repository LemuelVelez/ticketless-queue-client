/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Lock, User } from "lucide-react"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { guestApi } from "@/api/guest"
import { studentApi, type Department, participantAuthStorage } from "@/api/student"

import { api, ApiError } from "@/lib/http"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const DRAFT_KEY = "qp_student_profile_draft_v1"
const LOCK_SENTINEL = "__LOCKED__"

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
}

function pickDepartmentIdFromParticipant(p: any) {
    const direct = pickNonEmptyString(p?.departmentId)
    if (direct) return direct

    const dept = p?.department
    if (typeof dept === "string") return pickNonEmptyString(dept)
    if (dept && typeof dept === "object") {
        return pickNonEmptyString(dept?._id) || pickNonEmptyString(dept?.id)
    }

    return ""
}

function splitName(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return { firstName: "", middleName: "", lastName: "" }
    if (parts.length === 1) return { firstName: parts[0], middleName: "", lastName: "" }
    if (parts.length === 2) return { firstName: parts[0], middleName: "", lastName: parts[1] }

    return {
        firstName: parts[0],
        middleName: parts.slice(1, -1).join(" "),
        lastName: parts[parts.length - 1],
    }
}

function getErrorMessage(error: unknown, fallback: string) {
    if (typeof error === "object" && error !== null && "message" in error) {
        const maybeMessage = (error as { message?: unknown }).message
        if (typeof maybeMessage === "string" && maybeMessage.trim()) {
            return maybeMessage
        }
    }
    return fallback
}

function normalizeMobile(input: string) {
    const raw = input.trim()
    const cleaned = raw.replace(/[^\d+]/g, "")
    return cleaned
}

function buildDisplayName(firstName: string, middleName: string, lastName: string) {
    return [firstName, middleName, lastName].map((s) => s.trim()).filter(Boolean).join(" ")
}

type ProfileDraft = {
    firstName: string
    middleName: string
    lastName: string
    studentId: string
    mobileNumber: string
    departmentId: string
    smsUpdates: boolean
}

function readDraft(): ProfileDraft | null {
    if (typeof window === "undefined") return null
    try {
        const raw = localStorage.getItem(DRAFT_KEY)
        if (!raw) return null
        return JSON.parse(raw) as ProfileDraft
    } catch {
        return null
    }
}

function writeDraft(draft: ProfileDraft) {
    if (typeof window === "undefined") return
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

function clearDraftStorage() {
    if (typeof window === "undefined") return
    localStorage.removeItem(DRAFT_KEY)
}

export default function StudentProfilePage() {
    const navigate = useNavigate()

    const diagnosticsShownRef = React.useRef({
        depts404: false,
        session404: false,
    })

    const initialLockedDept = participantAuthStorage.getDepartmentId() || ""
    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [loadingSession, setLoadingSession] = React.useState(true)
    const [busyLogout, setBusyLogout] = React.useState(false)
    const [busySaveOnline, setBusySaveOnline] = React.useState(false)

    const [departments, setDepartments] = React.useState<Department[]>([])
    const [participantType, setParticipantType] = React.useState<string>("STUDENT")
    const [sessionExpiresAt, setSessionExpiresAt] = React.useState<string>("")
    const [hasSession, setHasSession] = React.useState(false)

    // 🔒 lock immediately from storage to prevent a brief “editable” state before session loads
    const [lockedDepartmentId, setLockedDepartmentId] = React.useState<string>(initialLockedDept)
    const [firstName, setFirstName] = React.useState("")
    const [middleName, setMiddleName] = React.useState("")
    const [lastName, setLastName] = React.useState("")
    const [studentId, setStudentId] = React.useState("")
    const [mobileNumber, setMobileNumber] = React.useState("")
    const [departmentId, setDepartmentId] = React.useState(initialLockedDept)
    const [smsUpdates, setSmsUpdates] = React.useState(true)

    const isDepartmentLocked = Boolean(lockedDepartmentId)

    const selectedDept = React.useMemo(
        () => departments.find((d) => d._id === departmentId) || null,
        [departments, departmentId]
    )

    const applyDraft = React.useCallback(() => {
        const draft = readDraft()
        if (!draft) return

        setFirstName(draft.firstName || "")
        setMiddleName(draft.middleName || "")
        setLastName(draft.lastName || "")
        setStudentId(draft.studentId || "")
        setMobileNumber(draft.mobileNumber || "")
        setDepartmentId(draft.departmentId || "")
        setSmsUpdates(Boolean(draft.smsUpdates))
    }, [])

    const loadDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await studentApi.listDepartments()
            setDepartments(res.departments ?? [])
        } catch (e: any) {
            if (e instanceof ApiError && e.status === 404 && !diagnosticsShownRef.current.depts404) {
                diagnosticsShownRef.current.depts404 = true
                toast.error("Departments endpoint not found (404).", {
                    description: e.message,
                })
            } else {
                toast.error(e?.message ?? "Failed to load departments.")
            }
            setDepartments([])
        } finally {
            setLoadingDepts(false)
        }
    }, [])

    const loadSession = React.useCallback(async () => {
        setLoadingSession(true)
        try {
            const res = await guestApi.getSession()
            const p = res?.participant as Record<string, unknown> | null | undefined

            setSessionExpiresAt(pickNonEmptyString(res?.session?.expiresAt))
            setHasSession(Boolean(p))

            if (p) {
                const rawType = pickNonEmptyString((p as any).type)
                if (rawType) setParticipantType(rawType)

                const explicitFirstName = pickNonEmptyString((p as any).firstName)
                const explicitMiddleName = pickNonEmptyString((p as any).middleName)
                const explicitLastName = pickNonEmptyString((p as any).lastName)

                if (explicitFirstName || explicitLastName) {
                    if (explicitFirstName) setFirstName(explicitFirstName)
                    if (explicitMiddleName) setMiddleName(explicitMiddleName)
                    if (explicitLastName) setLastName(explicitLastName)
                } else {
                    const composed = splitName(pickNonEmptyString((p as any).name))
                    if (composed.firstName) setFirstName(composed.firstName)
                    if (composed.middleName) setMiddleName(composed.middleName)
                    if (composed.lastName) setLastName(composed.lastName)
                }

                const sid = pickNonEmptyString((p as any).tcNumber) || pickNonEmptyString((p as any).studentId)
                if (sid) setStudentId(sid)

                const mobile = pickNonEmptyString((p as any).mobileNumber) || pickNonEmptyString((p as any).phone)
                if (mobile) setMobileNumber(mobile)

                const deptIdFromProfile = pickDepartmentIdFromParticipant(p)
                const deptLockedFlag = Boolean((res as any)?.departmentLocked)

                // 🔒 Department is locked after registration:
                // lock if backend says so OR if we can read department from profile OR if we already have a stored lock
                const storedLock = participantAuthStorage.getDepartmentId() || ""
                const shouldLock = deptLockedFlag || Boolean(deptIdFromProfile) || Boolean(storedLock)

                if (deptIdFromProfile) {
                    setDepartmentId(deptIdFromProfile)
                    participantAuthStorage.setDepartmentId(deptIdFromProfile)
                }

                if (shouldLock) {
                    const effective = deptIdFromProfile || storedLock || departmentId || ""
                    setLockedDepartmentId(effective || LOCK_SENTINEL)
                    if (effective) setDepartmentId(effective)
                } else {
                    setLockedDepartmentId("")
                    participantAuthStorage.clearDepartmentId()
                }

                if (typeof (p as any).smsUpdates === "boolean") {
                    setSmsUpdates(Boolean((p as any).smsUpdates))
                }
            } else {
                setLockedDepartmentId("")
                participantAuthStorage.clearDepartmentId()
            }
        } catch (err) {
            if (err instanceof ApiError && err.status === 404 && !diagnosticsShownRef.current.session404) {
                diagnosticsShownRef.current.session404 = true
                toast.error("Session endpoint not found (404).", {
                    description: err.message,
                })
            }

            setHasSession(false)
            setLockedDepartmentId("")
            participantAuthStorage.clearDepartmentId()
        } finally {
            setLoadingSession(false)
        }
    }, [departmentId])

    React.useEffect(() => {
        applyDraft()
        void loadDepartments()
        void loadSession()
    }, [applyDraft, loadDepartments, loadSession])

    const handleDepartmentChange = React.useCallback(
        (value: string) => {
            if (loadingSession) {
                toast.message("Loading your session…")
                return
            }
            if (isDepartmentLocked) {
                toast.message("Department is locked after registration.")
                return
            }
            setDepartmentId(value)
        },
        [isDepartmentLocked, loadingSession]
    )

    function onSaveDraft() {
        const effectiveLocked =
            lockedDepartmentId && lockedDepartmentId !== LOCK_SENTINEL ? lockedDepartmentId : participantAuthStorage.getDepartmentId() || ""

        const payload: ProfileDraft = {
            firstName: firstName.trim(),
            middleName: middleName.trim(),
            lastName: lastName.trim(),
            studentId: studentId.trim(),
            mobileNumber: mobileNumber.trim(),
            departmentId: isDepartmentLocked ? effectiveLocked : departmentId,
            smsUpdates,
        }
        writeDraft(payload)
        toast.success("Profile draft saved locally.")
    }

    function onClearDraft() {
        clearDraftStorage()

        setFirstName("")
        setMiddleName("")
        setLastName("")
        setStudentId("")
        setMobileNumber("")
        setDepartmentId(isDepartmentLocked ? (participantAuthStorage.getDepartmentId() || "") : "")
        setSmsUpdates(true)

        if (hasSession) {
            void loadSession()
            toast.success("Profile draft cleared. Restored from session.")
            return
        }

        toast.success("Profile draft cleared.")
    }

    const getParticipantAuthHeaders = React.useCallback(() => {
        const token = participantAuthStorage.getToken()
        if (!token) return null
        return { Authorization: `Bearer ${token}` }
    }, [])

    const updateProfileOnline = React.useCallback(
        async (payload: Record<string, unknown>) => {
            const headers = getParticipantAuthHeaders()
            if (!headers) throw new Error("Not logged in. Please login again.")

            const candidates = ["/public/auth/session", "/public/auth/me", "/public/auth/profile"]

            let lastErr: unknown = null

            for (const url of candidates) {
                try {
                    return await api.patch<Record<string, unknown>>(url, payload, {
                        auth: false,
                        headers,
                    })
                } catch (err) {
                    lastErr = err
                    if (err instanceof ApiError && err.status === 404) continue
                    throw err
                }
            }

            const tried = candidates.join(", ")
            if (lastErr instanceof ApiError && lastErr.status === 404) {
                throw new ApiError(
                    `All profile update endpoints returned 404. Tried: ${tried}. Most likely your backend publicRoutes router is mounted differently than your frontend API base. Make sure Express exposes PATCH on /api/public/auth/session (or add route aliases). Last: ${lastErr.message}`,
                    404,
                    { tried: candidates, last: lastErr.data },
                    { method: "PATCH", path: candidates[candidates.length - 1], url: lastErr.url }
                )
            }

            throw lastErr ?? new Error(`Profile update endpoint not found. Tried: ${tried}`)
        },
        [getParticipantAuthHeaders]
    )

    async function onSaveOnline() {
        const f = firstName.trim()
        const m = middleName.trim()
        const l = lastName.trim()
        const sid = studentId.trim()

        const effectiveLocked =
            lockedDepartmentId && lockedDepartmentId !== LOCK_SENTINEL ? lockedDepartmentId : participantAuthStorage.getDepartmentId() || ""

        const dept = (isDepartmentLocked ? effectiveLocked : departmentId).trim()
        const mobile = normalizeMobile(mobileNumber)

        if (!f) return toast.error("First name is required.")
        if (!l) return toast.error("Last name is required.")
        if (!sid) return toast.error("Student ID / TC Number is required.")
        if (!mobile) return toast.error("Mobile number is required.")
        if (!dept) return toast.error("Department is required.")

        setBusySaveOnline(true)
        const toastId = toast.loading("Saving profile online…")

        try {
            const name = buildDisplayName(f, m, l)

            const payload: Record<string, unknown> = {
                type: participantType || "STUDENT",
                firstName: f,
                middleName: m || undefined,
                lastName: l,
                name,
                tcNumber: sid,
                studentId: sid,
                mobileNumber: mobile,
                phone: mobile,
                departmentId: dept,
                smsUpdates,
            }

            const result = await updateProfileOnline(payload)

            // 🔒 If backend reports locked, persist lock immediately
            if (Boolean((result as any)?.departmentLocked) && dept) {
                participantAuthStorage.setDepartmentId(dept)
                setLockedDepartmentId(dept)
                setDepartmentId(dept)
            }

            // Optional: show a friendly message if an attempted department change was ignored by backend
            if (Boolean((result as any)?.departmentChangeIgnored)) {
                toast.message("Department change ignored (locked after registration).", { id: toastId })
            }

            clearDraftStorage()
            await loadSession()

            toast.success("Profile saved online.", { id: toastId })
        } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
                toast.error("Profile save failed: API endpoint not found (404).", {
                    id: toastId,
                    description: error.message,
                })
            } else {
                toast.error(getErrorMessage(error, "Failed to save profile online."), { id: toastId })
            }
        } finally {
            setBusySaveOnline(false)
        }
    }

    async function onRefreshSession() {
        await loadSession()
        toast.message("Session refreshed.")
    }

    async function onLogout() {
        setBusyLogout(true)
        try {
            await guestApi.logout()
            toast.success("Logged out.")
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to logout.")
        } finally {
            setHasSession(false)
            setSessionExpiresAt("")
            setBusyLogout(false)
            setLockedDepartmentId("")
            setDepartmentId("")
            if (!participantAuthStorage.getToken()) {
                navigate("/login", { replace: true })
            }
        }
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full  px-4 py-10">
                <div className="mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-2">
                            <User className="h-3.5 w-3.5" />
                            Profile
                        </Badge>
                        <Badge variant="outline">Type: {participantType || "STUDENT"}</Badge>
                        <Badge variant={hasSession ? "default" : "secondary"}>
                            Session: {hasSession ? "Active" : "Not Active"}
                        </Badge>
                        {isDepartmentLocked ? (
                            <Badge variant="outline" className="gap-2">
                                <Lock className="h-3.5 w-3.5" />
                                Department locked
                            </Badge>
                        ) : null}
                        {selectedDept?.name ? <Badge variant="outline">{selectedDept.name}</Badge> : null}
                    </div>

                    <h1 className="mt-3 text-2xl font-semibold tracking-tight">My Profile</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Manage your profile details. Department is locked after registration to prevent abuse/spam and
                        ensure correct routing.
                    </p>
                </div>

                <div className="grid gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Details</CardTitle>
                            <CardDescription>Edit fields and save online (recommended) or keep a local draft.</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-5">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="First name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="middleName">Middle Name</Label>
                                    <Input
                                        id="middleName"
                                        value={middleName}
                                        onChange={(e) => setMiddleName(e.target.value)}
                                        placeholder="Middle name"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="Last name"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="studentId">Student ID / TC Number</Label>
                                    <Input
                                        id="studentId"
                                        value={studentId}
                                        onChange={(e) => setStudentId(e.target.value)}
                                        placeholder="e.g. TC-20-A-00001"
                                        autoComplete="off"
                                        inputMode="text"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="mobileNumber">Mobile Number</Label>
                                    <Input
                                        id="mobileNumber"
                                        value={mobileNumber}
                                        onChange={(e) => setMobileNumber(e.target.value)}
                                        placeholder="e.g. 09xxxxxxxxx"
                                        autoComplete="tel"
                                        inputMode="tel"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label>Department</Label>
                                    {isDepartmentLocked ? (
                                        <Badge variant="secondary" className="gap-2">
                                            <Lock className="h-3.5 w-3.5" />
                                            Locked
                                        </Badge>
                                    ) : null}
                                </div>

                                {loadingDepts ? (
                                    <Skeleton className="h-10 w-full" />
                                ) : (
                                    <Select
                                        value={departmentId}
                                        onValueChange={handleDepartmentChange}
                                        disabled={loadingSession || isDepartmentLocked || busySaveOnline}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder={loadingSession ? "Loading session..." : "Select department"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {departments.map((d) => (
                                                <SelectItem key={d._id} value={d._id}>
                                                    {d.name}
                                                    {d.code ? ` (${d.code})` : ""}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {loadingSession ? (
                                    <div className="text-xs text-muted-foreground">Checking your registered department…</div>
                                ) : isDepartmentLocked ? (
                                    <div className="text-xs text-muted-foreground">
                                        Your department is locked after registration. Contact staff if it needs correction.
                                    </div>
                                ) : (
                                    <div className="text-xs text-muted-foreground">
                                        Choose the correct department for queue routing.
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <Switch id="smsUpdates" checked={smsUpdates} onCheckedChange={(v) => setSmsUpdates(Boolean(v))} />
                                <Label htmlFor="smsUpdates">Receive SMS updates</Label>
                            </div>

                            <Separator />

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button type="button" variant="outline" onClick={onClearDraft} disabled={busySaveOnline}>
                                    Clear Draft
                                </Button>
                                <Button type="button" variant="secondary" onClick={onSaveDraft} disabled={busySaveOnline}>
                                    Save Draft
                                </Button>
                                <Button type="button" onClick={() => void onSaveOnline()} disabled={busySaveOnline}>
                                    {busySaveOnline ? "Saving…" : "Save Online"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Session</CardTitle>
                            <CardDescription>Participant session status and quick actions.</CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                            {loadingSession ? (
                                <Skeleton className="h-16 w-full" />
                            ) : (
                                <div className="rounded-lg border p-4 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">Status:</span>{" "}
                                        <span className="font-medium">{hasSession ? "Active" : "Not active"}</span>
                                    </div>
                                    <div className="mt-1">
                                        <span className="text-muted-foreground">Expires:</span>{" "}
                                        <span className="font-medium">{sessionExpiresAt || "—"}</span>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <Button type="button" variant="outline" onClick={() => void onRefreshSession()}>
                                    Refresh Session
                                </Button>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button type="button" variant="secondary" disabled={busyLogout}>
                                            {busyLogout ? "Please wait…" : "Logout"}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Logout from this session?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                You will be signed out from your current participant session on this device.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={busyLogout}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => void onLogout()} disabled={busyLogout}>
                                                {busyLogout ? "Logging out…" : "Confirm Logout"}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>

            <Footer variant="student" />
        </div>
    )
}