// C:\Users\amart\bsfi\src\server\stt-websocket-server.ts
import { WebSocketServer, WebSocket } from 'ws';
import { LiveTranscriptionEvents, createClient } from "@deepgram/sdk";
import { env } from "../env.js";
import { IncomingMessage } from 'http'; // Import IncomingMessage
import { Duplex } from 'stream';       // Import Duplex for the socket
const STT_WEBSOCKET_PATH = '/stt-service';
const DEEPGRAM_API_KEY = env.DEEPGRAM_API_KEY;
if (!DEEPGRAM_API_KEY) {
  throw new Error("DEEPGRAM_API_KEY is not set in environment variables.");
}

const deepgram = createClient(DEEPGRAM_API_KEY);

export function setupSttWebSocketServer(server: any) { // server is your HTTP server instance
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    const host = request.headers.host || 'localhost';
    const pathname = request.url ? new URL(request.url, `ws://${host}`).pathname : undefined;

    if (pathname === STT_WEBSOCKET_PATH) { // Check against your chosen path
      console.log(`[STT Server] Handling upgrade request for STT service at: ${pathname}`);
      wss.handleUpgrade(request, socket, head, (wsClient) => {
        wss.emit('connection', wsClient, request);
      });
    } else {
      console.log(`[STT Server] Ignoring upgrade request for path: ${pathname} (not STT path).`);
    }
  });

  console.log('🚀 STT WebSocket Server is configured to handle upgrade requests!');

  wss.on('connection', (ws: WebSocket, request: IncomingMessage) => { // Added 'request' parameter for context if needed
    console.log('🎙️ Client connected to STT WebSocket from URL:', request.url);

    const deepgramLive = deepgram.listen.live({
      model: 'nova-2-general',
      language: 'en',
      smart_format: true,
      punctuate: true,
      interim_results: true,
      utterance_end_ms: 1000,
    });

    deepgramLive.on(LiveTranscriptionEvents.Open, () => {
      console.log('🔵 Deepgram STT Connection Opened');

      deepgramLive.on(LiveTranscriptionEvents.Close, () => {
        console.log('🔴 Deepgram STT Connection Closed');
      });

      deepgramLive.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('🆘 Deepgram STT Error:', error);
        // Avoid sending complex objects or ensure client can parse them
        ws.send(JSON.stringify({ type: 'error', data: 'Deepgram STT Error: ' + error.message }));
      });

      deepgramLive.on(LiveTranscriptionEvents.Transcript, (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript;
        if (transcript) {
          ws.send(JSON.stringify({
            type: 'transcript',
            is_final: data.is_final,
            speech_final: data.speech_final,
            transcript: transcript,
            confidence: data.channel?.alternatives?.[0]?.confidence,
          }));
        }
      });

      deepgramLive.on(LiveTranscriptionEvents.Metadata, (data) => {
        // console.log('📄 Deepgram Metadata:', data);
      });

      ws.on('message', (message: Buffer) => {
        if (deepgramLive.getReadyState() === 1 /* OPEN */) {
          const arrayBuffer = message.buffer.slice(
            message.byteOffset,
            message.byteOffset + message.byteLength
          );
          deepgramLive.send(arrayBuffer);
        } else {
          console.log('⚠️ Deepgram connection not open, cannot send audio.');
        }
      });

      ws.on('close', () => {
        console.log('🎙️ Client disconnected from STT WebSocket');
        if (deepgramLive.getReadyState() === 1) {
          deepgramLive.requestClose();
        }
      });

      ws.on('error', (error) => {
        console.error('Cliente STT WebSocket Error:', error);
        if (deepgramLive.getReadyState() === 1) {
          deepgramLive.requestClose();
        }
      });
    });

    // Handle errors during the Deepgram connection opening phase itself
    deepgramLive.on(LiveTranscriptionEvents.Error, (error) => { // This is an outer error handler for deepgramLive
      console.error('🆘 Deepgram STT connection initialization error:', error);
      ws.send(JSON.stringify({ type: 'error', data: 'Deepgram STT Initialization Error: ' + error.message }));
      ws.close(1011, "Deepgram connection initialization failed"); // 1011 indicates server error
    });
  });

  // Optional: Handle errors on the WebSocketServer instance itself
  wss.on('error', (error) => {
    console.error('🔥 WebSocket Server instance error:', error);
  });
}