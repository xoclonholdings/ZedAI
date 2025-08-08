## Dev/Test

### Start Dev Servers

```
npm run dev
```

### Health Check

```
curl http://localhost:5001/healthz
```

### Ready Check

```
curl http://localhost:5001/readyz
```

### Chat (streaming)

```
curl -N -H "Content-Type: application/json" -H "Authorization: Bearer $AUTH_SECRET" \
  -d '{"message":"Say hello in one sentence."}' http://localhost:5001/api/chat
```
