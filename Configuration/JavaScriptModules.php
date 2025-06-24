<?php
return [
    'dependencies' => ['backend'],
    'imports' => [
        '@macopedia-pce-split' => 'EXT:content_preview/Resources/Public/Backend/Module/pce-split.js',
        '@macopedia-pce-split-injection' => 'EXT:content_preview/Resources/Public/Backend/Injection/Module/pce-split.js',
    ],
];