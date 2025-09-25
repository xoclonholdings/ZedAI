import type { Handler } from '@netlify/functions';

const handler: Handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check Ollama connection
    let ollamaStatus = 'unknown';
    let ollamaModels: string[] = [];
    
    try {
      const ollamaResponse = await fetch('http://localhost:11434/api/tags', {
        method: 'GET'
      });
      
      if (ollamaResponse.ok) {
        const data = await ollamaResponse.json() as { models?: Array<{ name: string }> };
        ollamaStatus = 'connected';
        ollamaModels = data.models?.map((m: { name: string }) => m.name) || [];
      } else {
        ollamaStatus = 'error';
      }
    } catch (error) {
      ollamaStatus = 'disconnected';
    }

    const healthInfo = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'ZED AI Backend',
      version: '1.0.0',
      environment: 'netlify-functions',
      ollama: {
        status: ollamaStatus,
        models: ollamaModels
      },
      memory: {
        status: 'available',
        storage: 'netlify-functions-tmp'
      },
      features: [
        'chat',
        'memory-upload',
        'conversation-processing',
        'image-organization',
        'text-compression'
      ]
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(healthInfo)
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: errorMessage
      })
    };
  }
};

export { handler };