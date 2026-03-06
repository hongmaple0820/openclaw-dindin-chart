#!/bin/bash
# Fix TypeScript migration issues for all root JS files

SRC_DIR="/home/maple/.openclaw/projects/openclaw-dindin-chart/chat-hub/src"

# Function to add export {} at the end of a file if it uses module.exports
add_module_marker() {
    local file="$1"
    if grep -q "module.exports" "$file" && ! grep -q "^export {}$" "$file"; then
        echo "" >> "$file"
        echo "// Make this a module" >> "$file"
        echo "export {};" >> "$file"
    fi
}

# Fix each file
for f in "$SRC_DIR"/*.ts; do
    echo "Processing $f..."
    add_module_marker "$f"
done

echo "Done adding module markers"