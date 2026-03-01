(function($) {
    'use strict';

    // ============================================
    // Momentum Pro Editor - Inline Editing System
    // ============================================

    var MomentumInlineEditor = {

        currentWidget: null,
        modifications: {},
        isInitialized: false,

        init: function() {
            if (this.isInitialized) return;
            this.isInitialized = true;

            this.bindEvents();
            this.observePreview();
            console.log('Momentum Pro Editor: Inline editing ready');
        },

        // ============================================
        // Event Bindings
        // ============================================
        bindEvents: function() {
            var self = this;

            // Wait for Elementor preview to load
            if (typeof elementor !== 'undefined') {
                elementor.on('preview:loaded', function() {
                    setTimeout(function() {
                        self.setupPreviewListeners();
                    }, 1000);
                });

                // Listen for widget selection
                elementor.channels.editor.on('section:activated', function() {
                    setTimeout(function() {
                        self.setupPreviewListeners();
                    }, 500);
                });
            }
        },

        // ============================================
        // Setup listeners inside the preview iframe
        // ============================================
        setupPreviewListeners: function() {
            var self = this;
            var $preview = this.getPreviewFrame();

            if (!$preview || !$preview.length) return;

            var $outputs = $preview.find('.momentum-html-output');

            $outputs.each(function() {
                var $output = $(this);

                // Skip if already initialized
                if ($output.data('momentum-initialized')) return;
                $output.data('momentum-initialized', true);

                var widgetId = $output.data('widget-id');

                // Load saved modifications
                var savedMods = $output.attr('data-modifications');
                if (savedMods && savedMods !== '{}') {
                    try {
                        self.modifications[widgetId] = JSON.parse(savedMods);
                    } catch(e) {}
                }

                // ---- Make text elements editable ----
                var textSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, label, button, strong, em, b, i, small, blockquote';

                $output.find(textSelectors).each(function() {
                    var $el = $(this);

                    // Skip elements that only contain other elements
                    var hasDirectText = false;
                    this.childNodes.forEach(function(node) {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                            hasDirectText = true;
                        }
                    });

                    if (!hasDirectText && $el.children().length > 0) return;

                    // Make editable
                    $el.attr('contenteditable', 'true');
                    $el.css({
                        'cursor': 'text',
                        'outline': 'none',
                        'min-width': '20px',
                        'min-height': '1em'
                    });

                    // Add edit indicator
                    $el.attr('title', '✏️ اضغط عشان تعدل');

                    // Focus styling
                    $el.on('focus', function() {
                        $(this).css({
                            'outline': '2px solid #6C63FF',
                            'outline-offset': '3px',
                            'background-color': 'rgba(108, 99, 255, 0.05)'
                        });

                        // Show toolbar
                        self.showToolbar($(this), widgetId);
                    });

                    $el.on('blur', function() {
                        $(this).css({
                            'outline': 'none',
                            'background-color': ''
                        });

                        // Save the modification
                        self.saveTextModification($(this), widgetId);

                        // Hide toolbar
                        self.hideToolbar();
                    });

                    // Save on Enter (for headings)
                    $el.on('keydown', function(e) {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            var tag = this.tagName.toLowerCase();
                            if (['h1','h2','h3','h4','h5','h6','li','label','button'].indexOf(tag) !== -1) {
                                e.preventDefault();
                                $(this).blur();
                            }
                        }
                    });

                    // Live save on input
                    $el.on('input', function() {
                        self.saveTextModification($(this), widgetId);
                    });
                });

                // ---- Make images clickable for replacement ----
                $output.find('img').each(function(imgIndex) {
                    var $img = $(this);

                    $img.css('cursor', 'pointer');
                    $img.attr('title', '🖼️ اضغط عشان تغير الصورة');

                    // Add overlay on hover
                    $img.on('mouseenter', function() {
                        var $this = $(this);
                        if ($this.parent('.momentum-img-wrapper').length) return;

                        var wrapper = $('<div class="momentum-img-wrapper" style="position:relative;display:inline-block;"></div>');
                        $this.wrap(wrapper);

                        var overlay = $('<div class="momentum-img-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(108,99,255,0.3);display:flex;align-items:center;justify-content:center;cursor:pointer;border-radius:4px;pointer-events:all;"><span style="background:#6C63FF;color:#fff;padding:8px 16px;border-radius:20px;font-size:13px;font-family:sans-serif;">📷 تغيير الصورة</span></div>');

                        $this.parent().append(overlay);

                        overlay.on('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            self.openMediaLibrary($img, imgIndex, widgetId);
                        });
                    });

                    $img.on('mouseleave', function() {
                        var $wrapper = $(this).parent('.momentum-img-wrapper');
                        if ($wrapper.length) {
                            $wrapper.find('.momentum-img-overlay').remove();
                            $(this).unwrap();
                        }
                    });

                    // Direct click
                    $img.on('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        self.openMediaLibrary($img, imgIndex, widgetId);
                    });
                });

                // Add floating action bar
                self.addActionBar($output, widgetId);
            });
        },

        // ============================================
        // Save text modification
        // ============================================
        saveTextModification: function($el, widgetId) {
            var tag = $el.prop('tagName').toLowerCase();
            var $output = $el.closest('.momentum-html-output');
            var index = $output.find(tag).index($el);
            var selector = tag + ':' + index;

            if (!this.modifications[widgetId]) {
                this.modifications[widgetId] = { texts: {}, images: {} };
            }
            if (!this.modifications[widgetId].texts) {
                this.modifications[widgetId].texts = {};
            }

            // Get text content
            var text = '';
            $el[0].childNodes.forEach(function(node) {
                if (node.nodeType === Node.TEXT_NODE) {
                    text += node.textContent;
                }
            });
            if (text.trim() === '') {
                text = $el.text();
            }

            this.modifications[widgetId].texts[selector] = {
                text: text.trim()
            };

            // Save to Elementor
            this.saveToElementor(widgetId);
        },

        // ============================================
        // Open WordPress Media Library
        // ============================================
        openMediaLibrary: function($img, imgIndex, widgetId) {
            var self = this;

            var frame = wp.media({
                title: 'اختر صورة جديدة',
                button: {
                    text: 'استخدم الصورة دي'
                },
                multiple: false,
                library: {
                    type: 'image'
                }
            });

            frame.on('select', function() {
                var attachment = frame.state().get('selection').first().toJSON();
                var newSrc = attachment.url;

                // Update image
                $img.attr('src', newSrc);

                // Save modification
                if (!self.modifications[widgetId]) {
                    self.modifications[widgetId] = { texts: {}, images: {} };
                }
                if (!self.modifications[widgetId].images) {
                    self.modifications[widgetId].images = {};
                }

                self.modifications[widgetId].images[imgIndex] = {
                    src: newSrc,
                    width: attachment.width,
                    height: attachment.height
                };

                self.saveToElementor(widgetId);

                // Show success
                if (typeof elementor !== 'undefined') {
                    elementor.notifications.showToast({
                        message: '✅ تم تغيير الصورة بنجاح!',
                        duration: 3000
                    });
                }
            });

            frame.open();
        },

        // ============================================
        // Show formatting toolbar
        // ============================================
        showToolbar: function($el, widgetId) {
            var self = this;
            this.hideToolbar();

            var $preview = this.getPreviewBody();
            if (!$preview) return;

            var offset = $el.offset();
            var toolbar = $('<div id="momentum-toolbar" style="position:absolute;z-index:99999;background:#2d2d35;border-radius:8px;padding:6px 10px;display:flex;gap:6px;align-items:center;box-shadow:0 4px 20px rgba(0,0,0,0.3);"></div>');

            // Color picker
            var colorBtn = $('<input type="color" title="لون النص" style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;background:none;" value="' + (self.rgbToHex($el.css('color')) || '#333333') + '">');
            colorBtn.on('input', function() {
                $el.css('color', $(this).val());
                self.saveStyleModification($el, widgetId, 'color', $(this).val());
            });

            // Font size controls
            var currentSize = parseInt($el.css('font-size')) || 16;
            var sizeDown = $('<button title="تصغير الخط" style="background:#444;color:#fff;border:none;border-radius:4px;width:28px;height:28px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">−</button>');
            var sizeDisplay = $('<span style="color:#fff;font-size:12px;min-width:35px;text-align:center;">' + currentSize + 'px</span>');
            var sizeUp = $('<button title="تكبير الخط" style="background:#444;color:#fff;border:none;border-radius:4px;width:28px;height:28px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">+</button>');

            sizeDown.on('click', function(e) {
                e.preventDefault();
                currentSize = Math.max(8, currentSize - 1);
                $el.css('font-size', currentSize + 'px');
                sizeDisplay.text(currentSize + 'px');
                self.saveStyleModification($el, widgetId, 'fontSize', currentSize + 'px');
            });

            sizeUp.on('click', function(e) {
                e.preventDefault();
                currentSize = Math.min(120, currentSize + 1);
                $el.css('font-size', currentSize + 'px');
                sizeDisplay.text(currentSize + 'px');
                self.saveStyleModification($el, widgetId, 'fontSize', currentSize + 'px');
            });

            // Bold toggle
            var boldBtn = $('<button title="عريض" style="background:#444;color:#fff;border:none;border-radius:4px;width:28px;height:28px;cursor:pointer;font-weight:bold;font-size:14px;">B</button>');
            boldBtn.on('click', function(e) {
                e.preventDefault();
                var isBold = $el.css('font-weight') === '700' || $el.css('font-weight') === 'bold';
                var newWeight = isBold ? 'normal' : 'bold';
                $el.css('font-weight', newWeight);
                $(this).css('background', isBold ? '#444' : '#6C63FF');
                self.saveStyleModification($el, widgetId, 'fontWeight', newWeight);
            });

            // Separator
            var sep = $('<div style="width:1px;height:20px;background:#555;"></div>');

            toolbar.append(colorBtn, sep.clone(), sizeDown, sizeDisplay, sizeUp, sep.clone(), boldBtn);

            // Position toolbar above element
            toolbar.css({
                top: (offset.top - 45) + 'px',
                left: offset.left + 'px'
            });

            $preview.append(toolbar);
        },

        hideToolbar: function() {
            var $preview = this.getPreviewBody();
            if ($preview) {
                $preview.find('#momentum-toolbar').remove();
            }
        },

        // ============================================
        // Save style modification
        // ============================================
        saveStyleModification: function($el, widgetId, property, value) {
            var tag = $el.prop('tagName').toLowerCase();
            var $output = $el.closest('.momentum-html-output');
            var index = $output.find(tag).index($el);
            var selector = tag + ':' + index;

            if (!this.modifications[widgetId]) {
                this.modifications[widgetId] = { texts: {}, images: {} };
            }
            if (!this.modifications[widgetId].texts) {
                this.modifications[widgetId].texts = {};
            }
            if (!this.modifications[widgetId].texts[selector]) {
                this.modifications[widgetId].texts[selector] = {};
            }

            this.modifications[widgetId].texts[selector][property] = value;

            this.saveToElementor(widgetId);
        },

        // ============================================
        // Save modifications to Elementor model
        // ============================================
        saveToElementor: function(widgetId) {
            try {
                var modsJson = JSON.stringify(this.modifications[widgetId] || {});

                // Find the widget model
                if (typeof elementor !== 'undefined' && elementor.elements) {
                    var widget = this.findWidgetById(elementor.elements, widgetId);
                    if (widget) {
                        widget.setSetting('saved_modifications', modsJson);
                    }
                }
            } catch(e) {
                console.log('Momentum: Error saving', e);
            }
        },

        // ============================================
        // Find widget by ID recursively
        // ============================================
        findWidgetById: function(elements, widgetId) {
            var found = null;

            elements.forEach(function(element) {
                if (found) return;

                if (element.get('id') === widgetId) {
                    found = element;
                    return;
                }

                var children = element.get('elements');
                if (children && children.length) {
                    found = this.findWidgetById(children, widgetId);
                }
            }.bind(this));

            return found;
        },

        // ============================================
        // Add floating action bar
        // ============================================
        addActionBar: function($output, widgetId) {
            // Action bar appears on hover over the widget
            $output.on('mouseenter', function() {
                if ($(this).find('.momentum-action-bar').length) return;

                var bar = $('<div class="momentum-action-bar" style="position:absolute;top:5px;right:5px;z-index:9999;display:flex;gap:5px;"></div>');

                var editBadge = $('<div style="background:#6C63FF;color:#fff;padding:4px 12px;border-radius:12px;font-size:11px;font-family:sans-serif;pointer-events:none;">✏️ Momentum Editor - اضغط على أي عنصر للتعديل</div>');

                bar.append(editBadge);
                $(this).css('position', 'relative').append(bar);
            });

            $output.on('mouseleave', function() {
                $(this).find('.momentum-action-bar').remove();
            });
        },

        // ============================================
        // Observe preview for dynamic changes
        // ============================================
        observePreview: function() {
            var self = this;

            // Re-setup listeners periodically
            setInterval(function() {
                self.setupPreviewListeners();
            }, 3000);
        },

        // ============================================
        // Helper: Get preview iframe
        // ============================================
        getPreviewFrame: function() {
            try {
                var iframe = document.getElementById('elementor-preview-iframe');
                if (iframe && iframe.contentDocument) {
                    return $(iframe.contentDocument);
                }
            } catch(e) {}
            return null;
        },

        getPreviewBody: function() {
            var $frame = this.getPreviewFrame();
            if ($frame) {
                return $frame.find('body');
            }
            return null;
        },

        // ============================================
        // Helper: RGB to Hex
        // ============================================
        rgbToHex: function(rgb) {
            if (!rgb) return '#333333';
            if (rgb.charAt(0) === '#') return rgb;

            var match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (!match) return '#333333';

            function hex(x) {
                return ("0" + parseInt(x).toString(16)).slice(-2);
            }
            return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
        }
    };

    // ============================================
    // Reset modifications function (global)
    // ============================================
    window.momentumResetModifications = function() {
        if (!confirm('هل إنت متأكد إنك عايز تحذف كل التعديلات وترجع للكود الأصلي؟')) {
            return;
        }

        try {
            var currentElement = elementor.getPanelView().getCurrentPageView().getOption('editedElementView');
            if (currentElement) {
                var widgetId = currentElement.model.get('id');
                MomentumInlineEditor.modifications[widgetId] = {};
                currentElement.model.setSetting('saved_modifications', '{}');

                elementor.notifications.showToast({
                    message: '✅ تم إعادة تعيين كل التعديلات!',
                    duration: 3000
                });

                // Refresh the widget
                currentElement.render();
            }
        } catch(e) {
            console.log('Momentum: Reset error', e);
        }
    };

    // ============================================
    // Initialize
    // ============================================
    $(window).on('elementor:init', function() {
        setTimeout(function() {
            MomentumInlineEditor.init();
        }, 2000);
    });

    // Fallback init
    $(document).ready(function() {
        setTimeout(function() {
            MomentumInlineEditor.init();
        }, 3000);
    });

    window.MomentumInlineEditor = MomentumInlineEditor;

})(jQuery);
