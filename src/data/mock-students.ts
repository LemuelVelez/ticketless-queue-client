export interface QueueEntry {
  phoneNumber: ReactNode;
  service: string;
  queueNumber: string;
  estimatedWaitTime: string;
  servicePoint: string;
}

export interface QueueHistoryEntry {
  id: string;
  service: string;
  queueNumber: string;
  status: "In Progress" | "Completed" | "Cancelled";
  timestamp: string;
}

export interface StudentData {
  id: string;
  name: string;
  email: string;
  avatar: string;
  currentQueue: QueueEntry | null;
  queueHistory: QueueHistoryEntry[];
}

export const mockStudent: StudentData = {
  id: "2021-0001",
  name: "Juan Dela Cruz",
  email: "juan.delacruz@jrmsu.edu.ph",
  avatar: "/placeholder.svg?height=128&width=128",
  currentQueue: null,
  queueHistory: [
    {
      id: "1",
      service: "Registrar's Office - Transcript Request",
      queueNumber: "R-001",
      status: "Completed",
      timestamp: "2024-07-20 10:30 AM",
    },
    {
      id: "2",
      service: "Cashier - Tuition Payment",
      queueNumber: "C-005",
      status: "Completed",
      timestamp: "2024-07-18 02:15 PM",
    },
    {
      id: "3",
      service: "Library - Book Borrowing",
      queueNumber: "L-012",
      status: "Completed",
      timestamp: "2024-07-15 09:00 AM",
    },
    {
      id: "4",
      service: "Campus Clinic - Medical Consultation",
      queueNumber: "M-003",
      status: "Cancelled",
      timestamp: "2024-07-10 11:45 AM",
    },
  ],
};
