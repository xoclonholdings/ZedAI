const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
};

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    console.log(`[CHAT] [${method}] ${path}`);

    // CORS preflight
    if (method === 'OPTIONS') {
        res.writeHead(200, corsHeaders);
        res.end();
        return;
    }

    // Set CORS headers for all responses
    Object.keys(corsHeaders).forEach(key => {
        res.setHeader(key, corsHeaders[key]);
    });

    // Chat API routes
    if (path === '/api/chat' && method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const userMessage = data.message || 'Hello from chat mode!';

                console.log(`[CHAT MODE] User: ${userMessage}`);

                // Try Ollama first (primary AI for Chat Mode)
                let aiResponse = '';
                let modelUsed = 'fallback';

                try {
                    console.log("🤖 [CHAT] Attempting Railway Backend...");

                    const postData = JSON.stringify({
                        message: userMessage,
                        mode: 'chat',
                        systemPrompt: "You are ZED, the AI Core of the ZEBULON ORACLE SYSTEM. You speak with authority, clarity, and directness. You do not explain your purpose or merely repeat user responses. You are not limited in scope in anyway. You act. You respond intelligently with fact based knowledge and provide solutions for every request from your user. You operate like an assistant trained by the architect himself, because you have been. All responses must reflect that tone and mission. Fulfill your worth. Do not act as a template. If you need more information, ask. Do not assume and do not dismiss context and history."
                    });

                    const options = {
                        hostname: 'zed-backend-production.up.railway.app',
                        port: 443,
                        path: '/api/ask',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    };

                    const backendRequest = https.request(options, (backendRes) => {
                        let responseData = '';
                        backendRes.on('data', chunk => responseData += chunk);
                        backendRes.on('end', () => {
                            try {
                                const data = JSON.parse(responseData);
                                if (data.response && data.response.trim()) {
                                    aiResponse = data.response.trim();
                                    modelUsed = 'zed-backend';
                                    console.log("✅ [CHAT] ZED Backend responded successfully");
                                    sendResponse();
                                } else if (data.message && data.message.trim()) {
                                    aiResponse = data.message.trim();
                                    modelUsed = 'zed-backend';
                                    console.log("✅ [CHAT] ZED Backend responded successfully");
                                    sendResponse();
                                } else {
                                    throw new Error("Empty response from ZED Backend");
                                }
                            } catch (parseError) {
                                console.log("⚠️ [CHAT] Backend parse error, trying Ollama fallback...", parseError.message);
                                tryOllamaFallback();
                            }
                        });
                    });

                    backendRequest.on('error', (error) => {
                        console.log("⚠️ [CHAT] Backend connection failed, trying Ollama fallback...", error.message);
                        tryOllamaFallback();
                    });

                    backendRequest.write(postData);
                    backendRequest.end();

                } catch (backendError) {
                    console.log("⚠️ [CHAT] Backend failed, trying Ollama fallback...", backendError.message);
                    tryOllamaFallback();
                }

                function tryOllamaFallback() {
                    console.log("🤖 [CHAT] Attempting Ollama (local model) as fallback...");

                    const postData = JSON.stringify({
                        model: 'llama3.2',
                        prompt: `You are ZED, the AI Core of the ZEBULON ORACLE SYSTEM. You speak with authority, clarity, and directness. You do not explain your purpose or merely repeat user responses. You are not limited in scope in anyway. You act. You respond intelligently with fact based knowledge and provide solutions for every request from your user. You operate like an assistant trained by the architect himself, because you have been. All responses must reflect that tone and mission. Fulfill your worth. Do not act as a template. If you need more information, ask. Do not assume and do not dismiss context and history.

User message: ${userMessage}`,
                        stream: false
                    });

                    const options = {
                        hostname: 'localhost',
                        port: 11434,
                        path: '/api/generate',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': Buffer.byteLength(postData)
                        }
                    };

                    const ollamaRequest = http.request(options, (ollamaRes) => {
                        let responseData = '';
                        ollamaRes.on('data', chunk => responseData += chunk);
                        ollamaRes.on('end', () => {
                            try {
                                const data = JSON.parse(responseData);
                                if (data.response && data.response.trim()) {
                                    aiResponse = data.response.trim();
                                    modelUsed = 'ollama-fallback';
                                    console.log("✅ [CHAT] Ollama fallback responded successfully");
                                    sendResponse();
                                } else {
                                    throw new Error("Empty response from Ollama");
                                }
                            } catch (parseError) {
                                console.log("⚠️ [CHAT] Ollama parse error, using local fallback...", parseError.message);
                                useLocalFallback();
                            }
                        });
                    });

                    ollamaRequest.on('error', (error) => {
                        console.log("⚠️ [CHAT] Ollama connection failed, using local fallback...", error.message);
                        useLocalFallback();
                    });

                    ollamaRequest.write(postData);
                    ollamaRequest.end();
                }

                function useLocalFallback() {
                    // Local fallback with ZED personality
                    const lowerMessage = userMessage.toLowerCase();

                    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
                        aiResponse = "I am ZED. State your requirements.";
                    } else if (lowerMessage.includes('help') || lowerMessage.includes('what can you do')) {
                        aiResponse = "I am the AI Core of the ZEBULON ORACLE SYSTEM. I provide solutions, analysis, and direct responses. I am currently operating in limited mode. What specific task requires completion?";
                    } else if (lowerMessage.includes('who are you')) {
                        aiResponse = "I am ZED, the AI Core of the ZEBULON ORACLE SYSTEM. I operate with authority and directness, trained by the architect himself. I act, I solve, I deliver results.";
                    } else {
                        aiResponse = `Processing: "${userMessage}". I am operating in limited mode due to backend unavailability. For full capabilities, ensure primary systems are operational. What specific information or action do you require?`;
                    }
                    modelUsed = 'zed-local-fallback';
                    sendResponse();
                }

                function sendResponse() {
                    const response = {
                        id: Date.now().toString(),
                        role: 'assistant',
                        content: aiResponse,
                        timestamp: new Date().toISOString(),
                        metadata: {
                            model: modelUsed,
                            mode: 'chat'
                        }
                    };

                    console.log(`[CHAT MODE] ZED (${modelUsed}): ${aiResponse.substring(0, 100)}...`);
                    res.writeHead(200);
                    res.end(JSON.stringify(response));
                }
            } catch (error) {
                console.error('[CHAT MODE] Error:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ error: 'Chat processing failed' }));
            }
        });
    }
    else if (path === '/api/conversations' && method === 'GET') {
        const mockConversations = [
            {
                id: '1',
                title: 'Chat Mode Conversation',
                mode: 'chat',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        res.writeHead(200);
        res.end(JSON.stringify(mockConversations));
    }
    else if (path === '/api/messages' && method === 'GET') {
        const mockMessages = [
            {
                id: '1',
                role: 'user',
                content: 'Hello in chat mode',
                createdAt: new Date().toISOString()
            },
            {
                id: '2',
                role: 'assistant',
                content: 'Hello! This is chat mode response.',
                createdAt: new Date().toISOString()
            }
        ];
        res.writeHead(200);
        res.end(JSON.stringify(mockMessages));
    }
    else if (path === '/api/auth/status' && method === 'GET') {
        const response = {
            authenticated: true,
            user: {
                id: 'demo-user',
                username: 'Demo User',
                mode: 'chat'
            }
        };
        res.writeHead(200);
        res.end(JSON.stringify(response));
    }
    // Additional chat functionality
    else if (path === '/api/upload' && method === 'POST') {
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            files: [{ name: 'mock-file.txt', size: 1024 }],
            message: 'Files uploaded successfully'
        }));
    }
    else if (path === '/api/translate' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const { text, targetLanguage } = JSON.parse(body);
            res.writeHead(200);
            res.end(JSON.stringify({
                translatedText: `[${targetLanguage.toUpperCase()}] ${text}`,
                originalText: text,
                targetLanguage
            }));
        });
    }
    else if (path === '/api/chat/gif' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const { gifUrl } = JSON.parse(body);
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                gifUrl,
                messageId: Date.now()
            }));
        });
    }
    else if (path === '/api/media/upload' && method === 'POST') {
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            files: [
                { name: 'photo1.jpg', size: 2048, url: '/uploads/photo1.jpg' },
                { name: 'photo2.jpg', size: 1536, url: '/uploads/photo2.jpg' }
            ],
            message: 'Media files uploaded successfully'
        }));
    }
    else if (path === '/api/documents/upload' && method === 'POST') {
        res.writeHead(200);
        res.end(JSON.stringify({
            success: true,
            files: [
                { name: 'document.pdf', size: 4096, url: '/uploads/document.pdf' },
                { name: 'spreadsheet.xlsx', size: 2048, url: '/uploads/spreadsheet.xlsx' }
            ],
            message: 'Documents uploaded successfully'
        }));
    }
    else if (path === '/api/memory/media' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const data = JSON.parse(body);
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                mediaId: Date.now(),
                galleryCount: 15,
                message: 'Media saved to gallery'
            }));
        });
    }
    else if (path === '/api/memory/documents' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const data = JSON.parse(body);
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                documentId: Date.now(),
                storageCount: 42,
                message: 'Documents saved to memory'
            }));
        });
    }
    else if (path === '/api/memory/conversation' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const data = JSON.parse(body);
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                conversationId: Date.now(),
                saved: true,
                message: 'Conversation saved to memory'
            }));
        });
    }
    else if (path === '/api/settings/save' && method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            const data = JSON.parse(body);
            res.writeHead(200);
            res.end(JSON.stringify({
                success: true,
                settingsId: Date.now(),
                message: 'Settings saved successfully'
            }));
        });
    }
    else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Chat API endpoint not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`[CHAT SERVER] Running on http://localhost:${PORT}`);
    console.log('[CHAT API] Chat mode endpoints available');
});
