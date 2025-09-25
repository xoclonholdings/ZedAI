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

  // Simple authentication for demo
  // In production, implement proper JWT or session management
  if (event.httpMethod === 'POST') {
    try {
      const { username, password } = JSON.parse(event.body || '{}');
      
      // Basic auth check - replace with real authentication
      if (username && password) {
        const user = {
          id: '1',
          username: username,
          email: `${username}@example.com`,
          firstName: username,
          lastName: 'User'
        };

        return {
          statusCode: 200,
          headers: {
            ...headers,
            'Set-Cookie': `auth-token=authenticated; HttpOnly; Path=/; Max-Age=86400`
          },
          body: JSON.stringify({ 
            success: true,
            user: user,
            message: 'Login successful'
          })
        };
      }
      
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid credentials' 
        })
      };
    } catch (error) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Invalid request body' 
        })
      };
    }
  }

  if (event.httpMethod === 'GET') {
    // Check authentication status
    const authCookie = event.headers.cookie?.includes('auth-token=authenticated');
    
    if (authCookie) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: '1',
          username: 'demo',
          email: 'demo@example.com',
          firstName: 'Demo',
          lastName: 'User'
        })
      };
    }
    
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Not authenticated' })
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

export { handler };