/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"

import { AppSidebar } from "@/components/student-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import {
    User,
    Mail,
    Phone as PhoneIcon,
    Save,
    Undo2,
    Shield,
    Trash2,
    Upload,
    Eye,
    EyeOff,
} from "lucide-react"

import { mockStudent, type StudentData } from "@/data/mock-students"

/** ----------------- Helpers ------------------ */

// Simulate fetching student data based on ID
const getStudentDataById = (_id: string): StudentData => {
    return mockStudent
}

// Keep the first '9' immovable and ensure 10 digits after +63
const normalizeWithLeading9 = (value: string) => {
    let d = value.replace(/\D/g, "")
    if (d.startsWith("63")) d = d.slice(2)
    if (d.startsWith("0")) d = d.slice(1)
    if (!d.startsWith("9")) d = "9" + d
    if (d.length > 10) d = d.slice(0, 10)
    if (d.length < 1) d = "9"
    return d
}

const preventDeletingLeadingNine = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget
    const start = input.selectionStart ?? 0
    const end = input.selectionEnd ?? 0

    if (
        (e.key === "Backspace" && start <= 1 && end <= 1) ||
        (e.key === "Delete" && start === 0) ||
        (start === 0 && end > 0 && (e.key === "Backspace" || e.key === "Delete" || e.key.length === 1))
    ) {
        e.preventDefault()
    }
}

/** --------------- Component ------------------ */

export default function AccountSettingsPage() {
    const navigate = useNavigate()
    const { isAuthenticated, studentId } = useAuth()

    // Local storage key (per user)
    const PROFILE_KEY = studentId ? `account_profile_${studentId}` : "account_profile_guest"

    const [student, setStudent] = useState<StudentData>(() =>
        studentId ? getStudentDataById(studentId) : mockStudent,
    )

    // Profile state
    const [displayName, setDisplayName] = useState<string>("")
    const [email, setEmail] = useState<string>("")
    const [phone, setPhone] = useState<string>("9") // 10-digit, starts with 9
    const [avatarDataUrl, setAvatarDataUrl] = useState<string>("") // uploaded image (data URL)

    // Security form (client-side mock)
    const [currentPw, setCurrentPw] = useState("")
    const [newPw, setNewPw] = useState("")
    const [confirmPw, setConfirmPw] = useState("")
    const [showCurrent, setShowCurrent] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)

    // Auth guard
    useEffect(() => {
        if (!isAuthenticated || !studentId) {
            navigate("/login")
        }
    }, [isAuthenticated, studentId, navigate])

    // Initialize from localStorage or defaults
    useEffect(() => {
        if (!studentId) return
        const data = getStudentDataById(studentId)
        setStudent(data)

        try {
            const savedProfile = localStorage.getItem(PROFILE_KEY)
            if (savedProfile) {
                const p = JSON.parse(savedProfile)
                setDisplayName(p.displayName ?? data.name)
                setEmail(p.email ?? data.email)
                setPhone(p.phone ?? "9")
                setAvatarDataUrl(p.avatarDataUrl ?? "")
            } else {
                setDisplayName(data.name)
                setEmail(data.email)
                setPhone("9")
                setAvatarDataUrl("") // none yet
            }
        } catch {
            setDisplayName(data.name)
            setEmail(data.email)
            setPhone("9")
            setAvatarDataUrl("")
        }
    }, [studentId])

    if (!isAuthenticated || !studentId) {
        return null
    }

    const phoneValid = /^9\d{9}$/.test(phone)
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const displayNameValid = displayName.trim().length > 1

    /** -------- Profile actions -------- */
    const saveProfile = () => {
        if (!displayNameValid) return toast.error("Please enter your full name.")
        if (!emailValid) return toast.error("Please enter a valid email.")
        if (!phoneValid) return toast.error("Mobile must be 10 digits after +63 and start with 9.")

        const payload = {
            displayName: displayName.trim(),
            email: email.trim(),
            phone,
            avatarDataUrl,
        }
        try {
            localStorage.setItem(PROFILE_KEY, JSON.stringify(payload))
            toast.success("Profile saved.")
        } catch {
            toast.error("Failed to save profile locally.")
        }
    }

    const resetProfile = () => {
        const data = getStudentDataById(studentId!)
        setDisplayName(data.name)
        setEmail(data.email)
        setPhone("9")
        setAvatarDataUrl("")
        toast.info("Profile reset.")
    }

    // Upload avatar
    const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.")
            return
        }
        const maxMB = 5
        if (file.size > maxMB * 1024 * 1024) {
            toast.error(`Image too large. Max ${maxMB}MB.`)
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            setAvatarDataUrl(String(reader.result || ""))
            toast.success("Profile picture loaded. Tap ‘Save Profile’ to persist.")
        }
        reader.readAsDataURL(file)
    }

    const removeAvatar = () => {
        setAvatarDataUrl("")
        toast.info("Profile picture removed. Tap ‘Save Profile’ to persist.")
    }

    /** -------- Security -------- */
    const changePassword = () => {
        if (newPw.length < 8) return toast.error("New password must be at least 8 characters.")
        if (newPw !== confirmPw) return toast.error("New password and confirmation do not match.")
        // Mock only (no backend)
        setCurrentPw("")
        setNewPw("")
        setConfirmPw("")
        toast.success("Password updated (demo).")
    }

    return (
        <SidebarProvider>
            <AppSidebar currentPage="settings" />
            <SidebarInset>
                <SiteHeader />
                <main className="flex flex-1 flex-col gap-6 p-4 lg:gap-8 lg:p-6">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
                        <p className="text-muted-foreground">
                            Manage your profile, contact details, and password.
                        </p>
                    </div>

                    {/* Profile */}
                    <Card className="border-2 border-blue-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Profile
                            </CardTitle>
                            <CardDescription>Basic information tied to your student account.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                                <div className="flex w-full max-w-sm flex-col items-center gap-3 sm:w-auto">
                                    <Avatar className="h-20 w-20">
                                        <AvatarImage
                                            src={avatarDataUrl || student.avatar || "/placeholder.svg"}
                                            alt={displayName || "Profile picture"}
                                        />
                                        <AvatarFallback>
                                            {(displayName || "NA")
                                                .split(" ")
                                                .map((n) => n[0])
                                                .join("")
                                                .slice(0, 2)
                                                .toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="flex w-full flex-col sm:flex-row gap-2">
                                        {/* Upload */}
                                        <label htmlFor="avatar-upload" className="inline-flex w-full sm:w-auto">
                                            <input
                                                id="avatar-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={onPickAvatar}
                                            />
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                className="gap-2 w-full sm:w-auto"
                                            >
                                                <Upload className="h-4 w-4" />
                                                Upload picture
                                            </Button>
                                        </label>

                                        {/* Remove */}
                                        {avatarDataUrl && (
                                            <Button
                                                variant="outline"
                                                type="button"
                                                className="gap-2 bg-transparent w-full sm:w-auto"
                                                onClick={removeAvatar}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                Remove
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid w-full gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="displayName">Full Name</Label>
                                        <Input
                                            id="displayName"
                                            value={displayName}
                                            onChange={(e) => setDisplayName(e.target.value)}
                                            placeholder="e.g., Juan Dela Cruz"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="studentId">Student ID</Label>
                                        <Input id="studentId" value={student.id} readOnly />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email" className="flex items-center gap-2">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            Email
                                        </Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="you@example.com"
                                        />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <Label htmlFor="phone" className="flex items-center gap-2">
                                            <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                                            Mobile Number <span className="text-red-500">*</span>
                                        </Label>
                                        <div className="flex">
                                            <span className="inline-flex items-center px-3 text-sm text-gray-900 bg-gray-200 border border-r-0 border-gray-300 rounded-l-md select-none">
                                                +63
                                            </span>
                                            <Input
                                                id="phone"
                                                type="tel"
                                                inputMode="numeric"
                                                maxLength={10}
                                                pattern="^9\\d{9}$"
                                                placeholder="9XX XXX XXXX"
                                                value={phone}
                                                onChange={(e) => setPhone(normalizeWithLeading9(e.target.value))}
                                                onKeyDown={preventDeletingLeadingNine}
                                                required
                                                className="rounded-l-none"
                                                aria-label="Philippine mobile number starting with 9"
                                                title="+63 followed by 10 digits starting with 9"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            We’ll use this for SMS updates about your queue.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                        {/* Buttons: full width on mobile, right-aligned on larger screens */}
                        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button
                                variant="outline"
                                type="button"
                                className="gap-2 bg-transparent w-full sm:w-auto"
                                onClick={resetProfile}
                            >
                                <Undo2 className="h-4 w-4" />
                                Reset
                            </Button>
                            <Button
                                type="button"
                                className="gap-2 w-full sm:w-auto"
                                onClick={saveProfile}
                                disabled={!displayNameValid || !emailValid || !phoneValid}
                            >
                                <Save className="h-4 w-4" />
                                Save Profile
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Security */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Security
                            </CardTitle>
                            <CardDescription>Update your password to keep your account secure.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="currentPw">Current Password</Label>
                                <div className="relative">
                                    <Input
                                        id="currentPw"
                                        type={showCurrent ? "text" : "password"}
                                        value={currentPw}
                                        onChange={(e) => setCurrentPw(e.target.value)}
                                        placeholder="••••••••"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        aria-label={showCurrent ? "Hide current password" : "Show current password"}
                                        onClick={() => setShowCurrent((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                                    >
                                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="newPw">New Password (min 8 chars)</Label>
                                <div className="relative">
                                    <Input
                                        id="newPw"
                                        type={showNew ? "text" : "password"}
                                        value={newPw}
                                        onChange={(e) => setNewPw(e.target.value)}
                                        placeholder="••••••••"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        aria-label={showNew ? "Hide new password" : "Show new password"}
                                        onClick={() => setShowNew((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                                    >
                                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2 sm:col-span-2">
                                <Label htmlFor="confirmPw">Confirm New Password</Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPw"
                                        type={showConfirm ? "text" : "password"}
                                        value={confirmPw}
                                        onChange={(e) => setConfirmPw(e.target.value)}
                                        placeholder="••••••••"
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                                        onClick={() => setShowConfirm((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                                    >
                                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </CardContent>
                        {/* Button: full width on mobile */}
                        <CardFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
                            <Button
                                type="button"
                                className="gap-2 w-full sm:w-auto"
                                onClick={changePassword}
                                disabled={newPw.length < 8 || newPw !== confirmPw}
                            >
                                <Save className="h-4 w-4" />
                                Update Password
                            </Button>
                        </CardFooter>
                    </Card>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
