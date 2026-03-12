import * as React from "react"
import * as Tabs from "@radix-ui/react-tabs"
import { Link, useNavigate } from "react-router-dom"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

import LoadingPage from "@/pages/loading"

import { API_PATHS } from "@/api/api"
import { useSession } from "@/hooks/use-session"
import {
    clearParticipantSession,
    getParticipantStorage,
    getParticipantToken,
    getParticipantUser,
    setParticipantSession,
    setParticipantUser,
    type StoredParticipantUser,
} from "@/lib/auth"
import { api, ApiError } from "@/lib/http"
import { cn } from "@/lib/utils"

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

type RegisterTab = "student" | "alumniVisitor"
type ParticipantRole = "STUDENT" | "ALUMNI_VISITOR" | "GUEST"

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

type AlumniVisitorFormState = {
    firstName: string
    middleName: string
    lastName: string
    departmentId: string
    mobileNumber: string
    pin: string
    confirmPin: string
}

type DepartmentOption = {
    id: string
    name: string
    code?: string
}

type RegisterResponse = Record<string, unknown> | null

function defaultDashboardPath(role: "ADMIN" | "STAFF") {
    return role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard"
}

function defaultParticipantPath(role: ParticipantRole) {
    return role === "STUDENT" ? "/student/home" : "/alumni/home"
}

function normalizeParticipantRole(raw: unknown): ParticipantRole | null {
    const value = String(raw ?? "")
        .trim()
        .toUpperCase()

    if (value === "STUDENT") return "STUDENT"
    if (value === "ALUMNI_VISITOR" || value === "ALUMNI-VISITOR")
        return "ALUMNI_VISITOR"
    if (value === "GUEST" || value === "VISITOR") return "GUEST"
    return null
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

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") return null
    const clean = value.trim()
    return clean ? clean : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value)
}

function normalizeDepartmentOption(value: unknown): DepartmentOption | null {
    if (!isRecord(value)) return null

    const id =
        normalizeString(value._id) ??
        normalizeString(value.id) ??
        normalizeString(value.departmentId)

    const name =
        normalizeString(value.name) ??
        normalizeString(value.departmentName) ??
        normalizeString(value.label)

    if (!id || !name) return null

    const code =
        normalizeString(value.code) ??
        normalizeString(value.departmentCode) ??
        undefined

    return {
        id,
        name,
        ...(code ? { code } : {}),
    }
}

function extractDepartments(value: unknown): DepartmentOption[] {
    const candidates: unknown[] = []

    if (Array.isArray(value)) {
        candidates.push(value)
    }

    if (isRecord(value)) {
        candidates.push(
            value.departments,
            value.items,
            value.rows,
            value.results,
            value.list
        )
    }

    for (const candidate of candidates) {
        if (!Array.isArray(candidate)) continue

        const list = candidate
            .map(normalizeDepartmentOption)
            .filter((item): item is DepartmentOption => !!item)

        if (list.length) return list
    }

    return []
}

function extractToken(value: unknown): string | null {
    if (!isRecord(value)) return null

    const direct =
        normalizeString(value.token) ??
        normalizeString(value.accessToken) ??
        normalizeString(value.sessionToken)

    if (direct) return direct

    if (isRecord(value.session)) {
        return (
            normalizeString(value.session.token) ??
            normalizeString(value.session.accessToken) ??
            normalizeString(value.session.sessionToken)
        )
    }

    return null
}

function extractParticipantRecord(value: unknown): StoredParticipantUser | null {
    const source = (() => {
        if (!isRecord(value)) return null

        if (isRecord(value.participant)) return value.participant
        if (isRecord(value.user)) return value.user
        if (isRecord(value.account)) return value.account
        return value
    })()

    if (!source) return null

    const id =
        normalizeString(source.id) ??
        normalizeString(source._id) ??
        undefined

    const type =
        normalizeString(source.type) ??
        normalizeString(source.participantType) ??
        normalizeString(source.role) ??
        undefined

    const composedName =
        composeName(
            normalizeString(source.firstName) ?? "",
            normalizeString(source.middleName) ?? "",
            normalizeString(source.lastName) ?? ""
        ) || undefined

    const name = normalizeString(source.name) ?? composedName

    const firstName = normalizeString(source.firstName) ?? undefined
    const middleName = normalizeString(source.middleName) ?? undefined
    const lastName = normalizeString(source.lastName) ?? undefined
    const tcNumber =
        normalizeString(source.tcNumber) ??
        normalizeString(source.studentId) ??
        undefined
    const studentId =
        normalizeString(source.studentId) ??
        normalizeString(source.tcNumber) ??
        undefined
    const mobileNumber =
        normalizeString(source.mobileNumber) ??
        normalizeString(source.phone) ??
        undefined
    const phone =
        normalizeString(source.phone) ??
        normalizeString(source.mobileNumber) ??
        undefined
    const departmentId =
        normalizeString(source.departmentId) ??
        normalizeString(source.assignedDepartment) ??
        undefined
    const departmentCode =
        normalizeString(source.departmentCode) ??
        normalizeString(source.assignedDepartmentCode) ??
        undefined

    const participant: StoredParticipantUser = {}

    if (id) participant.id = id
    if (type) participant.type = type
    if (name) participant.name = name
    if (firstName) participant.firstName = firstName
    if (middleName) participant.middleName = middleName
    if (lastName) participant.lastName = lastName
    if (tcNumber) participant.tcNumber = tcNumber
    if (studentId) participant.studentId = studentId
    if (mobileNumber) participant.mobileNumber = mobileNumber
    if (phone) participant.phone = phone
    if (departmentId) participant.departmentId = departmentId
    if (departmentCode) participant.departmentCode = departmentCode

    return Object.keys(participant).length ? participant : null
}

function resolveParticipantRoleFromStorage(): ParticipantRole | null {
    const stored = getParticipantUser()

    const direct =
        normalizeParticipantRole(stored?.type) ??
        normalizeParticipantRole((stored as Record<string, unknown> | null)?.role)

    if (direct) return direct

    if (stored?.studentId || stored?.tcNumber) return "STUDENT"

    return null
}

function persistParticipantDepartment(departmentId: string) {
    const rememberMe = getParticipantStorage() !== "session"
    const existing = getParticipantUser()

    if (existing || getParticipantToken()) {
        setParticipantUser(
            {
                ...(existing ?? {}),
                departmentId,
            },
            rememberMe
        )
    }
}

function persistParticipantAuthFromResponse(
    value: unknown,
    fallbackRole: ParticipantRole,
    departmentId: string
): ParticipantRole | null {
    const token = extractToken(value)
    const participant = extractParticipantRecord(value)

    const role =
        normalizeParticipantRole(participant?.type) ??
        (isRecord(value)
            ? normalizeParticipantRole(value.type) ??
              normalizeParticipantRole(value.participantType) ??
              normalizeParticipantRole(value.role)
            : null) ??
        fallbackRole

    const rememberMe = true

    if (token) {
        setParticipantSession(
            token,
            {
                ...(participant ?? {}),
                type: participant?.type ?? role,
                departmentId: participant?.departmentId ?? departmentId,
            },
            rememberMe
        )
        return role
    }

    if (participant) {
        setParticipantUser(
            {
                ...participant,
                type: participant.type ?? role,
                departmentId: participant.departmentId ?? departmentId,
            },
            rememberMe
        )
    }

    return role
}

async function loadDepartments() {
    const res = await api.getData<unknown>(API_PATHS.departments.enabled, {
        auth: false,
    })
    return extractDepartments(res)
}

async function registerParticipant(
    payload: Record<string, unknown>
): Promise<RegisterResponse> {
    return api.postData<RegisterResponse>(API_PATHS.auth.register, payload, {
        auth: false,
    })
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
                {show ? (
                    <EyeOff className="h-4 w-4" />
                ) : (
                    <Eye className="h-4 w-4" />
                )}
            </Button>
        </div>
    )
}

export default function RegisterPage() {
    const navigate = useNavigate()
    const { user, loading } = useSession()

    const [tab, setTab] = React.useState<RegisterTab>("student")
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const [showStudentPin, setShowStudentPin] = React.useState(false)
    const [showStudentConfirmPin, setShowStudentConfirmPin] =
        React.useState(false)
    const [showVisitorPin, setShowVisitorPin] = React.useState(false)
    const [showVisitorConfirmPin, setShowVisitorConfirmPin] =
        React.useState(false)

    const [departments, setDepartments] = React.useState<DepartmentOption[]>([])
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

    const [visitor, setVisitor] = React.useState<AlumniVisitorFormState>({
        firstName: "",
        middleName: "",
        lastName: "",
        departmentId: "",
        mobileNumber: "",
        pin: "",
        confirmPin: "",
    })

    React.useEffect(() => {
        if (loading) return

        if (user) {
            navigate(defaultDashboardPath(user.role), { replace: true })
            return
        }

        const participantToken = getParticipantToken()
        if (!participantToken) return

        const role = resolveParticipantRoleFromStorage()

        if (!role) {
            clearParticipantSession()
            return
        }

        navigate(defaultParticipantPath(role), { replace: true })
    }, [loading, user, navigate])

    React.useEffect(() => {
        let mounted = true

        ;(async () => {
            try {
                const list = await loadDepartments()
                if (!mounted) return

                setDepartments(list)

                const firstId = list[0]?.id ?? ""
                setStudent((prev) => ({
                    ...prev,
                    departmentId: prev.departmentId || firstId,
                }))
                setVisitor((prev) => ({
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
            const response = await registerParticipant({
                type: "STUDENT",
                participantType: "STUDENT",
                role: "STUDENT",
                firstName,
                middleName: normalizeOptional(middleName),
                lastName,
                name: composeName(firstName, middleName, lastName),
                tcNumber,
                studentId: tcNumber,
                departmentId,
                mobileNumber,
                phone: mobileNumber,
                pin,
                password: pin,
                confirmPin,
            })

            const role =
                persistParticipantAuthFromResponse(
                    response,
                    "STUDENT",
                    departmentId
                ) ?? "STUDENT"

            persistParticipantDepartment(departmentId)

            if (getParticipantToken()) {
                toast.success("Student account created.")
                navigate(defaultParticipantPath(role), { replace: true })
                return
            }

            toast.success("Student account created. Please sign in.")
            navigate("/login", { replace: true })
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

    async function submitVisitor(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        if (isSubmitting) return

        const firstName = visitor.firstName.trim()
        const middleName = visitor.middleName.trim()
        const lastName = visitor.lastName.trim()
        const departmentId = visitor.departmentId.trim()
        const mobileNumber = visitor.mobileNumber.trim()
        const pin = visitor.pin
        const confirmPin = visitor.confirmPin

        if (!firstName) {
            toast.error("Please enter first name.")
            return
        }

        if (!lastName) {
            toast.error("Please enter last name.")
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
            const response = await registerParticipant({
                type: "ALUMNI_VISITOR",
                participantType: "ALUMNI_VISITOR",
                role: "ALUMNI_VISITOR",
                firstName,
                middleName: normalizeOptional(middleName),
                lastName,
                name: composeName(firstName, middleName, lastName),
                departmentId,
                mobileNumber,
                phone: mobileNumber,
                pin,
                password: pin,
                confirmPin,
            })

            const role =
                persistParticipantAuthFromResponse(
                    response,
                    "ALUMNI_VISITOR",
                    departmentId
                ) ?? "ALUMNI_VISITOR"

            persistParticipantDepartment(departmentId)

            if (getParticipantToken()) {
                toast.success("Alumni/Visitor account created.")
                navigate(defaultParticipantPath(role), { replace: true })
                return
            }

            toast.success("Alumni/Visitor account created. Please sign in.")
            navigate("/login", { replace: true })
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
            <div className="flex flex-col gap-6 p-6 md:p-10">
                <div className="flex items-center justify-center md:justify-start">
                    <Link to="/" className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-card">
                            <img
                                src={logo}
                                alt="QueuePass logo"
                                className="h-10 w-10"
                            />
                        </div>
                        <div className="leading-tight">
                            <div className="text-sm font-semibold">
                                QueuePass
                            </div>
                            <div className="text-muted-foreground text-xs">
                                Ticketless QR Queue
                            </div>
                        </div>
                    </Link>
                </div>

                <div className="flex flex-1 items-center justify-center">
                    <div className="w-full max-w-sm">
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-2xl">
                                    Create account
                                </CardTitle>
                            </CardHeader>

                            <CardContent>
                                <Tabs.Root
                                    value={tab}
                                    onValueChange={(value) =>
                                        setTab(value as RegisterTab)
                                    }
                                    className="w-full"
                                >
                                    <Tabs.List className="bg-muted grid h-10 w-full grid-cols-2 rounded-lg p-1">
                                        <Tabs.Trigger
                                            value="student"
                                            className={cn(
                                                "inline-flex items-center justify-center rounded-md px-3 text-sm font-medium transition",
                                                "text-muted-foreground hover:text-foreground",
                                                "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                                            )}
                                        >
                                            Student
                                        </Tabs.Trigger>
                                        <Tabs.Trigger
                                            value="alumniVisitor"
                                            className={cn(
                                                "inline-flex items-center justify-center rounded-md px-3 text-sm font-medium transition",
                                                "text-muted-foreground hover:text-foreground",
                                                "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
                                            )}
                                        >
                                            Alumni / Visitor
                                        </Tabs.Trigger>
                                    </Tabs.List>

                                    <Tabs.Content
                                        value="student"
                                        className="mt-4 outline-none"
                                    >
                                        <form
                                            noValidate
                                            onSubmit={submitStudent}
                                            className="space-y-4"
                                        >
                                            <div className="grid gap-2">
                                                <Label htmlFor="studentFirstName">
                                                    First name
                                                </Label>
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
                                                            firstName:
                                                                e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="studentMiddleName">
                                                    Middle name (optional)
                                                </Label>
                                                <Input
                                                    id="studentMiddleName"
                                                    placeholder="Santos"
                                                    autoComplete="additional-name"
                                                    disabled={isSubmitting}
                                                    value={student.middleName}
                                                    onChange={(e) =>
                                                        setStudent((prev) => ({
                                                            ...prev,
                                                            middleName:
                                                                e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="studentLastName">
                                                    Last name
                                                </Label>
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
                                                            lastName:
                                                                e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="studentTcNumber">
                                                    TC Number
                                                </Label>
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
                                                            tcNumber:
                                                                e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="studentDepartment">
                                                    Department
                                                </Label>
                                                <Select
                                                    value={student.departmentId}
                                                    onValueChange={(value) =>
                                                        setStudent((prev) => ({
                                                            ...prev,
                                                            departmentId: value,
                                                        }))
                                                    }
                                                    disabled={
                                                        isSubmitting ||
                                                        loadingDepartments ||
                                                        departments.length === 0
                                                    }
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
                                                            <SelectItem
                                                                value="__loading_departments"
                                                                disabled
                                                            >
                                                                Loading
                                                                departments...
                                                            </SelectItem>
                                                        ) : departments.length ===
                                                          0 ? (
                                                            <SelectItem
                                                                value="__no_departments"
                                                                disabled
                                                            >
                                                                No departments
                                                                available
                                                            </SelectItem>
                                                        ) : (
                                                            departments.map(
                                                                (d) => (
                                                                    <SelectItem
                                                                        key={
                                                                            d.id
                                                                        }
                                                                        value={
                                                                            d.id
                                                                        }
                                                                    >
                                                                        {d.code
                                                                            ? `${d.code} - ${d.name}`
                                                                            : d.name}
                                                                    </SelectItem>
                                                                )
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="studentMobile">
                                                    Mobile number
                                                </Label>
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
                                                            mobileNumber:
                                                                e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="studentPin">
                                                    PIN (4 digits)
                                                </Label>
                                                <PasswordInput
                                                    id="studentPin"
                                                    value={student.pin}
                                                    disabled={isSubmitting}
                                                    autoComplete="new-password"
                                                    placeholder="4-digit PIN"
                                                    show={showStudentPin}
                                                    onToggleShow={() =>
                                                        setShowStudentPin(
                                                            (s) => !s
                                                        )
                                                    }
                                                    inputMode="numeric"
                                                    maxLength={4}
                                                    onChange={(value) =>
                                                        setStudent((prev) => ({
                                                            ...prev,
                                                            pin: normalizePin(
                                                                value
                                                            ),
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="studentConfirmPin">
                                                    Confirm PIN
                                                </Label>
                                                <PasswordInput
                                                    id="studentConfirmPin"
                                                    value={student.confirmPin}
                                                    disabled={isSubmitting}
                                                    autoComplete="new-password"
                                                    placeholder="Repeat 4-digit PIN"
                                                    show={
                                                        showStudentConfirmPin
                                                    }
                                                    onToggleShow={() =>
                                                        setShowStudentConfirmPin(
                                                            (s) => !s
                                                        )
                                                    }
                                                    inputMode="numeric"
                                                    maxLength={4}
                                                    onChange={(value) =>
                                                        setStudent((prev) => ({
                                                            ...prev,
                                                            confirmPin:
                                                                normalizePin(
                                                                    value
                                                                ),
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <Button
                                                className="w-full"
                                                type="submit"
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting
                                                    ? "Creating account..."
                                                    : "Create student account"}
                                            </Button>
                                        </form>
                                    </Tabs.Content>

                                    <Tabs.Content
                                        value="alumniVisitor"
                                        className="mt-4 outline-none"
                                    >
                                        <form
                                            noValidate
                                            onSubmit={submitVisitor}
                                            className="space-y-4"
                                        >
                                            <div className="grid gap-2">
                                                <Label htmlFor="visitorFirstName">
                                                    First name
                                                </Label>
                                                <Input
                                                    id="visitorFirstName"
                                                    placeholder="Maria"
                                                    autoComplete="given-name"
                                                    required
                                                    disabled={isSubmitting}
                                                    value={visitor.firstName}
                                                    onChange={(e) =>
                                                        setVisitor((prev) => ({
                                                            ...prev,
                                                            firstName:
                                                                e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="visitorMiddleName">
                                                    Middle name (optional)
                                                </Label>
                                                <Input
                                                    id="visitorMiddleName"
                                                    placeholder="Reyes"
                                                    autoComplete="additional-name"
                                                    disabled={isSubmitting}
                                                    value={visitor.middleName}
                                                    onChange={(e) =>
                                                        setVisitor((prev) => ({
                                                            ...prev,
                                                            middleName:
                                                                e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="visitorLastName">
                                                    Last name
                                                </Label>
                                                <Input
                                                    id="visitorLastName"
                                                    placeholder="Santos"
                                                    autoComplete="family-name"
                                                    required
                                                    disabled={isSubmitting}
                                                    value={visitor.lastName}
                                                    onChange={(e) =>
                                                        setVisitor((prev) => ({
                                                            ...prev,
                                                            lastName:
                                                                e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="visitorDepartment">
                                                    Department
                                                </Label>
                                                <Select
                                                    value={visitor.departmentId}
                                                    onValueChange={(value) =>
                                                        setVisitor((prev) => ({
                                                            ...prev,
                                                            departmentId: value,
                                                        }))
                                                    }
                                                    disabled={
                                                        isSubmitting ||
                                                        loadingDepartments ||
                                                        departments.length === 0
                                                    }
                                                >
                                                    <SelectTrigger id="visitorDepartment">
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
                                                            <SelectItem
                                                                value="__loading_departments"
                                                                disabled
                                                            >
                                                                Loading
                                                                departments...
                                                            </SelectItem>
                                                        ) : departments.length ===
                                                          0 ? (
                                                            <SelectItem
                                                                value="__no_departments"
                                                                disabled
                                                            >
                                                                No departments
                                                                available
                                                            </SelectItem>
                                                        ) : (
                                                            departments.map(
                                                                (d) => (
                                                                    <SelectItem
                                                                        key={
                                                                            d.id
                                                                        }
                                                                        value={
                                                                            d.id
                                                                        }
                                                                    >
                                                                        {d.code
                                                                            ? `${d.code} - ${d.name}`
                                                                            : d.name}
                                                                    </SelectItem>
                                                                )
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="visitorMobile">
                                                    Mobile number
                                                </Label>
                                                <Input
                                                    id="visitorMobile"
                                                    type="tel"
                                                    placeholder="+63 9XX XXX XXXX"
                                                    autoComplete="tel"
                                                    required
                                                    disabled={isSubmitting}
                                                    value={visitor.mobileNumber}
                                                    onChange={(e) =>
                                                        setVisitor((prev) => ({
                                                            ...prev,
                                                            mobileNumber:
                                                                e.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="visitorPin">
                                                    PIN (4 digits)
                                                </Label>
                                                <PasswordInput
                                                    id="visitorPin"
                                                    value={visitor.pin}
                                                    disabled={isSubmitting}
                                                    autoComplete="new-password"
                                                    placeholder="4-digit PIN"
                                                    show={showVisitorPin}
                                                    onToggleShow={() =>
                                                        setShowVisitorPin(
                                                            (s) => !s
                                                        )
                                                    }
                                                    inputMode="numeric"
                                                    maxLength={4}
                                                    onChange={(value) =>
                                                        setVisitor((prev) => ({
                                                            ...prev,
                                                            pin: normalizePin(
                                                                value
                                                            ),
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <div className="grid gap-2">
                                                <Label htmlFor="visitorConfirmPin">
                                                    Confirm PIN
                                                </Label>
                                                <PasswordInput
                                                    id="visitorConfirmPin"
                                                    value={visitor.confirmPin}
                                                    disabled={isSubmitting}
                                                    autoComplete="new-password"
                                                    placeholder="Repeat 4-digit PIN"
                                                    show={
                                                        showVisitorConfirmPin
                                                    }
                                                    onToggleShow={() =>
                                                        setShowVisitorConfirmPin(
                                                            (s) => !s
                                                        )
                                                    }
                                                    inputMode="numeric"
                                                    maxLength={4}
                                                    onChange={(value) =>
                                                        setVisitor((prev) => ({
                                                            ...prev,
                                                            confirmPin:
                                                                normalizePin(
                                                                    value
                                                                ),
                                                        }))
                                                    }
                                                />
                                            </div>

                                            <Button
                                                className="w-full"
                                                type="submit"
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting
                                                    ? "Creating account..."
                                                    : "Create alumni/visitor account"}
                                            </Button>
                                        </form>
                                    </Tabs.Content>
                                </Tabs.Root>
                            </CardContent>

                            <CardFooter className="flex flex-col gap-3">
                                <p className="text-muted-foreground text-center text-sm">
                                    Already have an account?{" "}
                                    <Link
                                        to="/login"
                                        className="text-foreground underline-offset-4 hover:underline"
                                    >
                                        Sign in
                                    </Link>
                                </p>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </div>

            <div className="bg-muted relative hidden lg:block">
                <div className="absolute inset-0 bg-linear-to-br from-primary/15 via-background to-muted" />
                <div className="relative flex h-svh flex-col items-center justify-center p-10">
                    <div className="w-full max-w-lg">
                        <Card className="border-border/60 bg-background/70 overflow-hidden backdrop-blur">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-xl">
                                    Skip the queue, not your turn
                                </CardTitle>
                                <CardDescription>
                                    Register once and easily join queues, track
                                    status updates, and get called with
                                    confidence.
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