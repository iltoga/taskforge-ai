#!/bin/bash
echo "Testing fixed calendar summary API..."

# Test the API endpoint directly
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "summarize last week calendar activities",
    "model": "gpt-4.1-mini",
    "useTools": true,
    "developmentMode": false,
    "calendarId": "galaxy73.it@gmail.com"
  }' \
  | jq '.'
