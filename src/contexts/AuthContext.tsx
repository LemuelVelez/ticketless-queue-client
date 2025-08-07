/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react';

export interface QueueData {
    service: string;
    queueNumber: string;
    estimatedWaitTime: string;
    servicePoint: string;
    phoneNumber: string;
}

interface AuthContextType {
    studentId: string | null;
    queueData: QueueData | null;
    login: (studentId: string, queueData: QueueData) => void;
    logout: () => void;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [studentId, setStudentId] = useState<string | null>(null);
    const [queueData, setQueueData] = useState<QueueData | null>(null);

    const login = (id: string, data: QueueData) => {
        setStudentId(id);
        setQueueData(data);
    };

    const logout = () => {
        setStudentId(null);
        setQueueData(null);
    };

    const isAuthenticated = !!studentId;

    return (
        <AuthContext.Provider value={{ studentId, queueData, login, logout, isAuthenticated }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
