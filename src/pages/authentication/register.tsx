import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import LoadingPage from "@/pages/loading"

import { guestApi, participantAuthStorage, type Department } from "@/api/guest"
import { useSession } from "@/hooks/use-session"
import { ApiError } from "@/lib/http"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import logo from "@/assets/images/logo.svg"
import heroImage from "@/assets/images/heroImage.svg"

type AppRole = "ADMIN" | "STAFF" | "STUDENT"

type StudentFormState = {
    firstName: string
    middleName: string
    lastName: string
    tcNumber: string
    departmentId: string
    mobileNumber: string
    pin: string
    confirmPin: string
}

function normalizeRole(raw: unknown): AppRole | null {
    const value = String(raw ?? "").trim().toUpperCase()
    if (value === "ADMIN") return "ADMIN"
    if (value === "STAFF") return "STAFF"
    if (value === "STUDENT") return "STUDENT"
    return null
}

function defaultDashboardPath(role: AppRole) {
    if (role === "ADMIN") return "/admin/dashboard"
    if (role === "STAFF") return "/staff/dashboard"
    return "/student/home"
}

async function resolveRoleFromSession(): Promise<AppRole | null> {
    try {
        const session = await guestApi.getSession()
        return normalizeRole(session?.participant?.type)
    } catch {
        return null
    }
}

function normalizeOptional(value: string) {
    const v = value.trim()
    return v ? v : undefined
}

function normalizePin(value: string) {
    return value.replace(/\D+/g, "").slice(0, 4)
}

function isFourDigitPin(pin: string) {
    return /^\d{4}$/.test(pin)
}

function composeName(firstName: string, middleName: string, lastName: string) {
    return [firstName, middleName, lastName]
        .map((x) => x.trim())
        .filter(Boolean)
        .join(" ")
}

function PasswordInput({
    id,
    value,
    disabled,
    placeholder,
    autoComplete,
    show,
    onToggleShow,
    onChange,
    inputMode,
    maxLength,
}: {
    id: string
    value: string
    disabled: boolean
    placeholder?: string
    autoComplete?: string
    show: boolean
    onToggleShow: () => void
    onChange: (value: string) => void
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"]
    maxLength?: number
}) {
    return (
        <div className="relative">
            <Input
                id={id}
                type={show ? "text" : "password"}
                value={value}
                placeholder={placeholder}
                autoComplete={autoComplete}
                required
                disabled={disabled}
                className="pr-10"
                onChange={(e) => onChange(e.target.value)}
                inputMode={inputMode}
                maxLength={maxLength}
            />
            <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onToggleShow}
                disabled={disabled}
                aria-label={show ? "Hide PIN" : "Show PIN"}
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
        </div>
    )
}

export default function RegisterPage() {
    const navigate = useNavigate()
    const { user, loading } = useSession()

    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [showPin, setShowPin] = React.useState(false)
    const [showConfirmPin, setShowConfirmPin] = React.useState(false)

    const [departments, setDepartments] = React.useState<Department[]>([])
    const [loadingDepartments, setLoadingDepartments] = React.useState(true)

    const [student, setStudent] = React.useState<StudentFormState>({
        firstName: "",
        middleName: "",
        lastName: "",
        tcNumber: "",
        departmentId: "",
        mobileNumber: "",
        pin: "",
        confirmPin: "",
    })

    React.useEffect(() => {
        if (loading) return

        if (user) {
            const role = normalizeRole((user as any)?.role) ?? "STAFF"
            navigate(defaultDashboardPath(role), { replace: true })
            return
        }

        const participantToken = participantAuthStorage.getToken()
        if (!participantToken) return

        let alive = true

        ;(async () => {
            const role = await resolveRoleFromSession()
            if (!alive) return

            if (role !== "STUDENT") {
                participantAuthStorage.clearToken()
                return
            }

            navigate(defaultDashboardPath("STUDENT"), { replace: true })
        })()

        return () => {
            alive = false
        }
    }, [loading, user, navigate])

    React.useEffect(() => {
        let mounted = true

        ;(async () => {
            try {
                const res = await guestApi.listDepartments()
                if (!mounted) return

                const list = Array.isArray(res.departments) ? res.departments : []
                setDepartments(list)

                const firstId = list[0]?._id ?? ""
                setStudent((prev) => ({
                    ...prev,
                    departmentId: prev.departmentId || firstId,
                }))
            } catch (err) {
                const message =
                    err instanceof ApiError
                        ? err.message
                        : err instanceof Error
                            ? err.message
                            : "Failed to load departments"
                toast.error(message)
            } finally {
                if (mounted) setLoadingDepartments(false)
            }
        })()

        return () => {
            mounted = false
        }
    }, [])

    async function submitStudent(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (isSubmitting) return

        const firstName = student.firstName.trim()
        const middleName = student.middleName.trim()
        const lastName = student.lastName.trim()
        const tcNumber = student.tcNumber.trim()
        const departmentId = student.departmentId.trim()
        const mobileNumber = student.mobileNumber.trim()
        const pin = student.pin
        const confirmPin = student.confirmPin

        if (!firstName) {
            toast.error("Please enter first name.")
            return
        }

        if (!lastName) {
            toast.error("Please enter last name.")
            return
        }

        if (!tcNumber) {
            toast.error("Please enter TC Number.")
            return
        }

        if (!departmentId) {
            toast.error("Please select department.")
            return
        }

        if (!mobileNumber) {
            toast.error("Please enter mobile number.")
            return
        }

        if (!isFourDigitPin(pin)) {
            toast.error("PIN must be exactly 4 digits.")
            return
        }

        if (!isFourDigitPin(confirmPin)) {
            toast.error("Confirm PIN must be exactly 4 digits.")
            return
        }

        if (pin !== confirmPin) {
            toast.error("PIN does not match.")
            return
        }

        setIsSubmitting(true)

        try {
            await guestApi.signupStudent({
                firstName,
                middleName: normalizeOptional(middleName),
                lastName,
                name: composeName(firstName, middleName, lastName),
                tcNumber,
                departmentId,
                mobileNumber,
                pin,
                // aliases for compatibility
                studentId: tcNumber,
                phone: mobileNumber,
                password: pin,
            })

            const role = (await resolveRoleFromSession()) ?? "STUDENT"
            if (role !== "STUDENT") {
                participantAuthStorage.clearToken()
                toast.error("Unauthorized role. Please contact the administrator.")
                return
            }

            toast.success("Student account created. You are now signed in.")
            navigate(defaultDashboardPath("STUDENT"), { replace: true })
        } catch (err) {
            const message =
                err instanceof ApiError
                    ? err.message
                    : err instanceof Error
                        ? err.message
                        : "Could not create account"
            toast.error(message)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (loading) return <LoadingPage />

    return (
        <div className="grid min-h-svh lg:grid-cols-2">
            {/* Left: form */}
            <div className="flex flex-col gap-6 p-6 md:p-10">
                <div className="flex items-center justify-center md:justify-start">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-card">
                            <img src={logo} alt="QueuePass logo" className="h-10 w-10" />
                        </div>
                        <div className="leading-tight">
                            <div className="text-sm font-semibold">QueuePass</div>
                            <div className="text-muted-foreground text-xs">Ticketless QR Queue</div>
                        </div>
                    </Link>
                </div>

                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-sm">
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-2xl">Create student account</CardTitle>
                                <CardDescription>
                                    Register once, then sign in using your TC Number + 4-digit PIN.
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <form noValidate onSubmit={submitStudent} className="space-y-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="studentFirstName">First name</Label>
                                        <Input
                                            id="studentFirstName"
                                            placeholder="Juan"
                                            autoComplete="given-name"
                                            required
                                            disabled={isSubmitting}
                                            value={student.firstName}
                                            onChange={(e) =>
                                                setStudent((prev) => ({
                                                    ...prev,
                                                    firstName: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="studentMiddleName">Middle name (optional)</Label>
                                        <Input
                                            id="studentMiddleName"
                                            placeholder="Santos"
                                            autoComplete="additional-name"
                                            disabled={isSubmitting}
                                            value={student.middleName}
                                            onChange={(e) =>
                                                setStudent((prev) => ({
                                                    ...prev,
                                                    middleName: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="studentLastName">Last name</Label>
                                        <Input
                                            id="studentLastName"
                                            placeholder="Dela Cruz"
                                            autoComplete="family-name"
                                            required
                                            disabled={isSubmitting}
                                            value={student.lastName}
                                            onChange={(e) =>
                                                setStudent((prev) => ({
                                                    ...prev,
                                                    lastName: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="studentTcNumber">TC Number</Label>
                                        <Input
                                            id="studentTcNumber"
                                            placeholder="e.g. TC-2024-12345"
                                            autoComplete="username"
                                            required
                                            disabled={isSubmitting}
                                            value={student.tcNumber}
                                            onChange={(e) =>
                                                setStudent((prev) => ({
                                                    ...prev,
                                                    tcNumber: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="studentDepartment">Department</Label>
                                        <Select
                                            value={student.departmentId}
                                            onValueChange={(value) =>
                                                setStudent((prev) => ({
                                                    ...prev,
                                                    departmentId: value,
                                                }))
                                            }
                                            disabled={isSubmitting || loadingDepartments || departments.length === 0}
                                        >
                                            <SelectTrigger id="studentDepartment">
                                                <SelectValue
                                                    placeholder={
                                                        loadingDepartments
                                                            ? "Loading departments..."
                                                            : "Select department"
                                                    }
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {loadingDepartments ? (
                                                    <SelectItem value="__loading_departments" disabled>
                                                        Loading departments...
                                                    </SelectItem>
                                                ) : departments.length === 0 ? (
                                                    <SelectItem value="__no_departments" disabled>
                                                        No departments available
                                                    </SelectItem>
                                                ) : (
                                                    departments.map((d) => (
                                                        <SelectItem key={d._id} value={d._id}>
                                                            {d.code ? `${d.code} - ${d.name}` : d.name}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="studentMobile">Mobile number</Label>
                                        <Input
                                            id="studentMobile"
                                            type="tel"
                                            placeholder="+63 9XX XXX XXXX"
                                            autoComplete="tel"
                                            required
                                            disabled={isSubmitting}
                                            value={student.mobileNumber}
                                            onChange={(e) =>
                                                setStudent((prev) => ({
                                                    ...prev,
                                                    mobileNumber: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="studentPin">PIN (4 digits)</Label>
                                        <PasswordInput
                                            id="studentPin"
                                            value={student.pin}
                                            disabled={isSubmitting}
                                            autoComplete="new-password"
                                            placeholder="4-digit PIN"
                                            show={showPin}
                                            onToggleShow={() => setShowPin((s) => !s)}
                                            inputMode="numeric"
                                            maxLength={4}
                                            onChange={(value) =>
                                                setStudent((prev) => ({
                                                    ...prev,
                                                    pin: normalizePin(value),
                                                }))
                                            }
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="studentConfirmPin">Confirm PIN</Label>
                                        <PasswordInput
                                            id="studentConfirmPin"
                                            value={student.confirmPin}
                                            disabled={isSubmitting}
                                            autoComplete="new-password"
                                            placeholder="Repeat 4-digit PIN"
                                            show={showConfirmPin}
                                            onToggleShow={() => setShowConfirmPin((s) => !s)}
                                            inputMode="numeric"
                                            maxLength={4}
                                            onChange={(value) =>
                                                setStudent((prev) => ({
                                                    ...prev,
                                                    confirmPin: normalizePin(value),
                                                }))
                                            }
                                        />
                                    </div>

                                    <Button className="w-full" type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? "Creating account..." : "Create account"}
                                    </Button>
                                </form>
                            </CardContent>

                            <CardFooter className="flex flex-col gap-3">
                                <p className="text-muted-foreground text-center text-sm">
                                    Already have an account?{" "}
                                    <Link to="/login" className="text-foreground underline-offset-4 hover:underline">
                                        Sign in
                                    </Link>
                                </p>

                                <p className="text-muted-foreground text-balance text-center text-xs">
                                    By creating an account, you agree to our{" "}
                                    <Link to="/terms" className="underline-offset-4 hover:underline">
                                        Terms
                                    </Link>{" "}
                                    and{" "}
                                    <Link to="/privacy" className="underline-offset-4 hover:underline">
                                        Privacy Policy
                                    </Link>
                                    .
                                </p>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>

            {/* Right: illustration */}
            <div className="bg-muted relative hidden lg:block">
                <div className="absolute inset-0 bg-linear-to-br from-primary/15 via-background to-muted" />
                <div className="relative flex h-svh flex-col items-center justify-center p-10">
                    <div className="w-full max-w-lg">
                        <Card className="border-border/60 bg-background/70 overflow-hidden backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-xl">Skip the queue, not your turn</CardTitle>
                                <CardDescription>
                                    Register once and easily join queues, track status updates, and get called with confidence.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-xl border bg-card p-4">
                                    <img
                                        src={heroImage}
                                        alt="QueuePass hero illustration"
                                        className="max-h-102.75 w-full rounded-lg object-contain"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}