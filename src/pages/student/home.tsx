/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { toast } from "sonner"
import { Home, QrCode, Monitor, Maximize2 } from "lucide-react"

import Header from "@/components/Header"
import Footer from "@/components/Footer"

import { studentApi, type Department } from "@/api/student"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function pickNonEmptyString(v: unknown) {
    return typeof v === "string" && v.trim() ? v.trim() : ""
}

export default function StudentHomePage() {
    const location = useLocation()

    const qs = React.useMemo(() => new URLSearchParams(location.search || ""), [location.search])
    const preDeptId = React.useMemo(() => pickNonEmptyString(qs.get("departmentId")), [qs])

    const [loadingDepts, setLoadingDepts] = React.useState(true)
    const [departments, setDepartments] = React.useState<Department[]>([])
    const [departmentId, setDepartmentId] = React.useState<string>("")

    const selectedDept = React.useMemo(
        () => departments.find((d) => d._id === departmentId) || null,
        [departments, departmentId],
    )

    const loadDepartments = React.useCallback(async () => {
        setLoadingDepts(true)
        try {
            const res = await studentApi.listDepartments()
            const list = res.departments ?? []
            setDepartments(list)

            const canUsePre = preDeptId && list.some((d) => d._id === preDeptId)
            const next = canUsePre ? preDeptId : list[0]?._id ?? ""
            setDepartmentId((prev) => prev || next)
        } catch (e: any) {
            toast.error(e?.message ?? "Failed to load departments.")
            setDepartments([])
            setDepartmentId("")
        } finally {
            setLoadingDepts(false)
        }
    }, [preDeptId])

    React.useEffect(() => {
        void loadDepartments()
    }, [loadDepartments])

    const joinUrl = React.useMemo(() => {
        if (!departmentId) return "/join"
        return `/join?departmentId=${encodeURIComponent(departmentId)}`
    }, [departmentId])

    const displayUrl = React.useMemo(() => {
        if (!departmentId) return "/display"
        return `/display?departmentId=${encodeURIComponent(departmentId)}`
    }, [departmentId])

    const presentUrl = React.useMemo(() => {
        if (!departmentId) return "/display?present=1"
        return `/display?departmentId=${encodeURIComponent(departmentId)}&present=1`
    }, [departmentId])

    return (
        <div className="min-h-screen bg-background text-foreground">
            <Header variant="student" />

            <main className="mx-auto w-full max-w-4xl px-4 py-10">
                <div className="mb-6">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-2">
                            <Home className="h-3.5 w-3.5" />
                            Student
                        </Badge>
                        {selectedDept?.name ? <Badge variant="outline">{selectedDept.name}</Badge> : null}
                    </div>

                    <h1 className="mt-3 text-2xl font-semibold tracking-tight">Student Portal</h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Select your department, then join the queue or view the live public display.
                    </p>
                </div>

                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <QrCode className="h-5 w-5" />
                            Quick Start
                        </CardTitle>
                        <CardDescription>Choose a department to generate the correct Join/Display links.</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-5">
                        {loadingDepts ? (
                            <div className="space-y-3">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-24 w-full" />
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2 min-w-0">
                                    <Label>Department</Label>
                                    <Select value={departmentId} onValueChange={setDepartmentId} disabled={!departments.length}>
                                        <SelectTrigger className="w-full min-w-0">
                                            <SelectValue placeholder="Select department" />
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

                                    {!departments.length ? (
                                        <div className="text-xs text-muted-foreground">No departments available.</div>
                                    ) : null}
                                </div>

                                <Separator />

                                <div className="grid gap-3 sm:grid-cols-3">
                                    <Button asChild className="gap-2" disabled={!departments.length}>
                                        <Link to={joinUrl}>
                                            <QrCode className="h-4 w-4" />
                                            Join Queue
                                        </Link>
                                    </Button>

                                    <Button asChild variant="outline" className="gap-2" disabled={!departments.length}>
                                        <Link to={displayUrl}>
                                            <Monitor className="h-4 w-4" />
                                            Public Display
                                        </Link>
                                    </Button>

                                    <Button asChild variant="secondary" className="gap-2" disabled={!departments.length}>
                                        <Link to={presentUrl}>
                                            <Maximize2 className="h-4 w-4" />
                                            Presentation
                                        </Link>
                                    </Button>
                                </div>

                                <div className="rounded-lg border p-4 text-xs text-muted-foreground">
                                    Tip: If you’re viewing the display on a TV/monitor, use <b>Presentation</b> for fullscreen mode.
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </main>

            <Footer variant="student" />
        </div>
    )
}
