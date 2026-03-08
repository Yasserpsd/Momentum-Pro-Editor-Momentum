<?php
/**
 * Plugin Name: Momentum Pro Editor
 * Description: Elementor widget - Visual HTML Editor with inline text selection styling
 * Version: 7.0.0
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

define( 'MOMENTUM_PRO_VERSION', '7.0.0' );
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

    /**
     * AJAX: Manual Sync Only
     */
    public function ajax_sync_code() {
        check_ajax_referer( 'momentum_sync_nonce', 'nonce' );

        if ( ! current_user_can( 'edit_posts' ) ) {
            wp_send_json_error( 'No permission' );
        }

        $html = wp_unslash( $_POST['html'] ?? '' );

        if ( empty( $html ) ) {
            wp_send_json_error( 'Missing data' );
        }

        $clean_html = $this->safe_clean_html( $html );

        wp_send_json_success( [ 'html' => $clean_html ] );
    }

    /**
     * Safe HTML cleaning using DOMDocument
     */
    private function safe_clean_html( $html ) {
        if ( empty( $html ) ) return $html;

        $dom = new \DOMDocument();
        libxml_use_internal_errors( true );

        $flags = LIBXML_HTML_NOIMPLIED;
        if ( defined( 'LIBXML_HTML_NODEFDTD' ) ) {
            $flags |= LIBXML_HTML_NODEFDTD;
        }

        $wrapped = '<div id="m-safe-root">' . $html . '</div>';
        $dom->loadHTML( '<?xml encoding="UTF-8">' . $wrapped, $flags );
        libxml_clear_errors();

        $xpath = new \DOMXPath( $dom );

        // 1. Remove m-badge elements
        $badges = $xpath->query( '//*[contains(@class, "m-badge")]' );
        if ( $badges ) {
            foreach ( $badges as $badge ) {
                $badge->parentNode->removeChild( $badge );
            }
        }

        // 2. Remove toolbar/overlay elements
        $toolbars = $xpath->query( '//*[@id="m-toolbar"] | //*[@id="m-link-editor"] | //*[contains(@class, "m-img-bar")] | //*[contains(@class, "m-box-bar")] | //*[contains(@class, "m-resize-h")] | //*[contains(@class, "m-notify")]' );
        if ( $toolbars ) {
            foreach ( $toolbars as $tb ) {
                $tb->parentNode->removeChild( $tb );
            }
        }

        // 3. Remove only editor-specific attributes from ALL elements
        $all_elements = $xpath->query( '//*' );
        if ( $all_elements ) {
            foreach ( $all_elements as $el ) {
                $el->removeAttribute( 'contenteditable' );

                $attrs_to_remove = [];
                foreach ( $el->attributes as $attr ) {
                    if ( strpos( $attr->name, 'data-m4-' ) === 0 ||
                         strpos( $attr->name, 'data-m-' ) === 0 ||
                         $attr->name === 'data-widget-id' ||
                         $attr->name === 'data-m3' ||
                         $attr->name === 'data-m4-init' ) {
                        $attrs_to_remove[] = $attr->name;
                    }
                }
                foreach ( $attrs_to_remove as $attr_name ) {
                    $el->removeAttribute( $attr_name );
                }

                $style = $el->getAttribute( 'style' );
                if ( $style ) {
                    $clean_style = $this->clean_editor_styles_only( $style );
                    if ( $clean_style ) {
                        $el->setAttribute( 'style', $clean_style );
                    } else {
                        $el->removeAttribute( 'style' );
                    }
                }
            }
        }

        // 4. Remove the momentum-editable class but keep other classes
        $editables = $xpath->query( '//*[contains(@class, "momentum-editable")]' );
        if ( $editables ) {
            foreach ( $editables as $editable ) {
                $classes = $editable->getAttribute( 'class' );
                $classes = preg_replace( '/\bmomentum-editable\b/', '', $classes );
                $classes = trim( preg_replace( '/\s+/', ' ', $classes ) );
                if ( $classes ) {
                    $editable->setAttribute( 'class', $classes );
                } else {
                    $editable->removeAttribute( 'class' );
                }
            }
        }

        $root = $dom->getElementById( 'm-safe-root' );
        $output = '';
        if ( $root ) {
            foreach ( $root->childNodes as $child ) {
                $output .= $dom->saveHTML( $child );
            }
        }

        return $output ?: $html;
    }

    /**
     * Remove ONLY editor-injected CSS properties
     */
    private function clean_editor_styles_only( $style ) {
        if ( empty( $style ) ) return '';

        $properties = array_filter( array_map( 'trim', explode( ';', $style ) ) );
        $clean_props = [];

        $editor_only_patterns = [
            '/^outline\s*:/i',
            '/^outline-offset\s*:/i',
            '/^cursor\s*:\s*text\s*$/i',
            '/^-webkit-tap-highlight-color\s*:/i',
        ];

        foreach ( $properties as $prop ) {
            $is_editor_prop = false;
            foreach ( $editor_only_patterns as $pattern ) {
                if ( preg_match( $pattern, trim( $prop ) ) ) {
                    $is_editor_prop = true;
                    break;
                }
            }
            if ( ! $is_editor_prop ) {
                $clean_props[] = trim( $prop );
            }
        }

        return implode( '; ', $clean_props );
    }
}

Momentum_Pro_Editor::instance();
