#!/bin/bash
# CBHunter Dev Server — clean start, no zombie processes
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== 清理旧进程 ==="
# Aggressive kill: retry until nothing left
for i in 1 2 3; do
  for pid in $(lsof -ti :8000 2>/dev/null); do kill -9 "$pid" 2>/dev/null || true; done
  for pid in $(lsof -ti :5173 2>/dev/null); do kill -9 "$pid" 2>/dev/null || true; done
  # Kill by process name (catches orphans not on port)
  pkill -9 -f "uvicorn app.main" 2>/dev/null || true
  sleep 1
done

# Final verification
if lsof -ti :8000 >/dev/null 2>&1; then
  echo "ERROR: Cannot free port 8000. Manual kill required."
  exit 1
fi
echo "Port 8000 ready"

if lsof -ti :5173 >/dev/null 2>&1; then
  echo "ERROR: Cannot free port 5173"
  exit 1
fi
echo "Port 5173 ready"

echo ""
echo "=== 启动后端 ==="
cd "$ROOT/backend"
PYTHON_BIN="${CBHUNTER_PYTHON:-$(command -v python3)}"
"$PYTHON_BIN" "$ROOT/backend/scripts/ensure_venv.py"
source venv/bin/activate
if [ "${CBHUNTER_RELOAD:-0}" = "1" ]; then
  nohup "$ROOT/backend/venv/bin/python" -m uvicorn app.main:app --reload --port 8000 > /tmp/backend.log 2>&1 &
else
  nohup "$ROOT/backend/venv/bin/python" -m uvicorn app.main:app --port 8000 > /tmp/backend.log 2>&1 &
fi
BACKEND_PID=$!

# Wait for health endpoint (up to 30s)
echo "等待后端就绪..."
for i in $(seq 1 30); do
  if curl -s --max-time 2 http://localhost:8000/health > /dev/null 2>&1; then
    echo "后端就绪 (${i}s) PID=$BACKEND_PID"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "ERROR: 后端启动失败"
    tail -20 /tmp/backend.log
    exit 1
  fi
  sleep 1
done

echo ""
echo "=== 启动前端 ==="
cd "$ROOT/frontend"
nohup npm run dev > /tmp/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

# Verify frontend
if lsof -ti :5173 >/dev/null 2>&1; then
  echo "前端就绪 PID=$FRONTEND_PID"
else
  echo "ERROR: 前端启动失败"
  tail -10 /tmp/frontend.log
  exit 1
fi

echo ""
echo "=== 系统就绪 ==="
echo "后端: http://localhost:8000"
echo "     Swagger: http://localhost:8000/docs"
echo "前端: http://localhost:5173"
echo "日志: tail -f /tmp/backend.log"
echo ""
echo "如需重启: bash dev.sh"
