(function($) {
    'use strict';

    /**
     * Momentum Pro Editor - Preview Inline Editor
     * Handles inline editing directly in the Elementor preview
     */
    var MomentumPreview = {

        init: function() {
            this.setupInlineEditing();
            this.watchForNewWidgets();
            console.log('Momentum Preview: Inline editing active');
        },

        // ============================================
        // Setup inline editing for all momentum widgets
        // ============================================
        setupInlineEditing: function() {
            var self = this;

            $('.momentum-html-output').each(function() {
                var $output = $(this);

                if ($output.data('momentum-preview-init')) return;
                $output.data('momentum-preview-init', true);

                // Only in editor mode
                if (!$('body').hasClass('elementor-editor-active')) return;

                // ---- Text Elements ----
                var textSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, li, td, th, label, button, strong, em, b, i, small, blockquote';

                $output.find(textSelectors).each(function() {
                    var $el = $(this);

                    // Check for direct text
                    var hasDirectText = false;
                    this.childNodes.forEach(function(node) {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() !== '') {
                            hasDirectText = true;
                        }
                    });

                    if (!hasDirectText && $el.children().length > 0) return;

                    // Make contenteditable
                    $el.attr('contenteditable', 'true');
                    $el.css({
                        'cursor': 'text',
                        'outline': 'none'
                    });

                    // Hover effect
                    $el.on('mouseenter', function() {
                        if (!$(this).is(':focus')) {
                            $(this).css({
                                'outline': '2px dashed rgba(108, 99, 255, 0.4)',
                                'outline-offset': '2px'
                            });
                        }
                    });

                    $el.on('mouseleave', function() {
                        if (!$(this).is(':focus')) {
                            $(this).css({
                                'outline': 'none'
                            });
                        }
                    });

                    // Focus effect
                    $el.on('focus', function() {
                        $(this).css({
                            'outline': '2px solid #6C63FF',
                            'outline-offset': '3px',
                            'background-color': 'rgba(108, 99, 255, 0.03)'
                        });

                        // Show element tag label
                        self.showElementLabel($(this));
                    });

                    $el.on('blur', function() {
                        $(this).css({
                            'outline': 'none',
                            'background-color': ''
                        });
                        self.hideElementLabel();

                        // Notify parent frame about the change
                        self.notifyParentOfChange($output);
                    });

                    // Prevent default link behavior
                    if ($el.is('a')) {
                        $el.on('click', function(e) {
                            e.preventDefault();
                        });
                    }
                });

                // ---- Images ----
                $output.find('img').each(function() {
                    var $img = $(this);

                    $img.css('cursor', 'pointer');

                    $img.on('mouseenter', function() {
                        $(this).css({
                            'outline': '2px dashed rgba(76, 175, 80, 0.5)',
                            'outline-offset': '3px'
                        });

                        // Show change overlay
                        self.showImageOverlay($(this));
                    });

                    $img.on('mouseleave', function() {
                        $(this).css({
                            'outline': 'none'
                        });

                        self.hideImageOverlay($(this));
                    });
                });
            });
        },

        // ============================================
        // Show element tag label
        // ============================================
        showElementLabel: function($el) {
            this.hideElementLabel();

            var tag = $el.prop('tagName').toLowerCase();
            var tagLabels = {
                'h1': 'عنوان رئيسي H1',
                'h2': 'عنوان H2',
                'h3': 'عنوان H3',
                'h4': 'عنوان H4',
                'h5': 'عنوان H5',
                'h6': 'عنوان H6',
                'p': 'فقرة',
                'span': 'نص',
                'a': 'رابط',
                'li': 'عنصر قائمة',
                'label': 'تسمية',
                'button': 'زر',
                'strong': 'نص عريض',
                'em': 'نص مائل',
                'blockquote': 'اقتباس',
                'small': 'نص صغير'
            };

            var label = tagLabels[tag] || tag;
            var offset = $el.offset();

            var $label = $('<div id="momentum-el-label" style="position:absolute;z-index:99999;background:#6C63FF;color:#fff;font-size:11px;padding:3px 10px;border-radius:3px;font-family:sans-serif;pointer-events:none;white-space:nowrap;">' + label + ' ✏️</div>');

            $label.css({
                top: (offset.top - 25) + 'px',
                left: offset.left + 'px'
            });

            $('body').append($label);
        },

        hideElementLabel: function() {
            $('#momentum-el-label').remove();
        },

        // ============================================
        // Image overlay
        // ============================================
        showImageOverlay: function($img) {
            if ($img.parent('.momentum-img-hover-wrap').length) return;

            var $wrapper = $('<div class="momentum-img-hover-wrap" style="position:relative;display:inline-block;"></div>');
            $img.wrap($wrapper);

            var $overlay = $('<div class="momentum-img-hover-overlay" style="position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(108,99,255,0.25);display:flex;align-items:center;justify-content:center;pointer-events:none;border-radius:4px;"><span style="background:#6C63FF;color:#fff;padding:6px 14px;border-radius:16px;font-size:12px;font-family:sans-serif;">📷 اضغط لتغيير الصورة</span></div>');

            $img.parent().append($overlay);
        },

        hideImageOverlay: function($img) {
            var $wrapper = $img.parent('.momentum-img-hover-wrap');
            if ($wrapper.length) {
                $wrapper.find('.momentum-img-hover-overlay').remove();
                $img.unwrap();
            }
        },

        // ============================================
        // Notify parent frame (Elementor editor)
        // ============================================
        notifyParentOfChange: function($output) {
            try {
                var widgetId = $output.data('widget-id');
                var htmlContent = $output.html();

                // Remove any style tags from content before saving
                var $temp = $('<div>').html(htmlContent);
                $temp.find('style').remove();
                $temp.find('#momentum-el-label').remove();
                $temp.find('.momentum-action-bar').remove();
                $temp.find('.momentum-img-hover-overlay').remove();
                $temp.find('[contenteditable]').removeAttr('contenteditable');

                // Clean up inline styles added by editor
                $temp.find('*').each(function() {
                    var style = $(this).attr('style') || '';
                    style = style.replace(/cursor\s*:\s*text\s*;?/g, '');
                    style = style.replace(/outline\s*:\s*[^;]+;?/g, '');
                    style = style.replace(/outline-offset\s*:\s*[^;]+;?/g, '');
                    style = style.replace(/min-width\s*:\s*20px\s*;?/g, '');
                    style = style.replace(/min-height\s*:\s*1em\s*;?/g, '');
                    style = style.replace(/background-color\s*:\s*rgba\(108,\s*99,\s*255[^)]*\)\s*;?/g, '');
                    style = style.trim().replace(/;+/g, ';').replace(/^;|;$/g, '');
                    if (style) {
                        $(this).attr('style', style);
                    } else {
                        $(this).removeAttr('style');
                    }
                });

                var cleanHTML = $temp.html();

                // Send to parent
                if (window.parent && window.parent.MomentumInlineEditor) {
                    window.parent.MomentumInlineEditor.saveToElementor(widgetId);
                }
            } catch(e) {
                console.log('Momentum Preview: Error notifying parent', e);
            }
        },

        // ============================================
        // Watch for dynamically added widgets
        // ============================================
        watchForNewWidgets: function() {
            var self = this;

            // MutationObserver for new widgets
            var observer = new MutationObserver(function(mutations) {
                var shouldSetup = false;
                mutations.forEach(function(mutation) {
                    if (mutation.addedNodes.length) {
                        $(mutation.addedNodes).each(function() {
                            if ($(this).find('.momentum-html-output').length || $(this).hasClass('momentum-html-output')) {
                                shouldSetup = true;
                            }
                        });
                    }
                });

                if (shouldSetup) {
                    setTimeout(function() {
                        self.setupInlineEditing();
                    }, 500);
                }
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            // Also re-check periodically
            setInterval(function() {
                self.setupInlineEditing();
            }, 3000);
        }
    };

    // ============================================
    // Initialize
    // ============================================
    $(document).ready(function() {
        // Small delay to ensure everything is loaded
        setTimeout(function() {
            MomentumPreview.init();
        }, 1000);
    });

    window.MomentumPreview = MomentumPreview;

})(jQuery);
