(function($) {
    'use strict';

    var MomentumPanel = {

        initialized: false,

        init: function() {
            if (this.initialized) return;
            this.initialized = true;
            this.listenToSyncRequest();
            console.log('[Momentum] Panel: Ready v4.0');
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

        /**
         * Sync the live HTML from preview back into the code editor
         */
        syncToCode: function(widgetId, liveHtml) {
            var self = this;
            var widget = self.findWidget(widgetId);

            if (!widget) {
                widget = self.findWidgetFallback(widgetId);
            }

            if (!widget) {
                console.warn('[Momentum] Cannot sync - widget not found');
                if (typeof elementor !== 'undefined' && elementor.notifications) {
                    elementor.notifications.showToast({
                        message: '❌ لم يتم العثور على الويدجت',
                        duration: 3000
                    });
                }
                return;
            }

            // Send HTML to server for cleanup
            $.ajax({
                url: momentumAjax.url,
                type: 'POST',
                data: {
                    action: 'momentum_sync_code',
                    nonce: momentumAjax.nonce,
                    html: liveHtml
                },
                success: function(response) {
                    if (response.success && response.data && response.data.html) {
                        var newHtml = response.data.html;
                        var settings = widget.get('settings');

                        if (settings && typeof settings.set === 'function') {
                            settings.set('html_code', newHtml, { silent: false });
                        } else {
                            widget.setSetting('html_code', newHtml);
                        }

                        // Notify preview
                        try {
                            var previewFrame = elementor.$preview && elementor.$preview[0];
                            if (previewFrame && previewFrame.contentWindow) {
                                previewFrame.contentWindow.postMessage({
                                    type: 'momentum-code-synced',
                                    widgetId: widgetId
                                }, '*');
                            }
                        } catch(e2) {}

                        if (typeof elementor !== 'undefined' && elementor.notifications) {
                            elementor.notifications.showToast({
                                message: '✅ تم مزامنة الكود بنجاح!',
                                duration: 3000
                            });
                        }

                        console.log('[Momentum] Code synced successfully!');
                    } else {
                        console.error('[Momentum] Sync failed:', response);
                        if (typeof elementor !== 'undefined' && elementor.notifications) {
                            elementor.notifications.showToast({
                                message: '❌ فشل المزامنة',
                                duration: 3000
                            });
                        }
                    }
                },
                error: function(xhr, status, error) {
                    console.error('[Momentum] Sync AJAX error:', error);
                }
            });
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

            if (typeof elementor !== 'undefined' && elementor.elements) {
                search(elementor.elements);
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
    // SYNC BUTTON (called from panel button)
    // ============================================
    window.momentumSyncToCode = function() {
        try {
            // Ask the preview to send us the current live HTML
            var previewFrame = elementor.$preview && elementor.$preview[0];
            if (previewFrame && previewFrame.contentWindow) {
                // Get current widget ID
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
            }
        } catch(e) {
            console.error('[Momentum] Sync button error:', e);
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
