import { Handler } from '@netlify/functions';

const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Mock conversations data
  const mockConversations = [
    {
      id: '1',
      title: 'Welcome to ZED',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      message_count: 2
    },
    {
      id: '2', 
      title: 'AI Assistance',
      created_at: new Date(Date.now() - 86400000).toISOString(),
      updated_at: new Date(Date.now() - 86400000).toISOString(),
      message_count: 5
    }
  ];

  const mockMessages: Record<string, any[]> = {
    '1': [
      {
        id: '1',
        conversation_id: '1',
        role: 'assistant',
        content: 'Hello! I\'m ZED, your enhanced AI assistant. How can I help you today?',
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        conversation_id: '1', 
        role: 'user',
        content: 'Hello ZED!',
        created_at: new Date().toISOString()
      }
    ],
    '2': [
      {
        id: '3',
        conversation_id: '2',
        role: 'user',
        content: 'Can you help me with coding?',
        created_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: '4',
        conversation_id: '2',
        role: 'assistant', 
        content: 'Absolutely! I can help with coding in many languages including JavaScript, Python, TypeScript, and more. What specific coding challenge are you working on?',
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ]
  };

  if (event.httpMethod === 'GET') {
    const path = event.path;
    
    // Get conversations list
    if (path === '/.netlify/functions/conversations') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(mockConversations)
      };
    }
    
    // Get messages for a conversation
    const conversationMatch = path.match(/conversations\/([^\/]+)\/messages/);
    if (conversationMatch) {
      const conversationId = conversationMatch[1];
      const messages = mockMessages[conversationId] || [];
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(messages)
      };
    }
  }

  if (event.httpMethod === 'POST') {
    const path = event.path;
    
    // Create new conversation
    if (path === '/.netlify/functions/conversations') {
      const newConversation = {
        id: Date.now().toString(),
        title: 'New Conversation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 0
      };
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(newConversation)
      };
    }
    
    // Send message to conversation
    const messageMatch = path.match(/conversations\/([^\/]+)\/messages/);
    if (messageMatch) {
      const conversationId = messageMatch[1];
      const { content, role = 'user' } = JSON.parse(event.body || '{}');
      
      if (!content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Content is required' })
        };
      }

      // Create user message
      const userMessage = {
        id: Date.now().toString(),
        conversation_id: conversationId,
        role: role,
        content: content,
        created_at: new Date().toISOString()
      };
      
      // If user message, generate AI response
      if (role === 'user') {
        try {
          // Call Ollama for AI response
          const ollamaResponse = await fetch('http://localhost:11434/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'llama2',
              prompt: content,
              stream: false
            })
          });

          let aiContent = 'I\'m having trouble connecting to my AI system right now. Please try again later.';
          
          if (ollamaResponse.ok) {
            const ollamaData = await ollamaResponse.json();
            aiContent = ollamaData.response;
          }

          const aiMessage = {
            id: (Date.now() + 1).toString(),
            conversation_id: conversationId,
            role: 'assistant',
            content: aiContent,
            created_at: new Date().toISOString()
          };

          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
              userMessage,
              aiMessage
            })
          };
        } catch (error) {
          console.error('Ollama error:', error);
          
          const aiMessage = {
            id: (Date.now() + 1).toString(),
            conversation_id: conversationId,
            role: 'assistant',
            content: 'I\'m currently operating in offline mode. I can still help you with general questions and tasks!',
            created_at: new Date().toISOString()
          };

          return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
              userMessage,
              aiMessage
            })
          };
        }
      }
      
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(userMessage)
      };
    }
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: 'Endpoint not found' })
  };
};

export { handler };