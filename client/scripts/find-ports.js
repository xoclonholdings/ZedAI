const net = require('net');

function findAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port is in use, try the next one
        findAvailablePort(startPort + 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(err);
      }
    });

    server.listen(startPort, '0.0.0.0', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// Find available ports for both dev and preview servers
async function findPorts() {
  try {
    const devPort = await findAvailablePort(5173);
    const previewPort = await findAvailablePort(devPort + 1);
    
    console.log(JSON.stringify({
      PORT: devPort,
      PREVIEW_PORT: previewPort
    }));
  } catch (err) {
    console.error('Error finding ports:', err);
    process.exit(1);
  }
}

findPorts();
