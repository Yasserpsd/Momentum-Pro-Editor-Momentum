<?php
/**
 * Plugin Name: Momentum Pro Editor
 * Description: Elementor widget - Visual HTML Editor with inline text selection styling
 * Version: 4.0.0
 * Author: Yasser Momentum
 * Author URI: https://momentummix.com/
 * License: GPL v3
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: momentum-pro-editor
 * Requires Plugins: elementor
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'MOMENTUM_PRO_VERSION', '4.0.0' );
define( 'MOMENTUM_PRO_PATH', plugin_dir_path( __FILE__ ) );
define( 'MOMENTUM_PRO_URL', plugin_dir_url( __FILE__ ) );

final class Momentum_Pro_Editor {

    private static $_instance = null;

    public static function instance() {
        if ( is_null( self::$_instance ) ) {
            self::$_instance = new self();
        }
        return self::$_instance;
    }

    public function __construct() {
        add_action( 'plugins_loaded', [ $this, 'init' ] );
    }

    public function init() {
        if ( ! did_action( 'elementor/loaded' ) ) {
            add_action( 'admin_notices', [ $this, 'admin_notice_missing_elementor' ] );
            return;
        }

        add_action( 'elementor/elements/categories_registered', [ $this, 'register_categories' ] );
        add_action( 'elementor/widgets/register', [ $this, 'register_widgets' ] );
        add_action( 'elementor/editor/before_enqueue_scripts', [ $this, 'editor_scripts' ] );
        add_action( 'elementor/preview/enqueue_scripts', [ $this, 'preview_scripts' ] );
        add_action( 'elementor/frontend/after_enqueue_styles', [ $this, 'frontend_styles' ] );
        add_action( 'wp_ajax_momentum_sync_code', [ $this, 'ajax_sync_code' ] );
    }

    public function admin_notice_missing_elementor() {
        echo '<div class="notice notice-warning is-dismissible"><p>Momentum Pro Editor requires Elementor.</p></div>';
    }

    public function register_categories( $em ) {
        $em->add_category( 'momentum-pro', [
            'title' => 'Momentum Pro',
            'icon'  => 'fa fa-code',
        ] );
    }

    public function register_widgets( $wm ) {
        require_once MOMENTUM_PRO_PATH . 'widgets/html-pro-widget.php';
        $wm->register( new \Momentum_HTML_Pro_Widget() );
    }

    public function editor_scripts() {
        wp_enqueue_style(
            'momentum-editor-css',
            MOMENTUM_PRO_URL . 'assets/css/editor-style.css',
            [],
            MOMENTUM_PRO_VERSION
        );
        wp_enqueue_script(
            'momentum-editor-js',
            MOMENTUM_PRO_URL . 'assets/js/editor-controls.js',
            [ 'jquery', 'elementor-editor' ],
            MOMENTUM_PRO_VERSION,
            true
        );
        wp_localize_script( 'momentum-editor-js', 'momentumAjax', [
            'url'   => admin_url( 'admin-ajax.php' ),
            'nonce' => wp_create_nonce( 'momentum_sync_nonce' ),
        ] );
    }

    public function preview_scripts() {
        wp_enqueue_style(
            'momentum-preview-css',
            MOMENTUM_PRO_URL . 'assets/css/preview-style.css',
            [],
            MOMENTUM_PRO_VERSION
        );
        wp_enqueue_script(
            'momentum-preview-js',
            MOMENTUM_PRO_URL . 'assets/js/parser.js',
            [ 'jquery' ],
            MOMENTUM_PRO_VERSION,
            true
        );
        wp_enqueue_media();
    }

    public function frontend_styles() {
        wp_enqueue_style(
            'momentum-frontend-css',
            MOMENTUM_PRO_URL . 'assets/css/frontend-style.css',
            [],
            MOMENTUM_PRO_VERSION
        );
    }

    public function ajax_sync_code() {
        check_ajax_referer( 'momentum_sync_nonce', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( 'No permission' );
        }

        $html = wp_unslash( $_POST['html'] ?? '' );

        if ( empty( $html ) ) {
            wp_send_json_error( 'Missing data' );
        }

        // The HTML coming from the preview is already the final modified version
        // We just need to clean it up
        $clean_html = $this->clean_editor_artifacts( $html );

        wp_send_json_success( [ 'html' => $clean_html ] );
    }

    /**
     * Remove editor-only artifacts from HTML before saving
     */
    private function clean_editor_artifacts( $html ) {
        // Remove contenteditable attributes
        $html = preg_replace( '/\s*contenteditable\s*=\s*"[^"]*"/i', '', $html );

        // Remove editor outline styles
        $html = preg_replace( '/\s*outline\s*:\s*[^;]*;?/i', '', $html );
        $html = preg_replace( '/\s*outline-offset\s*:\s*[^;]*;?/i', '', $html );

        // Remove cursor:text
        $html = preg_replace( '/\s*cursor\s*:\s*text\s*;?/i', '', $html );

        // Remove empty style attributes
        $html = preg_replace( '/\s*style\s*=\s*"\s*"/i', '', $html );

        // Remove m-badge
        $html = preg_replace( '/<div class="m-badge"[^>]*>.*?<\/div>/is', '', $html );

        // Remove data-m attributes
        $html = preg_replace( '/\s*data-m-[a-z0-9-]+\s*=\s*"[^"]*"/i', '', $html );

        return trim( $html );
    }
}

Momentum_Pro_Editor::instance();
