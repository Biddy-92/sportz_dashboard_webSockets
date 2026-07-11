import http from 'http';
import { WebSocketServer } from 'ws';
import { URL } from 'url';

// ১. নকল বা Mock Arcjet সিকিউরিটি গেটওয়ে
const wsArcjet = {
    protect: async (req) => {
        const url = new URL(req.url, 'http://localhost');
        // ইউআরএল-এ যদি '?deny=...' থাকে, তবে তাকে আটকে দাও
        if (url.searchParams.has('deny')) {
            return {
                isDenied: () => true,
                reason: {
                    isRateLimit: () => url.searchParams.get('deny') === 'rate',
                }
            };
        }
        // কোনো সমস্যা না থাকলে ভেতরে ঢুকতে দাও
        return { isDenied: () => false };
    }
};

// ২. একটি সাধারণ HTTP সার্ভার তৈরি
const server = http.createServer();
// ৩. একটি WebSocket সার্ভার তৈরি (যা সরাসরি চালু হবে না, HTTP এর সাহায্য নিবে)
const wss = new WebSocketServer({ noServer: true, path: '/ws' });

// ৪. কেউ কানেক্ট করার চেষ্টা করলে (HTTP Upgrade Request) এই অংশটি কাজ করবে
server.on('upgrade', async (req, socket, head) => {
    // Arcjet দিয়ে চেক করা হচ্ছে রিকোয়েস্টটি নিরাপদ কি না
    const decision = await wsArcjet.protect(req);

    if (decision.isDenied()) {
        // যদি রিজেক্ট করা হয়, তবে কানেকশন বন্ধ করে দাও
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
    }

    // সব ঠিক থাকলে WebSocket কানেকশন সাকসেসফুল করো
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

server.listen(8080, () => console.log('Server running on port 8080'));