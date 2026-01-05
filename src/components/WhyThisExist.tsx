import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle2, ClipboardList, Clock, Users2 } from "lucide-react"

const problems = [
    {
        icon: Users2,
        title: "Crowding & disorder",
        desc: "Paper tickets and manual calling cause confusion and congestion—especially during peak hours.",
    },
    {
        icon: Clock,
        title: "Wasted time",
        desc: "Students wait without clear updates, while staff struggles to manage the line efficiently.",
    },
    {
        icon: ClipboardList,
        title: "No consistent tracking",
        desc: "It’s hard to measure served/no-show counts and audit staff actions without a digital trail.",
    },
]

const outcomes = [
    "Ticketless QR entry (mobile-first)",
    "Real-time Now Serving / Up Next display",
    "SMS notification + voice announcement",
    "HOLD + return flow for no-shows (fair and simple)",
]

export default function WhyThisExist() {
    return (
        <section id="why" className="scroll-mt-24">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">Why QueuePass exists</h2>
                <p className="text-muted-foreground">
                    A practical queue system for schools: reduce chaos, keep privacy, and make serving students faster.
                </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
                {problems.map((p) => {
                    const Icon = p.icon
                    return (
                        <Card key={p.title}>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border">
                                        <Icon className="h-4 w-4" />
                                    </span>
                                    <span className="wrap-break-word">{p.title}</span>
                                </CardTitle>
                                <CardDescription className="wrap-break-word">{p.desc}</CardDescription>
                            </CardHeader>
                        </Card>
                    )
                })}
            </div>

            <Separator className="my-8" />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Badge variant="secondary">Outcome</Badge>
                        What you get
                    </CardTitle>
                    <CardDescription className="wrap-break-word">
                        Focused on must-have features: no kiosks, no complex scheduling—just a clean queue flow.
                    </CardDescription>
                </CardHeader>

                {/* Mobile: vertical list + wrap text; Desktop unchanged */}
                <CardContent className="grid gap-2 sm:flex sm:flex-wrap sm:gap-2">
                    {outcomes.map((o) => (
                        <Badge
                            key={o}
                            variant="outline"
                            className="w-full justify-start gap-1 whitespace-normal wrap-break-word text-left leading-snug sm:w-auto sm:whitespace-nowrap"
                        >
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            {o}
                        </Badge>
                    ))}
                </CardContent>
            </Card>
        </section>
    )
}
