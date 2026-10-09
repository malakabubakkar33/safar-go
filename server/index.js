import http from 'http';
import app from './app.js';
import { initSocketServer } from './socket.js';

const PORT = process.env.PORT || 5000;

// Create HTTP Server & Mount Real-Time WebSockets
const httpServer = http.createServer(app);
initSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[SafarGo API] Server + Socket.IO running on http://localhost:${PORT}`);
});

export { app, httpServer };
