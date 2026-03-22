import { io } from 'socket.io-client';

let socketInstance = null;

export const initializeSocket = (projectId) => {
    const token = localStorage.getItem('token');
    const apiUrl = import.meta.env.VITE_API_URL || 'https://qwiktalk.onrender.com';

    // Prevent duplicate connections
    if (socketInstance?.connected) return socketInstance;

    socketInstance = io(apiUrl, {
        auth: { token },
        query: { projectId },
        transports: ['websocket'], // Faster and more stable for IDEs
        reconnection: true
    });

    socketInstance.on('connect', () => console.log('Socket Connected'));
    socketInstance.on('connect_error', (err) => console.error('Socket Error:', err.message));

    return socketInstance;
};

export const receiveMessage = (eventName, cb) => {
    if (!socketInstance) return;
    socketInstance.off(eventName); // Prevent duplicate listeners
    socketInstance.on(eventName, cb);
};

export const sendMessage = (eventName, data) => {
    if (socketInstance) socketInstance.emit(eventName, data);
};

export const disconnectSocket = () => {
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
    }
};