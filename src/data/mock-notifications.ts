export type NotificationCategory = "queue" | "sms" | "voiceover" | "system"

export type NotificationItem = {
  id: string
  title: string
  message: string
  category: NotificationCategory
  read: boolean
  createdAt: string // ISO string
  meta?: {
    service?: string
    queueNumber?: string
  }
}

const now = Date.now()

export const mockNotifications: NotificationItem[] = [
  {
    id: "n-1",
    title: "Queue Update",
    message: "It’s almost your turn. Please proceed to the service area soon.",
    category: "queue",
    read: false,
    createdAt: new Date(now - 1000 * 60 * 3).toISOString(),
    meta: {
      service: "Registrar's Office",
      queueNumber: "R-24",
    },
  },
  {
    id: "n-2",
    title: "SMS Sent",
    message: "We sent an SMS reminder to +63 9XX XXX XXXX.",
    category: "sms",
    read: false,
    createdAt: new Date(now - 1000 * 60 * 10).toISOString(),
  },
  {
    id: "n-3",
    title: "Voice Announcement",
    message: "Voiceover played for Queue R-24 in Registrar’s Office.",
    category: "voiceover",
    read: true,
    createdAt: new Date(now - 1000 * 60 * 45).toISOString(),
    meta: {
      service: "Registrar's Office",
      queueNumber: "R-24",
    },
  },
  {
    id: "n-4",
    title: "System Notice",
    message: "Scheduled maintenance tonight from 10:00 PM to 11:00 PM.",
    category: "system",
    read: true,
    createdAt: new Date(now - 1000 * 60 * 120).toISOString(),
  },
  {
    id: "n-5",
    title: "Queue Completed",
    message: "Your service for Cashier has been marked Completed. Thank you!",
    category: "queue",
    read: true,
    createdAt: new Date(now - 1000 * 60 * 180).toISOString(),
    meta: {
      service: "Cashier",
      queueNumber: "C-07",
    },
  },
]
