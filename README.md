# Momentum Pro Editor

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-GPL--3.0-green.svg)
![Elementor](https://img.shields.io/badge/requires-Elementor-92003B.svg)
![WordPress](https://img.shields.io/badge/WordPress-5.0%2B-21759B.svg)

## 🚀 Overview

**Momentum Pro Editor** is a powerful Elementor widget that lets you write custom HTML code and provides **visual controls** to edit content without touching the code again.

Write your HTML once, then edit texts, images, colors, spacing, and more — all from the Elementor panel!

## ✨ Features

### 📝 Smart HTML Parsing
- Paste any HTML code and click **"Parse Code"**
- The plugin automatically detects all text elements (h1-h6, p, span, a, li, etc.)
- Detects all images with their dimensions
- Extracts existing inline styles

### 🎨 Visual Text Controls
- Edit text content directly from the panel
- Change font colors with color picker
- Adjust font sizes with slider
- Supports up to **20 text elements**

### 🖼️ Image Management
- Replace images using WordPress Media Library
- Adjust width and height with sliders
- Add border radius for rounded corners
- Supports up to **10 images**

### 📏 Spacing Controls
- Container padding (top, right, bottom, left)
- Container margin (top, right, bottom, left)
- Background color for container
- Border radius for container

### 🎯 Custom CSS
- Add custom CSS directly in the widget
- Scoped to the widget output
- Full CSS code editor with syntax highlighting

### 🌙 Editor Features
- Dark mode support in Elementor editor
- Hover highlights on editable elements in preview
- Element type labels on hover
- Success notifications after parsing

## 📦 Installation

### Method 1: Direct Upload
1. Download the repository as ZIP
2. Go to WordPress Admin → **Plugins** → **Add New** → **Upload Plugin**
3. Choose the ZIP file and click **Install Now**
4. Activate the plugin

### Method 2: Manual Installation
1. Clone or download this repository
2. Upload the `momentum-pro-editor` folder to `/wp-content/plugins/`
3. Go to WordPress Admin → **Plugins**
4. Find **Momentum Pro Editor** and click **Activate**

## 🎮 How to Use

### Step 1: Add the Widget
Open Elementor editor and find **"Momentum Pro Editor"** in the **Momentum Pro** category in the widgets panel.

Drag it to your page.

### Step 2: Write Your HTML
Go to the **"📌 كود HTML"** tab and paste your HTML code.

### Step 3: Parse the Code
Click the **"🔄 حلّل الكود وأنشئ التعديلات"** button.

The plugin will analyze your code and create visual controls for each element.

### Step 4: Edit Visually
Switch to the **"📝 النصوص"** tab to edit text content, colors, and font sizes.

Switch to the **"🖼️ الصور"** tab to replace images and adjust dimensions.

Switch to the **"📏 المسافات"** tab (in Style) to adjust padding, margin, and background.

### Step 5: Add Custom CSS (Optional)
Go to the **"🎨 CSS إضافي"** tab in Style to add any custom CSS rules.

## ⚙️ Requirements

- **WordPress** 5.0 or higher
- **Elementor** 3.0 or higher (Free or Pro)
- **PHP** 7.4 or higher

## 🔧 Technical Details

- Built with Elementor Widget API
- Uses PHP DOMDocument for server-side HTML parsing
- Uses JavaScript DOMParser for client-side parsing
- Supports RTL languages (Arabic, Hebrew, etc.)
- Responsive and mobile-friendly output
- Clean, well-documented code

## 📄 Changelog

### 1.0.0 (2025)
- Initial release
- HTML code input with syntax highlighting
- Smart HTML parsing engine
- Visual text editing controls (up to 20 elements)
- Image management controls (up to 10 elements)
- Spacing and layout controls
- Custom CSS support
- Dark mode support
- RTL support

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Yasser** - [momentummix.com](https://momentummix.com/)

---

Made with ❤️ for the WordPress & Elementor community
## 📁 File Structure

