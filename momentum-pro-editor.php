<?php
/**
 * Plugin Name: Momentum Pro Editor
 * Description: Elementor widget that parses HTML code and provides visual controls for easy editing — with live code sync
 * Version: 3.0.0
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

define( 'MOMENTUM_PRO_VERSION', '3.0.0' );
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

        // Editor panel scripts
        add_action( 'elementor/editor/before_enqueue_scripts', [ $this, 'editor_scripts' ] );

        // Preview iframe scripts
        add_action( 'elementor/preview/enqueue_scripts', [ $this, 'preview_scripts' ] );

        // Frontend styles only
        add_action( 'elementor/frontend/after_enqueue_styles', [ $this, 'frontend_styles' ] );

        // AJAX handler for code sync
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

        // Media library for image replacement
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

    /**
     * AJAX: Sync modifications back to HTML code
     */
    public function ajax_sync_code() {
        check_ajax_referer( 'momentum_sync_nonce', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( 'No permission' );
        }

        $html = wp_unslash( $_POST['html'] ?? '' );
        $mods = json_decode( wp_unslash( $_POST['mods'] ?? '{}' ), true );

        if ( empty( $html ) || empty( $mods ) ) {
            wp_send_json_error( 'Missing data' );
        }

        // Apply modifications to HTML using the same logic as render
        $widget = new \Momentum_HTML_Pro_Widget();
        $new_html = $widget->public_apply_mods( $html, $mods );

        wp_send_json_success( [ 'html' => $new_html ] );
    }
}

Momentum_Pro_Editor::instance();
