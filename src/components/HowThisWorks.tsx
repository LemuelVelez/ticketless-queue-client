import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { BellRing, QrCode, Tv2, UserCheck, Volume2 } from "lucide-react"

const steps = [
    {
        step: "1",
        icon: QrCode,
        title: "Student scans QR and joins",
        desc: "Pick a department/service, enter Student ID (and phone if needed), then receive a virtual queue number.",
    },
    {
        step: "2",
        icon: Tv2,
        title: "Public display updates live",
        desc: "Each department shows Now Serving + Up Next, plus a QR code for new students to join.",
    },
    {
        step: "3",
        icon: UserCheck,
        title: "Staff calls and serves",
        desc: "Staff dashboard supports Call Next, Recall, Served, No-show → HOLD, and Return from HOLD.",
    },
    {
        step: "4",
        icon: BellRing,
        title: "Students get notified",
        desc: "When called/next, the system sends an SMS so students can approach at the right time.",
    },
    {
        step: "5",
        icon: Volume2,
        title: "Voice announcement plays",
        desc: "Display machine announces: “Queue #14, proceed to Window 3.” (Web Speech API).",
    },
]

export default function HowThisWorks() {
    return (
        <section id="how" className="scroll-mt-24">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">How this works</h2>
                <p className="text-muted-foreground">
                    A straightforward FIFO queue with a clear no-show policy: HOLD + return to the end for fairness.
                </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
                {steps.map((s) => {
                    const Icon = s.icon
                    return (
                        <Card key={s.step}>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between gap-3">
                                    <span className="flex items-center gap-2">
                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-sm font-semibold">
                                            {s.step}
                                        </span>
                                        {s.title}
                                    </span>
                                    <Badge variant="secondary" className="gap-1">
                                        <Icon className="h-3.5 w-3.5" />
                                        Step
                                    </Badge>
                                </CardTitle>
                                <CardDescription>{s.desc}</CardDescription>
                            </CardHeader>
                            <CardContent />
                        </Card>
                    )
                })}
            </div>

            <Separator className="my-8" />

            <Card>
                <CardHeader>
                    <CardTitle>HOLD rule (no-show handling)</CardTitle>
                    <CardDescription>
                        If a student misses a call, staff marks the ticket as HOLD. The student can return later and be placed at
                        the end of the WAITING line. Attempts increment only on HOLD, and at 4 attempts the ticket becomes OUT.
                    </CardDescription>
                </CardHeader>
            </Card>
        </section>
    )
}
