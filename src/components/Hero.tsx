import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { BellRing, Mic, QrCode, Tv2, Volume2 } from "lucide-react"

export default function Hero() {
    return (
        <section className="py-12 md:py-16">
            <div className="grid gap-8 md:grid-cols-2 md:items-center">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="gap-1">
                            <QrCode className="h-3.5 w-3.5" />
                            QR-based entry
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <BellRing className="h-3.5 w-3.5" />
                            SMS notification
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <Volume2 className="h-3.5 w-3.5" />
                            Voice announcement
                        </Badge>
                        <Badge variant="secondary" className="gap-1">
                            <Tv2 className="h-3.5 w-3.5" />
                            Public display
                        </Badge>
                    </div>

                    <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
                        QueuePass: ticketless student ID queueing for school offices
                    </h1>
                    <p className="mt-4 text-pretty text-muted-foreground">
                        Students scan a QR code, enter their Student ID, and get a virtual queue number.
                        Staff can call next, recall, serve, and HOLD no-shows—while the public display updates in real time
                        with SMS + voice announcements.
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2">
                        <Button asChild>
                            <a href="/join">Join Queue</a>
                        </Button>
                        <Button variant="outline" asChild>
                            <a href="/staff/login">Staff Dashboard</a>
                        </Button>
                        <Button variant="ghost" asChild>
                            <a href="/admin/login">Admin Panel</a>
                        </Button>
                    </div>

                    <div className="mt-6">
                        <Separator className="my-4" />
                        <p className="text-sm text-muted-foreground">
                            Designed for Registrar, Cashier, Library, Clinic, NSTP/ROTC, and other student-facing departments.
                        </p>
                    </div>
                </div>

                <Card className="overflow-hidden">
                    <CardHeader>
                        <CardTitle>Live display preview</CardTitle>
                        <CardDescription>Now Serving + Up Next (privacy-friendly: queue # only)</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                        <div className="grid gap-2 rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Now Serving</span>
                                <Badge>Window 3</Badge>
                            </div>
                            <div className="text-3xl font-semibold">Queue #14</div>
                            <p className="text-xs text-muted-foreground">
                                Voice announcement example: “Queue number 14, please proceed to Window 3.”
                            </p>
                        </div>

                        <div className="grid gap-2 rounded-lg border p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Up Next</span>
                                <Badge variant="secondary">Next 5</Badge>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {["#15", "#16", "#17", "#18", "#19"].map((q) => (
                                    <Badge key={q} variant="outline">
                                        {q}
                                    </Badge>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Mic className="h-4 w-4" />
                                Voice runs on the display browser (Web Speech API).
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    )
}
