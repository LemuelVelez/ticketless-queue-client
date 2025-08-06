import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface User {
    id: string
    name: string
    role: 'admin' | 'staff' | 'manager'
    servicePoint?: string
}

interface AuthContextType {
    user: User | null
    login: (username: string, password: string) => Promise<boolean>
    logout: () => void
    loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check for stored user session
        const storedUser = localStorage.getItem('jrmsu_queue_user')
        if (storedUser) {
            setUser(JSON.parse(storedUser))
        }
        setLoading(false)
    }, [])

    const login = async (username: string, password: string): Promise<boolean> => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Demo credentials
        const users: { [key: string]: User } = {
            'admin': {
                id: '1',
                name: 'Dr. Maria Santos',
                role: 'admin'
            },
            'staff': {
                id: '2',
                name: 'Juan Dela Cruz',
                role: 'staff',
                servicePoint: 'Registrar Office'
            }
        }

        if (users[username] && password === username) {
            const userData = users[username]
            setUser(userData)
            localStorage.setItem('jrmsu_queue_user', JSON.stringify(userData))
            return true
        }

        return false
    }

    const logout = () => {
        setUser(null)
        localStorage.removeItem('jrmsu_queue_user')
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
