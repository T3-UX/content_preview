<?php
defined('TYPO3') || die();

call_user_func(
    static function () {
        $GLOBALS['TYPO3_CONF_VARS']['FE']['cacheHash']['excludedParameters'][] = 'pce';

        $GLOBALS['TYPO3_CONF_VARS']['SYS']['features']['contentPreview.enable'] =
            $GLOBALS['TYPO3_CONF_VARS']['SYS']['features']['contentPreview.enable'] ?? true;

        $GLOBALS['TYPO3_CONF_VARS']['SYS']['features']['contentPreview.postMessages'] =
            $GLOBALS['TYPO3_CONF_VARS']['SYS']['features']['contentPreview.postMessages'] ?? true;

        $GLOBALS['TYPO3_CONF_VARS']['SC_OPTIONS']['t3lib/class.t3lib_pagerenderer.php']['render-preProcess'][] =
            \T3UX\ContentPreview\Hooks\PageRendererHook::class . '->renderPreProcess';

        $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['content_preview']['pageTypesWhitelist'] = '1';
        $GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['content_preview']['disallowedReturnUrlPaths'] = [
            '/typo3/module/page/link-reports'
        ];
    });