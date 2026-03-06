#!/bin/bash
# Batch fix TypeScript migration issues for root directory files

SRC_DIR="/home/maple/.openclaw/projects/openclaw-dindin-chart/chat-hub/src"

# Add export {} to all root .ts files that use module.exports and don't have export {}
for f in "$SRC_DIR"/*.ts; do
    if grep -q "module.exports" "$f" && ! grep -q "^export {}" "$f"; then
        echo "Adding export {} to $f"
        echo "" >> "$f"
        echo "export {};" >> "$f"
    fi
done

echo "Done adding export {} to files"