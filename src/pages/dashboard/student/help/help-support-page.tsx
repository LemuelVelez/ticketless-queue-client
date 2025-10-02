/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { useAuth } from "@/contexts/AuthContext"

import { AppSidebar } from "@/components/student-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

import {
    LifeBuoy,
    HelpCircle,
    Mail,
    Phone,
    MessageSquare,
    Search,
    Send,
    Paperclip,
    Bug,
    BookOpen,
    ExternalLink,
    CheckCircle2,
    XCircle,
    Loader2,
} from "lucide-react"

import { mockStudent, type StudentData } from "@/data/mock-students"

/** ---------------- Types & Helpers ---------------- */
type TicketStatus = "Open" | "In Progress" | "Resolved" | "Closed"
type TicketCategory = "Account" | "Queue" | "Notifications" | "Technical" | "Other"
type SupportTicket = {
    id: string
    subject: string
    category: TicketCategory
    description: string
    status: TicketStatus
    createdAt: string
}

const getStudentDataById = (_id: string): StudentData => mockStudent

const CATEGORY_OPTIONS: TicketCategory[] = ["Account", "Queue", "Notifications", "Technical", "Other"]

function statusBadgeClasses(status: TicketStatus) {
    switch (status) {
        case "Resolved":
            return "bg-green-100 text-green-800 border-green-200"
        case "In Progress":
            return "bg-blue-100 text-blue-800 border-blue-200"
        case "Closed":
            return "bg-gray-100 text-gray-800 border-gray-200"
        default:
            return "bg-amber-100 text-amber-800 border-amber-200"
    }
}

/** ---------------- Component ---------------- */
export default function HelpSupportPage() {
    const navigate = useNavigate()
    const { isAuthenticated, studentId } = useAuth()
    const [student, setStudent] = useState<StudentData>(() =>
        studentId ? getStudentDataById(studentId) : mockStudent,
    )

    // Auth guard
    useEffect(() => {
        if (!isAuthenticated || !studentId) {
            navigate("/login")
            return
        }
    }, [isAuthenticated, studentId, navigate])

    // Local storage for tickets
    const TICKETS_KEY = studentId ? `support_tickets_${studentId}` : "support_tickets_guest"
    const [tickets, setTickets] = useState<SupportTicket[]>(() => {
        try {
            const raw = localStorage.getItem(TICKETS_KEY)
            return raw ? (JSON.parse(raw) as SupportTicket[]) : []
        } catch {
            return []
        }
    })

    useEffect(() => {
        if (!studentId) return
        try {
            localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets))
        } catch {
            /* ignore */
        }
    }, [tickets, studentId])

    // Load student info
    useEffect(() => {
        if (!studentId) return
        const data = getStudentDataById(studentId)
        setStudent(data)
    }, [studentId])

    // Form state
    const [subject, setSubject] = useState("")
    const [category, setCategory] = useState<TicketCategory>("Queue")
    const [description, setDescription] = useState("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // FAQ state (now shown with shadcn Accordion)
    const [faqQuery, setFaqQuery] = useState("")
    const faqs = useMemo(
        () => [
            {
                q: "How do I join a service queue?",
                a: "Go to Join Queue, choose a service point, and enter your mobile number starting with 9 (10 digits). You’ll receive an orderly queue number and SMS updates.",
            },
            {
                q: "Why must my mobile number start with 9?",
                a: "The app formats Philippine mobile numbers as +63 followed by 10 digits beginning with 9 for consistency with SMS notifications.",
            },
            {
                q: "Can I join multiple queues at the same time?",
                a: "No. To keep things fair and manageable, you can only have one active queue at a time.",
            },
            {
                q: "How do I cancel my current queue?",
                a: "Open My Queue and tap ‘Cancel Queue’. Your history will keep a record marked as Cancelled.",
            },
            {
                q: "I am not getting SMS updates.",
                a: "Check that your number is correct in Account Settings. Ensure signal is available. If the issue persists, open a Technical ticket in Help & Support.",
            },
            {
                q: "How do I update my profile or password?",
                a: "Navigate to Account Settings to update profile details and change your password.",
            },
        ],
        [],
    )
    const filteredFaqs = useMemo(() => {
        const q = faqQuery.trim().toLowerCase()
        if (!q) return faqs
        return faqs.filter(
            (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q),
        )
    }, [faqs, faqQuery])

    if (!isAuthenticated || !studentId) {
        return null
    }

    /** ---------- Actions ---------- */
    const submitTicket = async () => {
        if (!subject.trim() || !description.trim()) {
            toast.error("Please fill in the subject and description.")
            return
        }
        setIsSubmitting(true)
        try {
            await new Promise((r) => setTimeout(r, 900))
            const newTicket: SupportTicket = {
                id: String(Date.now()),
                subject: subject.trim(),
                category,
                description: description.trim(),
                status: "Open",
                createdAt: new Date().toISOString(),
            }
            setTickets((prev) => [newTicket, ...prev])
            setSubject("")
            setCategory("Queue")
            setDescription("")
            toast.success("Support ticket submitted. We’ll reach out via email/SMS.")
        } catch {
            toast.error("Could not submit ticket, please try again.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const updateStatus = (id: string, next: TicketStatus) => {
        setTickets((prev) =>
            prev.map((t) => (t.id === id ? { ...t, status: next } : t)),
        )
        toast.info(`Ticket marked as ${next}.`)
    }

    const removeTicket = (id: string) => {
        setTickets((prev) => prev.filter((t) => t.id !== id))
        toast.success("Ticket removed.")
    }

    /** ---------- UI ---------- */
    return (
        <SidebarProvider>
            <AppSidebar currentPage="help" />
            <SidebarInset>
                <SiteHeader />
                {/* Vertical layout on mobile by default; 2 columns from md+ */}
                <main className="flex flex-1 flex-col gap-6 p-4 lg:gap-8 lg:p-6">
                    {/* Page header */}
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                            <LifeBuoy className="h-7 w-7 text-blue-600" />
                            Help &amp; Support
                        </h1>
                        <p className="text-muted-foreground">
                            Find answers, contact us, or file a ticket. We’re here to help.
                        </p>
                    </div>

                    {/* Top grid: stacks vertically on mobile, side-by-side on md+ */}
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card className="border-2 border-blue-100">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <HelpCircle className="h-5 w-5" />
                                    Contact Options
                                </CardTitle>
                                <CardDescription>Reach us with any urgent or general concerns.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border p-3 gap-3">
                                    <div className="flex items-center gap-3">
                                        <Mail className="h-4 w-4 text-blue-600" />
                                        <div>
                                            <p className="font-medium">Email Support</p>
                                            <p className="text-muted-foreground">support@jrmsu.edu.ph</p>
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="bg-transparent cursor-pointer"
                                        onClick={() => navigator.clipboard.writeText("support@jrmsu.edu.ph")}
                                    >
                                        Copy
                                    </Button>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border p-3 gap-3">
                                    <div className="flex items-center gap-3">
                                        <Phone className="h-4 w-4 text-green-600" />
                                        <div>
                                            <p className="font-medium">Hotline</p>
                                            <p className="text-muted-foreground">(+63) 999-123-4567</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" className="bg-transparent cursor-pointer" asChild>
                                        <a href="tel:+639991234567">Call</a>
                                    </Button>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border p-3 gap-3">
                                    <div className="flex items-center gap-3">
                                        <MessageSquare className="h-4 w-4 text-purple-600" />
                                        <div>
                                            <p className="font-medium">Live Chat</p>
                                            <p className="text-muted-foreground">Available soon</p>
                                        </div>
                                    </div>
                                    <Button variant="secondary" disabled className="cursor-pointer">
                                        Coming soon
                                    </Button>
                                </div>

                                <p className="text-xs text-muted-foreground">
                                    Office hours: Mon–Fri, 8:00 AM – 5:00 PM (GMT+8)
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-2 border-emerald-100">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BookOpen className="h-5 w-5" />
                                    Quick Guides
                                </CardTitle>
                                <CardDescription>Helpful links to get you moving fast.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 text-sm">
                                <a className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-md border p-3 hover:bg-emerald-50 transition"
                                    href="/join-queue">
                                    <div className="flex items-center gap-2">
                                        <ExternalLink className="h-4 w-4" />
                                        <span>Join a Queue</span>
                                    </div>
                                    <Badge variant="outline" className="w-fit sm:w-auto mt-2 sm:mt-0">Start here</Badge>
                                </a>
                                <a className="flex items-center justify-between rounded-md border p-3 hover:bg-emerald-50 transition"
                                    href="/my-queue">
                                    <div className="flex items-center gap-2">
                                        <ExternalLink className="h-4 w-4" />
                                        <span>Track My Queue</span>
                                    </div>
                                </a>
                                <a className="flex items-center justify-between rounded-md border p-3 hover:bg-emerald-50 transition"
                                    href="/queue-history">
                                    <div className="flex items-center gap-2">
                                        <ExternalLink className="h-4 w-4" />
                                        <span>View Queue History</span>
                                    </div>
                                </a>
                                <a className="flex items-center justify-between rounded-md border p-3 hover:bg-emerald-50 transition"
                                    href="/notifications">
                                    <div className="flex items-center gap-2">
                                        <ExternalLink className="h-4 w-4" />
                                        <span>Manage Notifications</span>
                                    </div>
                                </a>
                                <a className="flex items-center justify-between rounded-md border p-3 hover:bg-emerald-50 transition"
                                    href="/settings">
                                    <div className="flex items-center gap-2">
                                        <ExternalLink className="h-4 w-4" />
                                        <span>Update Account Settings</span>
                                    </div>
                                </a>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Submit a ticket */}
                    <Card className="border-2 border-purple-100">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bug className="h-5 w-5" />
                                File a Support Ticket
                            </CardTitle>
                            <CardDescription>Tell us what happened and we’ll assist you.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="subject">Subject <span className="text-red-500">*</span></Label>
                                    <Input
                                        id="subject"
                                        placeholder="e.g., Not receiving SMS notifications"
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="category">Category</Label>
                                    <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
                                        <SelectTrigger id="category" className="cursor-pointer">
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {CATEGORY_OPTIONS.map((c) => (
                                                <SelectItem key={c} value={c} className="cursor-pointer">
                                                    {c}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="desc">Description <span className="text-red-500">*</span></Label>
                                {/* Using native textarea to avoid assuming a custom Textarea component exists */}
                                <textarea
                                    id="desc"
                                    rows={5}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Please include steps to reproduce, any error messages, and what you expected to happen."
                                    className="w-full rounded-md border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                                />
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="text-xs text-muted-foreground">
                                    Submitting as <span className="font-medium">{student.name}</span> ({student.email})
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" className="gap-2 bg-transparent cursor-pointer" disabled>
                                        <Paperclip className="h-4 w-4" />
                                        Attach file (soon)
                                    </Button>
                                    <Button
                                        type="button"
                                        className="gap-2 cursor-pointer"
                                        onClick={submitTicket}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                        Submit Ticket
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* FAQ with shadcn Accordion (vertical on mobile) */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Search className="h-5 w-5" />
                                Frequently Asked Questions
                            </CardTitle>
                            <CardDescription>Search common questions before filing a ticket.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Search
                                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <Input
                                    placeholder="Search FAQs..."
                                    className="pl-9"
                                    value={faqQuery}
                                    onChange={(e) => setFaqQuery(e.target.value)}
                                />
                            </div>

                            {filteredFaqs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No results. Try a different keyword.</p>
                            ) : (
                                <Accordion type="multiple" className="w-full">
                                    {filteredFaqs.map((f, idx) => (
                                        <AccordionItem key={idx} value={`item-${idx}`}>
                                            <AccordionTrigger className="cursor-pointer text-left">{f.q}</AccordionTrigger>
                                            <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            )}
                        </CardContent>
                    </Card>

                    {/* My tickets */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MessageSquare className="h-5 w-5" />
                                My Support Tickets
                            </CardTitle>
                            <CardDescription>Track your submitted tickets and their status.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {tickets.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                                    <div className="rounded-full bg-gray-100 p-4">
                                        <LifeBuoy className="h-10 w-10 text-gray-400" />
                                    </div>
                                    <p className="text-sm text-muted-foreground">No tickets yet. Submit one above to get started.</p>
                                </div>
                            ) : (
                                tickets.map((t) => (
                                    <div
                                        key={t.id}
                                        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-md border p-4"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium">{t.subject}</p>
                                                <Badge variant="outline" className="capitalize">{t.category}</Badge>
                                                <Badge variant="outline" className={statusBadgeClasses(t.status)}>{t.status}</Badge>
                                            </div>
                                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                                            <p className="mt-1 text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2">
                                            {t.status !== "Resolved" && (
                                                <Button
                                                    variant="outline"
                                                    className="bg-transparent gap-2 cursor-pointer"
                                                    onClick={() => updateStatus(t.id, "Resolved")}
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                    Resolve
                                                </Button>
                                            )}
                                            {t.status !== "Closed" && (
                                                <Button
                                                    variant="ghost"
                                                    className="text-red-600 gap-2 cursor-pointer"
                                                    onClick={() => updateStatus(t.id, "Closed")}
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                    Close
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                className="text-muted-foreground cursor-pointer"
                                                onClick={() => removeTicket(t.id)}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>

                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <Separator className="hidden sm:block w-6" />
                        <p>
                            Tips: Keep your phone nearby for SMS alerts. For urgent matters, call the hotline.
                        </p>
                    </div>
                </main>
            </SidebarInset>
        </SidebarProvider>
    )
}
