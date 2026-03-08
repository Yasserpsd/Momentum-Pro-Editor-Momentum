(function($) {
    'use strict';

    var MomentumPanel = {

        initialized: false,
        _syncInProgress: false,

        init: function() {
            if (this.initialized) return;
            this.initialized = true;
            this.listenToSyncRequest();
            this.injectBranding();
            console.log('[Momentum] Panel: Ready v7.1 (Manual Sync Only - Fixed)');
        },

        injectBranding: function() {
            var checkBranding = setInterval(function() {
                var $sections = $('.elementor-control-section_html_code .elementor-panel-heading-title');
                if ($sections.length) {
                    clearInterval(checkBranding);
                    $('.elementor-control-section_html_code, .elementor-control-section_spacing, .elementor-control-section_css').each(function() {
                        var $title = $(this).find('.elementor-panel-heading-title');
                        if ($title.length && !$title.data('m-branded')) {
                            $title.data('m-branded', true);
                            $title.prepend('<span style="display:inline-block;width:8px;height:8px;background:linear-gradient(135deg,#6C63FF,#4CAF50);border-radius:50%;margin-right:6px;vertical-align:middle;"></span>');
                        }
                    });
                }
            }, 1000);
        },

        listenToSyncRequest: function() {
            var self = this;
            window.addEventListener('message', function(e) {
                if (!e.data) return;
                if (e.data.type === 'momentum-request-sync') {
                    self.syncToCode(e.data.widgetId, e.data.html);
                }
            });
        },

        syncToCode: function(widgetId, liveHtml) {
            var self = this;

            if (self._syncInProgress) {
                return;
            }
            self._syncInProgress = true;

            var widget = self.findWidget(widgetId);

            if (!widget) {
                widget = self.findWidgetFallback(widgetId);
            }

            if (!widget) {
                self._syncInProgress = false;
                console.warn('[Momentum] Cannot sync - widget not found');
                self.updateStatus('❌ لم يتم العثور على الويدجت', 'error');
                return;
            }

            var $btn = $('#momentum-sync-btn');
            var originalText = $btn.html();
            $btn.html('⏳ جاري المزامنة...').prop('disabled', true).css('opacity', '0.7');
            self.updateStatus('⏳ جاري المزامنة...', 'loading');

            $.ajax({
                url: momentumAjax.url,
                type: 'POST',
                data: {
                    action: 'momentum_sync_code',
                    nonce: momentumAjax.nonce,
                    html: liveHtml
                },
                timeout: 15000,
                success: function(response) {
                    $btn.html(originalText).prop('disabled', false).css('opacity', '1');

                    if (response.success && response.data && response.data.html) {
                        var newHtml = response.data.html;

                        try {
                            // === الإصلاح الرئيسي: حفظ الكود بدون re-render ===
                            if (typeof $e !== 'undefined' && $e.run) {
                                var container = self.getContainer(widget);
                                if (container) {
                                    $e.run('document/elements/settings', {
                                        container: container,
                                        settings: { html_code: newHtml },
                                        options: { external: true }
                                    });
                                } else {
                                    // fallback لو مفيش container
                                    self.setSetting(widget, 'html_code', newHtml);
                                }
                            } else {
                                self.setSetting(widget, 'html_code', newHtml);
                            }

                            // أرسل رسالة للـ preview إن السنك تم
                            try {
                                var previewFrame = elementor.$preview && elementor.$preview[0];
                                if (previewFrame && previewFrame.contentWindow) {
                                    previewFrame.contentWindow.postMessage({
                                        type: 'momentum-code-synced',
                                        widgetId: widgetId
                                    }, '*');
                                }
                            } catch(e2) {}

                            self.updateStatus('✅ تم المزامنة', 'success');
                            console.log('[Momentum] Code synced successfully!');

                        } catch(settingsError) {
                            console.error('[Momentum] Settings update error:', settingsError);
                            self.updateStatus('⚠️ تم المزامنة - اضغط حفظ', 'warning');

                            try {
                                var $codeEditor = $('.elementor-control-html_code textarea');
                                if ($codeEditor.length) {
                                    $codeEditor.val(newHtml).trigger('input').trigger('change');
                                }
                            } catch(e3) {}
                        }
                    } else {
                        console.error('[Momentum] Sync failed:', response);
                        self.updateStatus('❌ فشل المزامنة', 'error');
                    }

                    self._syncInProgress = false;
                },
                error: function(xhr, status, error) {
                    $btn.html(originalText).prop('disabled', false).css('opacity', '1');
                    console.error('[Momentum] Sync AJAX error:', error);
                    self.updateStatus('❌ خطأ في الاتصال', 'error');
                    self._syncInProgress = false;
                }
            });
        },

        setSetting: function(widget, key, value) {
            try {
                var settings = widget.get('settings');
                if (settings && typeof settings.set === 'function') {
                    settings.set(key, value, { silent: true }); // silent عشان ما يعملش re-render
                } else if (typeof widget.setSetting === 'function') {
                    widget.setSetting(key, value);
                }
            } catch(e) {
                console.warn('[Momentum] setSetting fallback error:', e);
            }
        },

        getContainer: function(widget) {
            try {
                if (typeof elementor !== 'undefined' && elementor.getContainer) {
                    var id = (typeof widget.get === 'function') ? widget.get('id') : widget.id;
                    return elementor.getContainer(id);
                }
            } catch(e) {}
            return null;
        },

        updateStatus: function(msg, type) {
            var $status = $('#momentum-sync-status');
            if (!$status.length) return;

            var colors = {
                'success': '#4CAF50',
                'error': '#e74c3c',
                'warning': '#FF9800',
                'loading': '#6C63FF'
            };

            $status.html(msg).css('color', colors[type] || '#888');

            if (type !== 'loading') {
                setTimeout(function() {
                    $status.fadeOut(300, function() {
                        $(this).html('').css('display', '').css('color', '#888');
                    });
                }, 3000);
            }
        },

        findWidget: function(id) {
            var result = null;

            function search(collection) {
                if (result) return;
                if (!collection) return;

                var models = collection.models || (Array.isArray(collection) ? collection : null);
                if (!models) return;

                for (var i = 0; i < models.length; i++) {
                    if (result) return;
                    var model = models[i];
                    if (!model) continue;

                    var modelId = (typeof model.get === 'function') ? model.get('id') : model.id;

                    if (modelId === id) {
                        result = model;
                        return;
                    }

                    var children = (typeof model.get === 'function') ? model.get('elements') : null;
                    if (children && (children.length || (children.models && children.models.length))) {
                        search(children);
                    }
                }
            }

            try {
                if (typeof elementor !== 'undefined' && elementor.elements) {
                    search(elementor.elements);
                }
            } catch(e) {
                console.warn('[Momentum] findWidget error:', e);
            }

            return result;
        },

        findWidgetFallback: function(widgetId) {
            try {
                var panel = elementor.getPanelView();
                if (!panel) return null;
                var page = panel.getCurrentPageView();
                if (!page) return null;
                var editedView = page.getOption('editedElementView');
                if (editedView && editedView.model) {
                    var currentId = editedView.model.get('id');
                    if (currentId === widgetId) {
                        return editedView.model;
                    }
                }
            } catch(e) {}
            return null;
        }
    };

    // ============================================
    // SYNC BUTTON FUNCTION
    // ============================================
    window.momentumSyncToCode = function() {
        try {
            var previewFrame = elementor.$preview && elementor.$preview[0];
            if (!previewFrame || !previewFrame.contentWindow) {
                console.warn('[Momentum] Preview frame not found');
                return;
            }

            var panel = elementor.getPanelView();
            if (!panel) return;

            var currentPage = panel.getCurrentPageView();
            if (!currentPage) return;
            var editedView = currentPage.getOption('editedElementView');
            if (!editedView || !editedView.model) return;

            var widgetId = editedView.model.get('id');

            previewFrame.contentWindow.postMessage({
                type: 'momentum-get-html',
                widgetId: widgetId
            }, '*');
        } catch(e) {
            console.error('[Momentum] Sync button error:', e);
            $('#momentum-sync-status').html('❌ خطأ - حاول تاني').css('color', '#e74c3c');
        }
    };

    // Init
    $(window).on('elementor:init', function() {
        MomentumPanel.init();
    });

    $(document).ready(function() {
        setTimeout(function() {
            if (typeof elementor !== 'undefined') MomentumPanel.init();
        }, 2000);
    });

})(jQuery);
