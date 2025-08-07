/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

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

// Keys for localStorage
const STUDENT_ID_KEY = 'jrmsu_student_id';
const QUEUE_DATA_KEY = 'jrmsu_queue_data';

export function AuthProvider({ children }: { children: ReactNode }) {
    // Initialize state from localStorage
    const [studentId, setStudentId] = useState<string | null>(() => {
        try {
            return localStorage.getItem(STUDENT_ID_KEY);
        } catch {
            return null;
        }
    });

    const [queueData, setQueueData] = useState<QueueData | null>(() => {
        try {
            const stored = localStorage.getItem(QUEUE_DATA_KEY);
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });

    // Save to localStorage whenever state changes
    useEffect(() => {
        try {
            if (studentId) {
                localStorage.setItem(STUDENT_ID_KEY, studentId);
            } else {
                localStorage.removeItem(STUDENT_ID_KEY);
            }
        } catch (error) {
            console.error('Failed to save student ID to localStorage:', error);
        }
    }, [studentId]);

    useEffect(() => {
        try {
            if (queueData) {
                localStorage.setItem(QUEUE_DATA_KEY, JSON.stringify(queueData));
            } else {
                localStorage.removeItem(QUEUE_DATA_KEY);
            }
        } catch (error) {
            console.error('Failed to save queue data to localStorage:', error);
        }
    }, [queueData]);

    const login = (id: string, data: QueueData) => {
        setStudentId(id);
        setQueueData(data);
    };

    const logout = () => {
        setStudentId(null);
        setQueueData(null);
        // Clear localStorage
        try {
            localStorage.removeItem(STUDENT_ID_KEY);
            localStorage.removeItem(QUEUE_DATA_KEY);
        } catch (error) {
            console.error('Failed to clear localStorage:', error);
        }
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
