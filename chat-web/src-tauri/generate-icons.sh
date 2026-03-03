#!/bin/bash
# Tauri 图标生成脚本
# 需要 ImageMagick (convert 命令)

ICONS_DIR="icons"
mkdir -p "$ICONS_DIR"

# 检查 ImageMagick
if ! command -v convert &> /dev/null; then
    echo "请先安装 ImageMagick:"
    echo "  Ubuntu/Debian: sudo apt install imagemagick"
    echo "  macOS: brew install imagemagick"
    exit 1
fi

# 如果有源图标，使用它
if [ -f "app-icon.png" ]; then
    SOURCE="app-icon.png"
else
    echo "创建简单的渐变图标..."
    # 创建一个简单的渐变图标作为示例
    convert -size 512x512 xc:transparent \
        -fill "#4A90D9" -draw "roundrectangle 50,50 462,462 80,80" \
        -fill "#FFFFFF" -font Arial -pointsize 200 -gravity center \
        -annotate 0 "枫" \
        "$ICONS_DIR/icon.png"
    SOURCE="$ICONS_DIR/icon.png"
fi

echo "生成各尺寸图标..."

# PNG 图标
convert "$SOURCE" -resize 32x32 "$ICONS_DIR/32x32.png"
convert "$SOURCE" -resize 128x128 "$ICONS_DIR/128x128.png"
convert "$SOURCE" -resize 256x256 "$ICONS_DIR/icon.png"

# macOS icns (需要 png2icns 或 sips)
if command -v png2icns &> /dev/null; then
    png2icns "$ICONS_DIR/icon.icns" "$ICONS_DIR/icon.png"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    mkdir -p "$ICONS_DIR/icon.iconset"
    convert "$SOURCE" -resize 16x16 "$ICONS_DIR/icon.iconset/icon_16x16.png"
    convert "$SOURCE" -resize 32x32 "$ICONS_DIR/icon.iconset/icon_16x16@2x.png"
    convert "$SOURCE" -resize 32x32 "$ICONS_DIR/icon.iconset/icon_32x32.png"
    convert "$SOURCE" -resize 64x64 "$ICONS_DIR/icon.iconset/icon_32x32@2x.png"
    convert "$SOURCE" -resize 128x128 "$ICONS_DIR/icon.iconset/icon_128x128.png"
    convert "$SOURCE" -resize 256x256 "$ICONS_DIR/icon.iconset/icon_128x128@2x.png"
    convert "$SOURCE" -resize 256x256 "$ICONS_DIR/icon.iconset/icon_256x256.png"
    convert "$SOURCE" -resize 512x512 "$ICONS_DIR/icon.iconset/icon_256x256@2x.png"
    convert "$SOURCE" -resize 512x512 "$ICONS_DIR/icon.iconset/icon_512x512.png"
    convert "$SOURCE" -resize 1024x1024 "$ICONS_DIR/icon.iconset/icon_512x512@2x.png"
    iconutil -c icns "$ICONS_DIR/icon.iconset" -o "$ICONS_DIR/icon.icns"
    rm -rf "$ICONS_DIR/icon.iconset"
else
    echo "警告: 无法生成 icns，请手动创建或使用在线工具"
fi

# Windows ico
convert "$SOURCE" -resize 256x256 -define icon:auto-resize=256,128,64,48,32,16 "$ICONS_DIR/icon.ico"

echo "✅ 图标生成完成！"
echo "生成的文件："
ls -la "$ICONS_DIR"
