import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ShieldCheck, User, UserCog } from "lucide-react"

type RoleBlock = {
    label: string
    icon: React.ComponentType<{ className?: string }>
    summary: string
    can: string[]
    cannot: string[]
}

const roles: Record<"student" | "staff" | "admin", RoleBlock> = {
    student: {
        label: "Student",
        icon: User,
        summary: "Joins the queue via QR, tracks status, and receives notifications.",
        can: [
            "Scan QR and open Join Queue page",
            "Select department/service",
            "Enter Student ID (and phone if required)",
            "Receive queue number",
            "View real-time status + Now Serving/Up Next",
            "Receive SMS notifications",
        ],
        cannot: ["Access staff/admin controls", "Edit queue entry after submission (unless added later)"],
    },
    staff: {
        label: "Staff/Teller",
        icon: UserCog,
        summary: "Calls, recalls, serves, and manages HOLD returns for an assigned department/window.",
        can: [
            "Login (staff authentication required)",
            "Operate queue: Call Next, Recall, Served",
            "No-show → HOLD (attempts +1)",
            "Return from HOLD to end of WAITING",
            "Trigger display updates + SMS + voice (via display page)",
        ],
        cannot: ["Create/edit departments/windows", "Change system settings", "Delete audit logs"],
    },
    admin: {
        label: "Admin",
        icon: ShieldCheck,
        summary: "Manages departments, windows, staff assignments, settings, and reports/audit logs.",
        can: [
            "Create/update/disable departments",
            "Create/update/disable service windows",
            "Create/manage staff accounts + assignments",
            "Configure rules (HOLD attempts, duplicates)",
            "View reports/logs and audit trail",
        ],
        cannot: ["Perform unlogged admin actions (admin actions must be audited)"],
    },
}

function RoleCard({ role }: { role: RoleBlock }) {
    const Icon = role.icon
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border">
                        <Icon className="h-4 w-4" />
                    </span>
                    {role.label}
                    <Badge variant="secondary">Role</Badge>
                </CardTitle>
                <CardDescription>{role.summary}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                        <Badge>Can</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {role.can.map((x) => (
                            <Badge key={x} variant="outline">
                                {x}
                            </Badge>
                        ))}
                    </div>
                </div>

                <Separator />

                <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                        <Badge variant="destructive">Cannot</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {role.cannot.map((x) => (
                            <Badge key={x} variant="outline">
                                {x}
                            </Badge>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function Roles() {
    return (
        <section id="roles" className="scroll-mt-24">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">Roles</h2>
                <p className="text-muted-foreground">
                    Three-role setup with clear permissions: Student (public), Staff/Teller (authenticated), Admin (full control).
                </p>
            </div>

            <div className="mt-8">
                <Tabs defaultValue="student">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="student">Student</TabsTrigger>
                        <TabsTrigger value="staff">Staff/Teller</TabsTrigger>
                        <TabsTrigger value="admin">Admin</TabsTrigger>
                    </TabsList>

                    <TabsContent value="student" className="mt-4">
                        <RoleCard role={roles.student} />
                    </TabsContent>
                    <TabsContent value="staff" className="mt-4">
                        <RoleCard role={roles.staff} />
                    </TabsContent>
                    <TabsContent value="admin" className="mt-4">
                        <RoleCard role={roles.admin} />
                    </TabsContent>
                </Tabs>
            </div>
        </section>
    )
}
