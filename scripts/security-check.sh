#!/bin/bash

# LocalBase.ai Security Check
# Comprehensive security scan before commits
# Exit code 1 = FAIL, 0 = PASS

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
cd "$REPO_ROOT"

echo "🔒 LocalBase.ai Security Scanner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

FAILED=0

# 1. Run gitleaks if available (only scan tracked files)
echo "1️⃣  Running gitleaks scan..."
if command -v gitleaks &> /dev/null; then
  if gitleaks detect -v 2>&1 | grep -q "Finding:"; then
    echo "❌ FAIL: gitleaks found secrets in tracked files"
    gitleaks detect -v
    FAILED=1
  else
    echo "✅ PASS: gitleaks found no secrets"
  fi
else
  echo "⚠️  SKIP: gitleaks not installed (brew install gitleaks)"
fi
echo ""

# 2. Business Names Check (warning only - review before publishing)
echo "2️⃣  Checking for business names..."
BUSINESS_REFS=$(git ls-files | xargs grep -iE "roofmaxx|goskills|renu" 2>/dev/null | \
  grep -v "security-check.sh" || true)
if [ -n "$BUSINESS_REFS" ]; then
  echo "⚠️  WARNING: Found business name references (review before publishing)"
  echo "$BUSINESS_REFS" | head -20
  if [ $(echo "$BUSINESS_REFS" | wc -l) -gt 20 ]; then
    echo "  ... and more ($(echo "$BUSINESS_REFS" | wc -l) total matches)"
  fi
  # Warning only, don't fail
else
  echo "✅ PASS: No business names found"
fi
echo ""

# 3. Personal Info Check
echo "3️⃣  Checking for personal information..."
PERSONAL_INFO=$(git ls-files | xargs grep -E "/Users/[a-z]+|riggin|ryan" 2>/dev/null | \
  grep -v "example\|README\|CLAUDE\|author\|package.json\|security-check.sh" || true)
if [ -n "$PERSONAL_INFO" ]; then
  echo "❌ FAIL: Found personal information"
  echo "$PERSONAL_INFO"
  FAILED=1
else
  echo "✅ PASS: No personal info found"
fi
echo ""

# 4. Hardcoded Paths Check
echo "4️⃣  Checking for hardcoded paths..."
HARDCODED_PATHS=$(git ls-files | xargs grep -E "/(Work|Users|home)/[a-zA-Z]+/" 2>/dev/null | \
  grep -v "README\|CLAUDE\|example\|ChartJsWrapper\|sync-framework" || true)
if [ -n "$HARDCODED_PATHS" ]; then
  echo "❌ FAIL: Found hardcoded paths"
  echo "$HARDCODED_PATHS"
  FAILED=1
else
  echo "✅ PASS: No hardcoded paths"
fi
echo ""

# 5. Database Files Check
echo "5️⃣  Checking for database files..."
DB_FILES=$(git ls-files | grep "\.db$\|\.sqlite$\|\.sqlite3$" || true)
if [ -n "$DB_FILES" ]; then
  echo "❌ FAIL: Found database files in git"
  echo "$DB_FILES"
  FAILED=1
else
  echo "✅ PASS: No database files tracked"
fi
echo ""

# 6. Secrets Pattern Check
echo "6️⃣  Checking for secret patterns..."
SECRETS=$(git ls-files | xargs grep -iE "api[_-]?key\s*=\s*['\"][a-zA-Z0-9]{20,}|secret\s*=\s*['\"][a-zA-Z0-9]{20,}|password\s*=\s*['\"][^'\"]{8,}|token\s*=\s*['\"][a-zA-Z0-9]{20,}" 2>/dev/null | \
  grep -v "README\|CLAUDE\|example\|\.gitignore\|BaseConnector\|bootstrap" || true)
if [ -n "$SECRETS" ]; then
  echo "❌ FAIL: Found potential secrets (hardcoded values)"
  echo "$SECRETS"
  FAILED=1
else
  echo "✅ PASS: No hardcoded secrets found"
fi
echo ""

# 7. Env Files Check
echo "7️⃣  Checking for environment files..."
ENV_FILES=$(git ls-files | grep "^env\.local$\|^\.env$\|env\.production$" || true)
if [ -n "$ENV_FILES" ]; then
  echo "❌ FAIL: Found environment files in git"
  echo "$ENV_FILES"
  FAILED=1
else
  echo "✅ PASS: No env files tracked (env.local.example is OK)"
fi
echo ""

# 8. Email Addresses Check
echo "8️⃣  Checking for email addresses..."
EMAILS=$(git ls-files | xargs grep -iE "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}" 2>/dev/null | \
  grep -v "example@\|noreply@\|sam@sgratzl\|README\|CLAUDE\|package.json\|author" || true)
if [ -n "$EMAILS" ]; then
  echo "❌ FAIL: Found email addresses"
  echo "$EMAILS"
  FAILED=1
else
  echo "✅ PASS: No email addresses found"
fi
echo ""

# 9. IP Addresses Check
echo "9️⃣  Checking for IP addresses..."
IPS=$(git ls-files | xargs grep -E "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b" 2>/dev/null | \
  grep -v "127.0.0.1\|0.0.0.0\|localhost\|README\|example" || true)
if [ -n "$IPS" ]; then
  echo "❌ FAIL: Found IP addresses"
  echo "$IPS"
  FAILED=1
else
  echo "✅ PASS: No IP addresses found"
fi
echo ""

# 10. Large Files Check
echo "🔟 Checking for large files (>1MB)..."
LARGE_FILES=$(git ls-files | while read file; do
  size=$(wc -c < "$file" 2>/dev/null || echo 0)
  if [ $size -gt 1048576 ]; then
    echo "$file ($(($size / 1048576))MB)"
  fi
done)
if [ -n "$LARGE_FILES" ]; then
  echo "⚠️  WARNING: Found large files (consider if they should be tracked)"
  echo "$LARGE_FILES"
  # Don't fail, just warn
else
  echo "✅ PASS: No large files"
fi
echo ""

# Final result
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 1 ]; then
  echo "❌ SECURITY CHECK FAILED"
  echo ""
  echo "Fix the issues above before committing."
  echo ""
  exit 1
else
  echo "✅ SECURITY CHECK PASSED"
  echo ""
  echo "Repository is clean and safe to commit."
  echo ""
  exit 0
fi
