<?php

use T3UX\ContentPreview\Middleware\PageContentEditorPreviewMiddleware;
use TYPO3\CMS\Core\Configuration\Features;
use TYPO3\CMS\Core\Utility\GeneralUtility;

$features = GeneralUtility::makeInstance(Features::class);

if (!$features->isFeatureEnabled('contentPreview.enable')) {
    return [];
}

return [
    'frontend' => [
        'macopedia/page-content-editor/preview' => [
            'target' => PageContentEditorPreviewMiddleware::class,
            'before' => ['typo3/cms-frontend/content-length-headers'],
        ],
    ],
];
