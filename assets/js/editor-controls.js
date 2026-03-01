(function($) {
    'use strict';

    // Make function available globally for the button onclick
    window.momentumParseHTML = function(button) {
        var panel = $(button).closest('.elementor-controls-stack');
        var widget = momentumGetCurrentWidget();
        
        if (!widget) {
            alert('⚠️ مفيش widget متحدد. جرب تاني.');
            return;
        }

        var model = widget.model;
        var htmlCode = model.getSetting('html_code');

        if (!htmlCode || htmlCode.trim() === '') {
            alert('⚠️ اكتب كود HTML الأول!');
            return;
        }

        // Parse the HTML
        var parser = new DOMParser();
        var doc = parser.parseFromString(htmlCode, 'text/html');

        // Find all text elements
        var textTags = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'a', 'li', 'td', 'th', 'label', 'button', 'strong', 'em', 'b', 'i', 'small', 'blockquote'];
        var textCounter = 0;
        var settingsToUpdate = {};

        // Reset all text fields first
        for (var r = 1; r <= 20; r++) {
            settingsToUpdate['text_element_tag_' + r] = '';
            settingsToUpdate['text_element_index_' + r] = '';
            settingsToUpdate['text_content_' + r] = '';
        }
        for (var r = 1; r <= 10; r++) {
            settingsToUpdate['img_element_src_' + r] = '';
            settingsToUpdate['img_element_index_' + r] = '';
        }

        // Parse text elements
        textTags.forEach(function(tag) {
            var elements = doc.querySelectorAll(tag);
            elements.forEach(function(el, index) {
                textCounter++;
                if (textCounter > 20) return;

                var textContent = '';
                // Get direct text content
                var childNodes = el.childNodes;
                for (var c = 0; c < childNodes.length; c++) {
                    if (childNodes[c].nodeType === Node.TEXT_NODE) {
                        textContent += childNodes[c].textContent;
                    }
                }
                textContent = textContent.trim();

                if (textContent === '') {
                    textContent = el.textContent.trim();
                }

                settingsToUpdate['text_element_tag_' + textCounter] = tag;
                settingsToUpdate['text_element_index_' + textCounter] = String(index);
                settingsToUpdate['text_content_' + textCounter] = textContent;

                // Extract existing color
                var style = el.getAttribute('style') || '';
                var colorMatch = style.match(/color\s*:\s*([^;]+)/);
                if (colorMatch) {
                    settingsToUpdate['text_color_' + textCounter] = colorMatch[1].trim();
                }

                // Extract existing font-size
                var sizeMatch = style.match(/font-size\s*:\s*(\d+)(px|em|rem)/);
                if (sizeMatch) {
                    settingsToUpdate['text_size_' + textCounter] = {
                        size: parseInt(sizeMatch[1]),
                        unit: sizeMatch[2]
                    };
                }
            });
        });

        // Parse image elements
        var images = doc.querySelectorAll('img');
        var imgCounter = 0;

        images.forEach(function(img, index) {
            imgCounter++;
            if (imgCounter > 10) return;

            var src = img.getAttribute('src') || '';
            var width = img.getAttribute('width') || '';
            var height = img.getAttribute('height') || '';

            settingsToUpdate['img_element_src_' + imgCounter] = src;
            settingsToUpdate['img_element_index_' + imgCounter] = String(index);

            if (width) {
                settingsToUpdate['img_width_' + imgCounter] = {
                    size: parseInt(width),
                    unit: 'px'
                };
            }

            if (height) {
                settingsToUpdate['img_height_' + imgCounter] = {
                    size: parseInt(height),
                    unit: 'px'
                };
            }

            // Extract border-radius from style
            var style = img.getAttribute('style') || '';
            var radiusMatch = style.match(/border-radius\s*:\s*(\d+)(px|%)/);
            if (radiusMatch) {
                settingsToUpdate['img_border_radius_' + imgCounter] = {
                    size: parseInt(radiusMatch[1]),
                    unit: radiusMatch[2]
                };
            }
        });

        // Apply all settings at once
        Object.keys(settingsToUpdate).forEach(function(key) {
            model.setSetting(key, settingsToUpdate[key]);
        });

        // Force panel refresh
        var currentPageView = elementor.getPanelView().getCurrentPageView();
        if (currentPageView && currentPageView.render) {
            setTimeout(function() {
                currentPageView.render();
            }, 100);
        }

        // Show success message
        var textCount = textCounter;
        var imgCount = imgCounter;

        elementor.notifications.showToast({
            message: '✅ تم تحليل الكود! تم العثور على ' + textCount + ' نص و ' + imgCount + ' صورة',
            duration: 4000
        });
    };

    // Helper function to get current widget
    function momentumGetCurrentWidget() {
        try {
            var currentElement = elementor.getPanelView().getCurrentPageView().getOption('editedElementView');
            return currentElement || null;
        } catch (e) {
            // Fallback method
            try {
                var selection = elementor.selection.getElements();
                if (selection && selection.length > 0) {
                    return selection[0];
                }
            } catch (e2) {
                console.log('Momentum: Could not get current widget', e2);
            }
            return null;
        }
    }

    // Listen for widget changes and auto-refresh preview
    $(document).ready(function() {
        if (typeof elementor !== 'undefined') {
            elementor.on('frontend:init', function() {
                console.log('Momentum Pro Editor: Initialized');
            });
        }
    });

})(jQuery);
