import { useContext } from 'react'
import { QueueContext, type QueueContextType } from '../contexts/QueueContext'

export function useQueue(): QueueContextType {
    const context = useContext(QueueContext)
    if (context === undefined) {
        throw new Error('useQueue must be used within a QueueProvider')
    }
    return context
}
