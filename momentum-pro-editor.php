<?php
/**
 * Plugin Name: Momentum Pro Editor
 * Description: Elementor widget - Visual HTML Editor with inline text selection styling
 * Version: 7.1.0
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

define( 'MOMENTUM_PRO_VERSION', '7.1.0' );
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
        echo '<div class="notice notice-warning is-dismissible"><p><strong>Momentum Pro Editor</strong> requires <strong>Elementor</strong> to be installed and activated.</p></div>';
    }

    public function register_categories( $em ) {
        $em->add_category( 'momentum-pro', [
            'title' => '⚡ Momentum Pro',
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

        // === الإصلاح الرئيسي: استخدام Regex بدل DOMDocument ===
        $clean_html = $this->safe_clean_html( $html );

        wp_send_json_success( [ 'html' => $clean_html ] );
    }

    /**
     * تنظيف HTML من عناصر الإديتور باستخدام Regex
     * بدل DOMDocument اللي كان بيشوّه هيكل الـ HTML
     */
    private function safe_clean_html( $html ) {
        if ( empty( $html ) ) return $html;

        // =============================================
        // 1. إزالة عناصر UI الخاصة بالإديتور
        // =============================================

        // إزالة الـ badge
        $html = preg_replace( '/<div[^>]*class="[^"]*\bm-badge\b[^"]*"[^>]*>.*?<\/div>/is', '', $html );

        // إزالة الـ toolbar
        $html = preg_replace( '/<div[^>]*id="m-toolbar"[^>]*>.*?<\/div>/is', '', $html );

        // إزالة الـ link editor
        $html = preg_replace( '/<div[^>]*id="m-link-editor"[^>]*>.*?<\/div>/is', '', $html );

        // إزالة الـ image bar
        $html = preg_replace( '/<div[^>]*class="[^"]*\bm-img-bar\b[^"]*"[^>]*>.*?<\/div>/is', '', $html );

        // إزالة الـ box bar
        $html = preg_replace( '/<div[^>]*class="[^"]*\bm-box-bar\b[^"]*"[^>]*>.*?<\/div>/is', '', $html );

        // إزالة الـ resize handle
        $html = preg_replace( '/<div[^>]*class="[^"]*\bm-resize-h\b[^"]*"[^>]*>.*?<\/div>/is', '', $html );

        // إزالة الـ notifications
        $html = preg_replace( '/<div[^>]*class="[^"]*\bm-notify\b[^"]*"[^>]*>.*?<\/div>/is', '', $html );

        // إزالة الـ custom CSS styles اللي بيضيفها الإديتور
        $html = preg_replace( '/<style[^>]*class="[^"]*momentum-custom-css[^"]*"[^>]*>.*?<\/style>/is', '', $html );
        $html = preg_replace( '/<style[^>]*class="[^"]*momentum-responsive-css[^"]*"[^>]*>.*?<\/style>/is', '', $html );

        // =============================================
        // 2. إزالة attributes الخاصة بالإديتور
        // =============================================

        // إزالة contenteditable
        $html = preg_replace( '/\s+contenteditable="[^"]*"/i', '', $html );
        $html = preg_replace( '/\s+contenteditable=\'[^\']*\'/i', '', $html );
        $html = preg_replace( '/\s+contenteditable(?=[\s>\/])/i', '', $html );

        // إزالة data attributes الخاصة بالإديتور
        $html = preg_replace( '/\s+data-m4-[a-z0-9_-]+="[^"]*"/i', '', $html );
        $html = preg_replace( '/\s+data-m-[a-z0-9_-]+="[^"]*"/i', '', $html );
        $html = preg_replace( '/\s+data-m3="[^"]*"/i', '', $html );
        $html = preg_replace( '/\s+data-m4-init="[^"]*"/i', '', $html );
        $html = preg_replace( '/\s+data-auto-sync="[^"]*"/i', '', $html );
        $html = preg_replace( '/\s+data-widget-id="[^"]*"/i', '', $html );

        // =============================================
        // 3. تنظيف الـ classes الخاصة بالإديتور
        // =============================================
        $html = preg_replace_callback( '/\bclass="([^"]*)"/i', function( $m ) {
            $classes = $m[1];
            // إزالة classes الإديتور فقط
            $classes = preg_replace( '/\bmomentum-editable\b/', '', $classes );
            $classes = preg_replace( '/\bmomentum-html-output\b/', '', $classes );
            $classes = trim( preg_replace( '/\s+/', ' ', $classes ) );
            if ( ! empty( $classes ) ) {
                return 'class="' . $classes . '"';
            }
            return ''; // إزالة الـ attribute كله لو فاضي
        }, $html );

        // =============================================
        // 4. تنظيف editor-only inline styles
        // =============================================
        $html = preg_replace_callback( '/\bstyle="([^"]*)"/i', function( $m ) {
            $style = $m[1];

            // إزالة الـ styles اللي بيضيفها الإديتور بس
            $style = preg_replace( '/\boutline\s*:[^;]*;?\s*/i', '', $style );
            $style = preg_replace( '/\boutline-offset\s*:[^;]*;?\s*/i', '', $style );
            $style = preg_replace( '/\bcursor\s*:\s*text\s*;?\s*/i', '', $style );
            $style = preg_replace( '/\b-webkit-tap-highlight-color\s*:[^;]*;?\s*/i', '', $style );

            $style = trim( $style, " \t\n\r\0\x0B;" );

            if ( ! empty( $style ) ) {
                // نتأكد إن الـ style بيخلص بـ semicolon
                if ( substr( $style, -1 ) !== ';' ) {
                    $style .= ';';
                }
                return 'style="' . $style . '"';
            }
            return ''; // إزالة الـ attribute كله لو فاضي
        }, $html );

        // =============================================
        // 5. تنظيف نهائي
        // =============================================

        // إزالة attributes فاضية متبقية
        $html = preg_replace( '/\s+(class|style|id)=""\s*/i', ' ', $html );

        // إزالة مسافات زيادة بين الـ tags
        $html = preg_replace( '/>\s{2,}</', '> <', $html );

        // إزالة مسافات زيادة داخل الـ tags
        $html = preg_replace( '/\s{2,}/', ' ', $html );

        // تنظيف سطور فاضية
        $html = preg_replace( '/\n{3,}/', "\n\n", $html );

        return trim( $html );
    }
}

Momentum_Pro_Editor::instance();
