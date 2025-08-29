import 'dotenv/config';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { parse } from 'url';
import next from 'next';
import { setupSttWebSocketServer } from '@/server/stt-websocket-server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  setupSttWebSocketServer(httpServer);

  httpServer
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> STT WebSocket Server initialized and listening on the same port.`);
    })
    .on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Error: Port ${port} is already in use.`);
      } else {
        console.error("Server listen error:", err);
      }
      process.exit(1);
    });

}).catch(err => {
  console.error("Error during Next.js app.prepare():", err);
  process.exit(1);
});
