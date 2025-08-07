export interface Service {
  id: string;
  name: string;
  description: string;
  estimatedWaitTime: string;
  currentQueue: string;
}

export const mockServices: Service[] = [
  {
    id: "registrar",
    name: "Registrar's Office",
    description: "For transcript requests, enrollment, and academic records.",
    estimatedWaitTime: "15-20 mins",
    currentQueue: "R-005",
  },
  {
    id: "cashier",
    name: "Cashier",
    description: "For payment transactions and financial inquiries.",
    estimatedWaitTime: "5-10 mins",
    currentQueue: "C-002",
  },
  {
    id: "library",
    name: "Library",
    description: "For book borrowing, returning, and research assistance.",
    estimatedWaitTime: "10-15 mins",
    currentQueue: "L-008",
  },
  {
    id: "clinic",
    name: "Campus Clinic",
    description: "For medical consultations and health services.",
    estimatedWaitTime: "20-25 mins",
    currentQueue: "M-001",
  },
  {
    id: "nstp-rotc",
    name: "NSTP/ROTC Processing",
    description: "For National Service Training Program and ROTC concerns.",
    estimatedWaitTime: "30-40 mins",
    currentQueue: "N-007",
  },
];
