#!/usr/bin/env bash
# Deploy latest master to Hugging Face Spaces
# Usage: ./deploy-hf.sh

set -e

SPACE_REMOTE="space"
SPACE_URL="https://huggingface.co/spaces/MinhTai/ai-agent-app"
HEALTH_URL="https://minhtai-ai-agent-app.hf.space/health"

echo "==> Checking remote..."
if ! git remote get-url "$SPACE_REMOTE" &>/dev/null; then
  echo "Adding '$SPACE_REMOTE' remote..."
  git remote add "$SPACE_REMOTE" "$SPACE_URL"
fi

CURRENT_BRANCH=$(git branch --show-current)

echo "==> Switching to hf-deploy branch..."
git checkout hf-deploy

echo "==> Merging master..."
git merge master --no-edit

echo "==> Pushing to HF Space..."
git push --force "$SPACE_REMOTE" hf-deploy:main

echo "==> Switching back to $CURRENT_BRANCH..."
git checkout "$CURRENT_BRANCH"

echo ""
echo "Deployed. Build logs: $SPACE_URL"
echo "Health check (wait ~30s for rebuild): curl $HEALTH_URL"
