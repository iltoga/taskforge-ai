#!/bin/bash

echo "🔍 Database Connection Debug Script"
echo "================================="

# Load environment variables
if [ -f .env ]; then
    source .env
    echo "✅ Loaded .env file"
else
    echo "❌ .env file not found"
    exit 1
fi

echo ""
echo "Database Configuration:"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo ""

echo "🔌 Testing database connection..."

# Test 1: Check if port is open
echo "1. Testing port connectivity..."
if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "✅ Port $DB_HOST:$DB_PORT is reachable"
else
    echo "❌ Port $DB_HOST:$DB_PORT is NOT reachable"
fi

# Test 2: Check Docker containers
echo ""
echo "2. Checking Docker containers..."
docker compose ps

# Test 3: Check database logs
echo ""
echo "3. Database container logs (last 20 lines):"
docker compose logs --tail=20 db

# Test 4: Try Prisma connection
echo ""
echo "4. Testing Prisma connection..."
if npx prisma db execute --stdin <<< "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Prisma can connect to database"
else
    echo "❌ Prisma cannot connect to database"
    echo "Full error:"
    npx prisma db execute --stdin <<< "SELECT 1;"
fi

echo ""
echo "🔍 Debug complete!"
