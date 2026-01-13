// Tartapies Game UI & Logic
// Main game component will be added here

import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function App() {
  const [socket, setSocket] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const newSocket = io(API_URL)
    
    newSocket.on('connect', () => {
      console.log('Connected to server')
      setConnected(true)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server')
      setConnected(false)
    })

    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  return (
    <div className="app">
      <h1>Tartapies Online</h1>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      {/* Game UI will be added here */}
    </div>
  )
}

export default App

