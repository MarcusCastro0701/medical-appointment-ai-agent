import { createServer } from './server.ts';
import { disconnectDB } from './config/index.ts';

const port = Number(process.env.PORT ?? 3000);
const host = '0.0.0.0';

const app = createServer();

await app.listen({ port, host });
console.log(`Server is running on http://${host}:${port}`);

async function shutdown(signal: string) {
    console.log(`\n${signal} received, shutting down gracefully...`);
    await app.close();
    await disconnectDB();
    console.log('Shutdown complete.');
    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
