import { createContext, useState, type ReactNode } from 'react'

interface QueueItem {
    id: string
    studentId: string
    phoneNumber: string
    servicePoint: string
    queueNumber: string
    status: 'waiting' | 'serving' | 'completed'
    timestamp: Date
    estimatedWaitTime: string
}

interface QueueContextType {
    queue: QueueItem[]
    addToQueue: (item: QueueItem) => void
    updateQueueStatus: (id: string, status: QueueItem['status']) => void
    callNext: (id: string) => void
}

const QueueContext = createContext<QueueContextType | undefined>(undefined)

export function QueueProvider({ children }: { children: ReactNode }) {
    const [queue, setQueue] = useState<QueueItem[]>([
        // Demo data
        {
            id: 'REG-001',
            studentId: '2021-12345',
            phoneNumber: '09123456789',
            servicePoint: 'Registrar Office',
            queueNumber: 'REG-001',
            status: 'waiting',
            timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
            estimatedWaitTime: '15 min'
        },
        {
            id: 'REG-002',
            studentId: '2021-12346',
            phoneNumber: '09123456790',
            servicePoint: 'Registrar Office',
            queueNumber: 'REG-002',
            status: 'waiting',
            timestamp: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
            estimatedWaitTime: '20 min'
        },
        {
            id: 'CAS-001',
            studentId: '2021-12347',
            phoneNumber: '09123456791',
            servicePoint: 'Cashier',
            queueNumber: 'CAS-001',
            status: 'serving',
            timestamp: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago
            estimatedWaitTime: '10 min'
        }
    ])

    const addToQueue = (item: QueueItem) => {
        setQueue(prev => [...prev, item])
    }

    const updateQueueStatus = (id: string, status: QueueItem['status']) => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, status } : item
        ))
    }

    const callNext = (id: string) => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, status: 'serving' as const } : item
        ))
    }

    return (
        <QueueContext.Provider value={{ queue, addToQueue, updateQueueStatus, callNext }}>
            {children}
        </QueueContext.Provider>
    )
}

export { QueueContext }
export type { QueueItem, QueueContextType }
