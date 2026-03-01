(function($) {
    'use strict';

    var MomentumEditor = {

        modifications: {},
        isReady: false,

        init: function() {
            if (this.isReady) return;
            this.isReady = true;
            this.listen();
            console.log('Momentum Pro Editor: Ready');
        },

        listen: function() {
            var self = this;

            if (typeof elementor === 'undefined') return;

            elementor.on('preview:loaded', function() {
                setTimeout(function() { self.setup(); }, 1500);
            });

            elementor.channels.editor.on('section:activated', function() {
                setTimeout(function() { self.setup(); }, 800);
            });

            // Re-check every few seconds for new widgets
            setInterval(function() { self.setup(); }, 4000);
        },

        getIframe: function() {
            try {
                var iframe = document.getElementById('elementor-preview-iframe');
                if (iframe && iframe.contentDocument) {
                    return $(iframe.contentDocument);
                }
            } catch(e) {}
            return null;
        },

        getIframeBody: function() {
            var doc = this.getIframe();
            return doc ? doc.find('body') : null;
        },

        setup: function() {
            var self = this;
            var $doc = this.getIframe();
            if (!$doc) return;

            $doc.find('.momentum-html-output').each(function() {
                var $output = $(this);
                if ($output.data('m-bound')) return;
                $output.data('m-bound', true);

                var widgetId = $output.data('widget-id');

                self.setupTexts($output, widgetId);
                self.setupImages($output, widgetId);
            });
        },

        // ============================================
        // TEXT EDITING
        // ============================================
        setupTexts: function($output, widgetId) {
            var self = this;
            var tags = 'h1,h2,h3,h4,h5,h6,p,span,a,li,td,th,label,button,strong,em,b,i,small,blockquote';

            $output.find(tags).each(function() {
                var $el = $(this);
                var el = this;

                // Check if element has direct text
                var hasText = false;
                for (var i = 0; i < el.childNodes.length; i++) {
                    if (el.childNodes[i].nodeType === 3 && el.childNodes[i].textContent.trim() !== '') {
                        hasText = true;
                        break;
                    }
                }
                if (!hasText && $el.children().length > 0) return;

                // Skip if already bound
                if ($el.data('m-text-bound')) return;
                $el.data('m-text-bound', true);

                $el.attr('contenteditable', 'true');
                $el.css('cursor', 'text');

                // Prevent link navigation
                if ($el.is('a')) {
                    $el.on('click.momentum', function(e) { e.preventDefault(); });
                }

                // Hover
                $el.on('mouseenter.momentum', function() {
                    if (!$(this).is(':focus')) {
                        $(this).css({
                            'outline': '2px dashed rgba(108,99,255,0.5)',
                            'outline-offset': '2px'
                        });
                    }
                }).on('mouseleave.momentum', function() {
                    if (!$(this).is(':focus')) {
                        $(this).css('outline', 'none');
                    }
                });

                // Focus
                $el.on('focus.momentum', function() {
                    $(this).css({
                        'outline': '2px solid #6C63FF',
                        'outline-offset': '3px'
                    });
                    self.showToolbar($(this), widgetId);
                });

                // Blur - save
                $el.on('blur.momentum', function() {
                    $(this).css('outline', 'none');
                    self.hideToolbar();
                    self.saveText($(this), widgetId);
                });

                // Also save on input for live saving
                $el.on('input.momentum', function() {
                    self.saveText($(this), widgetId);
                });
            });
        },

        saveText: function($el, widgetId) {
            var tag = $el.prop('tagName').toLowerCase();
            var $output = $el.closest('.momentum-html-output');
            var allSameTag = $output.find(tag);
            var index = allSameTag.index($el);
            var key = tag + ':' + index;

            if (!this.modifications[widgetId]) {
                this.modifications[widgetId] = { texts: {}, images: {} };
            }

            // Get only direct text
            var text = '';
            for (var i = 0; i < $el[0].childNodes.length; i++) {
                if ($el[0].childNodes[i].nodeType === 3) {
                    text += $el[0].childNodes[i].textContent;
                }
            }
            text = text.trim() || $el.text().trim();

            if (!this.modifications[widgetId].texts[key]) {
                this.modifications[widgetId].texts[key] = {};
            }
            this.modifications[widgetId].texts[key].text = text;

            this.pushToElementor(widgetId);
        },

        // ============================================
        // TOOLBAR
        // ============================================
        showToolbar: function($el, widgetId) {
            var self = this;
            this.hideToolbar();

            var $body = this.getIframeBody();
            if (!$body) return;

            var offset = $el.offset();

            var $bar = $('<div id="m-toolbar"></div>').css({
                position: 'absolute',
                zIndex: 999999,
                top: (offset.top - 48) + 'px',
                left: Math.max(10, offset.left) + 'px',
                background: '#1e1e2e',
                borderRadius: '10px',
                padding: '6px 12px',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
                border: '1px solid #333'
            });

            // --- Bold ---
            var isBold = ($el.css('font-weight') === '700' || $el.css('font-weight') === 'bold');
            var $bold = self.toolBtn('B', 'عريض', isBold);
            $bold.css('font-weight', 'bold');
            $bold.on('mousedown', function(e) {
                e.preventDefault();
                var nowBold = ($el.css('font-weight') === '700' || $el.css('font-weight') === 'bold');
                var val = nowBold ? 'normal' : 'bold';
                $el.css('font-weight', val);
                $(this).css('background', nowBold ? '#333' : '#6C63FF');
                self.saveStyle($el, widgetId, 'fontWeight', val);
            });

            // --- Font Size Up ---
            var currentSize = parseInt($el.css('font-size')) || 16;
            var $sizeUp = self.toolBtn('+', 'تكبير');
            var $sizeLabel = $('<span></span>').css({ color: '#fff', fontSize: '12px', minWidth: '40px', textAlign: 'center' }).text(currentSize + 'px');
            var $sizeDown = self.toolBtn('−', 'تصغير');

            $sizeUp.on('mousedown', function(e) {
                e.preventDefault();
                currentSize = Math.min(200, currentSize + 1);
                $el.css('font-size', currentSize + 'px');
                $sizeLabel.text(currentSize + 'px');
                self.saveStyle($el, widgetId, 'fontSize', currentSize + 'px');
            });

            $sizeDown.on('mousedown', function(e) {
                e.preventDefault();
                currentSize = Math.max(6, currentSize - 1);
                $el.css('font-size', currentSize + 'px');
                $sizeLabel.text(currentSize + 'px');
                self.saveStyle($el, widgetId, 'fontSize', currentSize + 'px');
            });

            // --- Color ---
            var currentColor = self.rgbToHex($el.css('color')) || '#333333';
            var $color = $('<input type="color">').val(currentColor).css({
                width: '30px',
                height: '30px',
                border: '2px solid #555',
                borderRadius: '6px',
                cursor: 'pointer',
                padding: '0',
                background: 'none'
            }).attr('title', 'لون النص');

            $color.on('input', function() {
                var c = $(this).val();
                $el.css('color', c);
                self.saveStyle($el, widgetId, 'color', c);
            });

            // Separator
            var $sep = $('<div></div>').css({ width: '1px', height: '22px', background: '#444' });

            $bar.append($bold, $sep.clone(), $sizeDown, $sizeLabel, $sizeUp, $sep.clone(), $color);
            $body.append($bar);
        },

        toolBtn: function(text, title, active) {
            return $('<button></button>').text(text).attr('title', title).css({
                background: active ? '#6C63FF' : '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                width: '30px',
                height: '30px',
                cursor: 'pointer',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s'
            }).on('mouseenter', function() {
                if ($(this).css('background-color') !== 'rgb(108, 99, 255)') {
                    $(this).css('background', '#444');
                }
            }).on('mouseleave', function() {
                if ($(this).css('background-color') !== 'rgb(108, 99, 255)') {
                    $(this).css('background', '#333');
                }
            });
        },

        hideToolbar: function() {
            var $body = this.getIframeBody();
            if ($body) $body.find('#m-toolbar').remove();
        },

        saveStyle: function($el, widgetId, prop, val) {
            var tag = $el.prop('tagName').toLowerCase();
            var $output = $el.closest('.momentum-html-output');
            var index = $output.find(tag).index($el);
            var key = tag + ':' + index;

            if (!this.modifications[widgetId]) {
                this.modifications[widgetId] = { texts: {}, images: {} };
            }
            if (!this.modifications[widgetId].texts[key]) {
                this.modifications[widgetId].texts[key] = {};
            }

            this.modifications[widgetId].texts[key][prop] = val;
            this.pushToElementor(widgetId);
        },

        // ============================================
        // IMAGES
        // ============================================
        setupImages: function($output, widgetId) {
            var self = this;

            $output.find('img').each(function(imgIdx) {
                var $img = $(this);

                if ($img.data('m-img-bound')) return;
                $img.data('m-img-bound', true);

                $img.css('cursor', 'pointer');

                $img.on('mouseenter.momentum', function() {
                    $(this).css({
                        'outline': '3px solid #6C63FF',
                        'outline-offset': '3px'
                    });
                }).on('mouseleave.momentum', function() {
                    $(this).css('outline', 'none');
                });

                $img.on('click.momentum', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    self.pickImage($img, imgIdx, widgetId);
                });
            });
        },

        pickImage: function($img, imgIdx, widgetId) {
            var self = this;

            if (!wp || !wp.media) {
                // wp.media not available in preview iframe, use parent
                if (window.parent && window.parent.wp && window.parent.wp.media) {
                    var frame = window.parent.wp.media({
                        title: 'اختر صورة جديدة',
                        button: { text: 'استخدم الصورة دي' },
                        multiple: false,
                        library: { type: 'image' }
                    });

                    frame.on('select', function() {
                        var attachment = frame.state().get('selection').first().toJSON();
                        $img.attr('src', attachment.url);

                        if (!self.modifications[widgetId]) {
                            self.modifications[widgetId] = { texts: {}, images: {} };
                        }
                        if (!self.modifications[widgetId].images) {
                            self.modifications[widgetId].images = {};
                        }
                        self.modifications[widgetId].images[imgIdx] = { src: attachment.url };
                        self.pushToElementor(widgetId);
                    });

                    frame.open();
                }
                return;
            }

            var frame = wp.media({
                title: 'اختر صورة جديدة',
                button: { text: 'استخدم الصورة دي' },
                multiple: false,
                library: { type: 'image' }
            });

            frame.on('select', function() {
                var attachment = frame.state().get('selection').first().toJSON();
                $img.attr('src', attachment.url);

                if (!self.modifications[widgetId]) {
                    self.modifications[widgetId] = { texts: {}, images: {} };
                }
                if (!self.modifications[widgetId].images) {
                    self.modifications[widgetId].images = {};
                }
                self.modifications[widgetId].images[imgIdx] = { src: attachment.url };
                self.pushToElementor(widgetId);
            });

            frame.open();
        },

        // ============================================
        // SAVE TO ELEMENTOR
        // ============================================
        pushToElementor: function(widgetId) {
            try {
                var json = JSON.stringify(this.modifications[widgetId] || {});
                var widget = this.findWidget(elementor.elements, widgetId);
                if (widget) {
                    widget.setSetting('saved_modifications', json);
                }
            } catch(e) {
                console.log('Momentum save error:', e);
            }
        },

        findWidget: function(elements, id) {
            var result = null;
            elements.forEach(function(el) {
                if (result) return;
                if (el.get('id') === id) {
                    result = el;
                    return;
                }
                var children = el.get('elements');
                if (children && children.length) {
                    result = this.findWidget(children, id);
                }
            }.bind(this));
            return result;
        },

        // ============================================
        // HELPERS
        // ============================================
        rgbToHex: function(rgb) {
            if (!rgb) return '#333333';
            if (rgb.charAt(0) === '#') return rgb;
            var m = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
            if (!m) return '#333333';
            return '#' + ((1 << 24) + (parseInt(m[1]) << 16) + (parseInt(m[2]) << 8) + parseInt(m[3])).toString(16).slice(1);
        }
    };

    // ============================================
    // RESET FUNCTION
    // ============================================
    window.momentumResetModifications = function() {
        if (!confirm('متأكد إنك عايز تحذف كل التعديلات؟')) return;

        try {
            var view = elementor.getPanelView().getCurrentPageView().getOption('editedElementView');
            if (view) {
                var wid = view.model.get('id');
                MomentumEditor.modifications[wid] = {};
                view.model.setSetting('saved_modifications', '{}');
                view.render();

                elementor.notifications.showToast({
                    message: '✅ تم إعادة تعيين التعديلات',
                    duration: 3000
                });
            }
        } catch(e) {
            console.log('Reset error:', e);
        }
    };

    // ============================================
    // INIT
    // ============================================
    function startMomentum() {
        if (typeof elementor !== 'undefined') {
            MomentumEditor.init();
        } else {
            setTimeout(startMomentum, 1000);
        }
    }

    $(window).on('elementor:init', function() {
        setTimeout(startMomentum, 1000);
    });

    $(document).ready(function() {
        setTimeout(startMomentum, 2000);
    });

    window.MomentumInlineEditor = MomentumEditor;

})(jQuery);
