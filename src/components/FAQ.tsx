import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const faqs = [
    {
        q: "Do students need an account?",
        a: "No. Student pages are public (no login). Students join by scanning a QR code and entering their Student ID (and phone if required).",
    },
    {
        q: "How do you prevent duplicate tickets?",
        a: "By default, QueuePass disallows duplicate active tickets for the same Student ID in the same department. This rule is configurable by the Admin.",
    },
    {
        q: "What happens if a student misses their call?",
        a: "Staff marks the ticket as HOLD. The student can return later, and staff can return the ticket to WAITING at the end of the queue (fair re-entry). Attempts increment only when HOLD is used.",
    },
    {
        q: "When does a ticket become OUT?",
        a: "If HOLD attempts reach the configured maximum (default: 4), the ticket becomes OUT and cannot return. The student must rejoin to get a new queue number.",
    },
    {
        q: "How are voice announcements handled?",
        a: "The public display page can use the browser Web Speech API to read announcements (e.g., “Queue #14, proceed to Window 3”).",
    },
    {
        q: "What SMS provider can we use?",
        a: "Any gateway with an API (e.g., Twilio/Vonage/Semaphore PH). API keys should be stored in environment variables (never hard-coded).",
    },
]

export default function FAQ() {
    return (
        <section id="faq" className="scroll-mt-24">
            <Card>
                <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2">
                        FAQ <Badge variant="secondary">Quick answers</Badge>
                    </CardTitle>
                    <CardDescription>Common questions about the queue flow, HOLD rule, SMS, and voice.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                        {faqs.map((f, idx) => (
                            <AccordionItem key={f.q} value={`item-${idx + 1}`}>
                                <AccordionTrigger>{f.q}</AccordionTrigger>
                                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </section>
    )
}
