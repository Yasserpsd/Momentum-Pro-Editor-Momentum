(function($) {
    'use strict';

    /**
     * Momentum Pro Editor v2.1 - Editor Panel Script
     * Runs in the Elementor EDITOR (parent window, not preview iframe)
     * Handles: saving modifications from preview, reset button
     */

    var MomentumPanel = {

        initialized: false,

        init: function() {
            if (this.initialized) return;
            this.initialized = true;
            this.listenToPreview();
            console.log('Momentum Panel v2.1: Ready');
        },

        listenToPreview: function() {
            var self = this;

            // Listen for messages from preview iframe
            window.addEventListener('message', function(e) {
                if (!e.data || e.data.type !== 'momentum-save') return;

                var widgetId = e.data.widgetId;
                var mods     = e.data.modifications;

                if (!widgetId || !mods) return;

                try {
                    var widget = self.findWidget(widgetId);
                    if (widget) {
                        widget.setSetting('saved_modifications', JSON.stringify(mods));
                        console.log('Momentum: Saved mods for', widgetId);
                    } else {
                        console.warn('Momentum: Widget not found:', widgetId);
                    }
                } catch(err) {
                    console.error('Momentum save error:', err);
                }
            });
        },

        /**
         * Recursively search Elementor elements (Backbone Collections) for a widget by ID
         */
        findWidget: function(id) {
            var result = null;

            function search(collection) {
                if (result) return;
                if (!collection) return;

                // Handle Backbone Collection
                var models = collection.models || collection;
                if (!models) return;

                for (var i = 0; i < models.length; i++) {
                    if (result) return;

                    var model = models[i];
                    if (!model) continue;

                    // Get ID
                    var modelId;
                    if (typeof model.get === 'function') {
                        modelId = model.get('id');
                    } else if (model.id) {
                        modelId = model.id;
                    }

                    if (modelId === id) {
                        result = model;
                        return;
                    }

                    // Search children
                    var children;
                    if (typeof model.get === 'function') {
                        children = model.get('elements');
                    }
                    if (children && children.length) {
                        search(children);
                    }
                }
            }

            if (typeof elementor !== 'undefined' && elementor.elements) {
                search(elementor.elements);
            }

            return result;
        }
    };

    /**
     * Reset modifications button handler
     */
    window.momentumResetModifications = function() {
        if (!confirm('متأكد إنك عايز تحذف كل التعديلات وترجع للكود الأصلي؟')) return;

        try {
            var panel = elementor.getPanelView();
            if (!panel) return;

            var currentPage = panel.getCurrentPageView();
            if (!currentPage) return;

            var editedView = currentPage.getOption('editedElementView');
            if (editedView && editedView.model) {
                editedView.model.setSetting('saved_modifications', '{}');

                // Force re-render
                if (typeof editedView.model.renderRemoteServer === 'function') {
                    editedView.model.renderRemoteServer();
                } else {
                    editedView.render();
                }

                // Notify preview iframe to reset
                var previewFrame = elementor.$preview && elementor.$preview[0];
                if (previewFrame && previewFrame.contentWindow) {
                    previewFrame.contentWindow.postMessage({
                        type: 'momentum-reset',
                        widgetId: editedView.model.get('id')
                    }, '*');
                }

                elementor.notifications.showToast({
                    message: '✅ تم إعادة تعيين التعديلات',
                    duration: 3000
                });
            }
        } catch(e) {
            console.error('Momentum reset error:', e);
        }
    };

    // Initialize when Elementor is ready
    $(window).on('elementor:init', function() {
        MomentumPanel.init();
    });

    // Fallback initialization
    $(document).ready(function() {
        setTimeout(function() {
            if (typeof elementor !== 'undefined') {
                MomentumPanel.init();
            }
        }, 2000);
    });

})(jQuery);
