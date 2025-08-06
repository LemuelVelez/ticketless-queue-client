import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users, BarChart3, Clock, CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Shield, Monitor, Settings, Activity } from 'lucide-react'
import { useQueue } from '../contexts/QueueContext'
import { useAuth } from '../contexts/AuthContext'

export default function AdminDashboard() {
  const { user } = useAuth()
  const { queue } = useQueue()
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const servicePoints = [
    { name: 'Registrar Office', active: 12, completed: 45, avgWait: '15 min', status: 'active' },
    { name: 'Cashier', active: 8, completed: 32, avgWait: '10 min', status: 'active' },
    { name: 'Library', active: 5, completed: 28, avgWait: '5 min', status: 'active' },
    { name: 'Campus Clinic', active: 3, completed: 15, avgWait: '8 min', status: 'break' },
    { name: 'NSTP/ROTC', active: 7, completed: 22, avgWait: '12 min', status: 'active' }
  ]

  const recentActivity = [
    { time: '14:32', action: 'Queue REG-045 completed at Registrar Office', type: 'completed' },
    { time: '14:30', action: 'New queue CAS-023 generated for Cashier', type: 'new' },
    { time: '14:28', action: 'Campus Clinic window went on break', type: 'status' },
    { time: '14:25', action: 'Queue LIB-012 called at Library', type: 'called' },
    { time: '14:23', action: 'System backup completed successfully', type: 'system' }
  ]

  const totalActive = servicePoints.reduce((sum, point) => sum + point.active, 0)
  const totalCompleted = servicePoints.reduce((sum, point) => sum + point.completed, 0)
  const activeServices = servicePoints.filter(point => point.status === 'active').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">JRMSU Queue</h1>
                <p className="text-xs text-gray-600">Admin Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-600">System Administrator</p>
              </div>
              <Link 
                to="/"
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Exit
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total in Queue</p>
                <p className="text-3xl font-bold text-blue-600">{totalActive}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">+12% from yesterday</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed Today</p>
                <p className="text-3xl font-bold text-green-600">{totalCompleted}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">+8% from yesterday</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Services</p>
                <p className="text-3xl font-bold text-orange-600">{activeServices}/5</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-orange-600">1 service on break</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Wait Time</p>
                <p className="text-3xl font-bold text-purple-600">10 min</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <TrendingDown className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">-3 min from yesterday</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Service Points Status */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Service Points</h2>
              <div className="text-sm text-gray-500">
                {currentTime.toLocaleTimeString()}
              </div>
            </div>

            <div className="space-y-4">
              {servicePoints.map((point, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{point.name}</h3>
                      <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                        point.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {point.status === 'active' ? '🟢 Active' : '🟡 Break'}
                      </div>
                    </div>
                    <Link
                      to={`/display/${point.name.toLowerCase().replace(/\s+/g, '-')}`}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      View Display
                    </Link>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">In Queue</p>
                      <p className="font-semibold text-blue-600">{point.active}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Completed</p>
                      <p className="font-semibold text-green-600">{point.completed}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Avg Wait</p>
                      <p className="font-semibold text-orange-600">{point.avgWait}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h2>
            
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.type === 'completed' ? 'bg-green-500' :
                    activity.type === 'new' ? 'bg-blue-500' :
                    activity.type === 'called' ? 'bg-orange-500' :
                    activity.type === 'status' ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <button className="w-full mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium">
              View All Activity
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Quick Actions</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <Monitor className="h-8 w-8 text-blue-600" />
              <span className="text-sm font-medium">View Displays</span>
            </button>
            
            <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <BarChart3 className="h-8 w-8 text-green-600" />
              <span className="text-sm font-medium">Analytics</span>
            </button>
            
            <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <Users className="h-8 w-8 text-purple-600" />
              <span className="text-sm font-medium">Manage Users</span>
            </button>
            
            <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <Settings className="h-8 w-8 text-orange-600" />
              <span className="text-sm font-medium">Settings</span>
            </button>
            
            <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <Activity className="h-8 w-8 text-red-600" />
              <span className="text-sm font-medium">System Health</span>
            </button>
            
            <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <Shield className="h-8 w-8 text-indigo-600" />
              <span className="text-sm font-medium">Security</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
