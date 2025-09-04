// Function to find an available port
async function findAvailablePort(startPort: number): Promise<number> {
  try {
    const response = await fetch(`http://localhost:${startPort}`);
    // Port is in use, try next one
    return findAvailablePort(startPort + 1);
  } catch (error) {
    // Port is available
    return startPort;
  }
}

export async function getServerPort(): Promise<number> {
  // Try common backend ports in sequence
  const ports = [5000, 3001, 8080, 4000, 5001];
  
  for (const port of ports) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        return port;
      }
    } catch {
      continue;
    }
  }
  
  // If no server found, return default
  return 5000;
}

export const DEFAULT_PORT = 5173;
export const DEFAULT_SERVER_PORT = 5000;
