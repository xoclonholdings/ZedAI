import { useEffect, useState } from 'react';

export default function Home() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);

  useEffect(() => {
    const baseUrl = process.env.NODE_ENV === 'production'
      ? process.env.API_BASE_URL
      : '/api/health';
    fetch(baseUrl)
      .then(res => res.json())
      .then(data => setStatus(data.status))
      .catch(err => {
        setError('Failed to connect to backend');
        setStatus('error');
      });
  }, []);

  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'error') return <div>Error: {error}</div>;
  return <div>Backend status: {status}</div>;
}
