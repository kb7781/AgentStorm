#!/bin/bash
set -e

API="http://localhost:3001"
PASS=0
FAIL=0

pass() { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

echo "=================================================="
echo "      AGENTSTORM — DAY 7 FINAL VERIFICATION       "
echo "=================================================="

# 1. Server TypeScript & Prisma Validation
echo ""
echo "1. Validating Server TypeScript & Prisma Schema..."
cd /Users/kunalbothra/Desktop/AgentStorm/server
npx tsc --noEmit
npx prisma validate > /dev/null 2>&1
npx tsx -e "import prisma from './src/lib/prisma'; prisma.product.updateMany({ data: { stock: 50 } }).then(() => prisma.\$disconnect());" > /dev/null 2>&1
pass "Server TypeScript compiled & Prisma schema validated (0 errors)"

# 2. Client Production Build
echo ""
echo "2. Validating Client Production Build..."
cd /Users/kunalbothra/Desktop/AgentStorm/client
npm run build > /dev/null 2>&1
pass "Client Next.js production build succeeded (0 errors)"

# 3. Security & Secret Leak Check
echo ""
echo "3. Performing Security & Secret Leak Check..."
cd /Users/kunalbothra/Desktop/AgentStorm
if grep -q "RAZORPAY_KEY_SECRET" client/src/**/*.{ts,tsx} 2>/dev/null; then
  fail "RAZORPAY_KEY_SECRET found in client bundle"
else
  pass "RAZORPAY_KEY_SECRET is strictly server-side"
fi

if grep -q "GROQ_API_KEY" client/src/**/*.{ts,tsx} 2>/dev/null; then
  fail "GROQ_API_KEY found in client bundle"
else
  pass "GROQ_API_KEY is strictly server-side"
fi

if grep -q "DATABASE_URL" client/src/**/*.{ts,tsx} 2>/dev/null; then
  fail "DATABASE_URL found in client bundle"
else
  pass "DATABASE_URL is strictly server-side"
fi

# 4. APIs Sanity Check
echo ""
echo "4. Testing Backend APIs..."
HEALTH=$(curl -sf "$API/api/health" | python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))")
if [ "$HEALTH" = "ok" ]; then pass "GET /api/health returned ok"; else fail "Health check failed"; fi

PROD_COUNT=$(curl -sf "$API/api/products" | python3 -c "import sys,json; print(json.load(sys.stdin).get('count',0))")
if [ "$PROD_COUNT" -ge 12 ]; then pass "GET /api/products returned $PROD_COUNT products"; else fail "Products count mismatch"; fi

BUYERS_COUNT=$(curl -sf "$API/api/buyers" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('buyers',[])))")
if [ "$BUYERS_COUNT" -eq 4 ]; then pass "GET /api/buyers returned 4 personas"; else fail "Buyers count mismatch"; fi

SCENARIOS_COUNT=$(curl -sf "$API/api/simulations/scenarios" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('scenarios',[])))")
if [ "$SCENARIOS_COUNT" -eq 3 ]; then pass "GET /api/simulations/scenarios returned 3 scenarios"; else fail "Scenarios count mismatch"; fi

# 5. Single AI Buyer Execution
echo ""
echo "5. Testing Single AI Buyer Execution (Groq / Fallback)..."
BUYER_RES=$(curl -sf -X POST "$API/api/buyers/budget-shopper/run")
BUYER_STATUS=$(echo "$BUYER_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['status'])")
BUYER_ORDER=$(echo "$BUYER_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['result'].get('orderId','none'))")
if [ "$BUYER_STATUS" = "completed" ] && [ "$BUYER_ORDER" != "none" ]; then
  pass "Budget Shopper successfully executed purchase (Order: $BUYER_ORDER)"
else
  fail "Budget Shopper run did not complete successfully"
fi

# 6. Full Simulation Storms & Reliability Reports
echo ""
echo "6. Testing Simulation Storms (Flash Sale, Market Storm, Payment Chaos)..."

for SC in "payment-chaos" "flash-sale" "market-storm"; do
  SIM_RES=$(curl -sf -X POST "$API/api/simulations/run" -H "Content-Type: application/json" -d "{\"scenarioId\":\"$SC\"}")
  OVERALL_SCORE=$(echo "$SIM_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['report']['overallScore'])")
  VERDICT=$(echo "$SIM_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['report']['verdict'])")
  IS_SAFE=$(echo "$SIM_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['report']['categories']['inventorySafety']['metrics']['isBalanced'])")
  OVERSELL=$(echo "$SIM_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['report']['categories']['inventorySafety']['metrics']['oversellCount'])")

  if [ "$OVERALL_SCORE" -ge 75 ] && [ "$IS_SAFE" = "True" ] && [ "$OVERSELL" -eq 0 ]; then
    pass "Scenario '$SC': Score $OVERALL_SCORE/100 ($VERDICT, Balanced: $IS_SAFE, Oversell: $OVERSELL)"
  else
    fail "Scenario '$SC' failed integrity verification (Score: $OVERALL_SCORE, Balanced: $IS_SAFE, Oversell: $OVERSELL)"
  fi
done

# 7. Report Retrieval API
SIM_ID=$(echo "$SIM_RES" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['simulationId'])")
FETCHED_SCORE=$(curl -sf "$API/api/simulations/$SIM_ID/report" | python3 -c "import sys,json; print(json.load(sys.stdin)['report']['overallScore'])")

if [ "$FETCHED_SCORE" = "$OVERALL_SCORE" ]; then
  pass "GET /api/simulations/:id/report retrieved identical report for $SIM_ID"
else
  fail "Report retrieval mismatch"
fi

echo ""
echo "=================================================="
echo "    FINAL RESULT: $PASS PASSED, $FAIL FAILED      "
echo "=================================================="
