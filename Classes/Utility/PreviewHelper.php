<?php
declare(strict_types=1);

namespace T3UX\ContentPreview\Utility;

use T3UX\ContentPreview\Event\ModifyDisallowedReturnUrlPathsEvent;
use T3UX\ContentPreview\Event\ModifyPreviewPageTypesEvent;
use Psr\EventDispatcher\EventDispatcherInterface;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Core\Configuration\ExtensionConfiguration;
use TYPO3\CMS\Core\Configuration\Features;
use TYPO3\CMS\Core\Utility\GeneralUtility;

final class PreviewHelper implements PreviewHelperInterface
{
    private const EXT_KEY = 'content_preview';

    private array $defaultPageTypes = [1];

    private array $defaultDisallowedReturnUrlPaths = [
        '/typo3/module/page/link-reports',
    ];

    public function shouldAnnotate(ServerRequestInterface $request): bool
    {
        if (!$this->isFeatureFlagEnabled() || !$this->shouldBeUserSeePreview()) {
            return false;
        }
        return $this->isEnabledViaHeader($request) || $this->isEnabledViaQuery($request);
    }

    public function isFeatureFlagEnabled(): bool
    {
        return GeneralUtility::makeInstance(Features::class)->isFeatureEnabled('contentPreview.enable');
    }

    public function isPostMessagesEnabled(): bool
    {
        return GeneralUtility::makeInstance(Features::class)->isFeatureEnabled('contentPreview.postMessages');
    }

    public function shouldBeUserSeePreview(): bool
    {
        $userFeatureFlag = $GLOBALS['BE_USER']?->getTSConfig()['options.']['contentPreview.']['enable'] ?? '';
        return $userFeatureFlag === '' || $userFeatureFlag === 'true' || $userFeatureFlag === '1';
    }

    public function isPageTypeSuitableForPreview(int $pageType): bool
    {
        return in_array($pageType, $this->getAllowedPageTypes(), true);
    }

    /**
     * @return int[]
     */
    public function getAllowedPageTypes(): array
    {
        $types = $this->defaultPageTypes;

        try {
            $extConf = GeneralUtility::makeInstance(ExtensionConfiguration::class)
                ->get(self::EXT_KEY, 'pageTypesWhitelist');
            $types = array_merge($types, $this->normalizeTypes($extConf));
        } catch (\Throwable $e) {
            // ignore
        }

        $tsTypes = $GLOBALS['BE_USER']?->getTSConfig()['options.']['contentPreview.']['pageTypesWhitelist'] ?? null;
        $types = array_merge($types, $this->normalizeTypes($tsTypes));

        /** @var EventDispatcherInterface $dispatcher */
        $dispatcher = GeneralUtility::makeInstance(EventDispatcherInterface::class);
        $event = new ModifyPreviewPageTypesEvent($types);
        $types = $dispatcher->dispatch($event)->getPageTypes();

        return array_values(array_unique(array_filter(
            array_map('intval', $types),
            static fn (int $v): bool => $v >= 0
        )));
    }

    public function isEnabledViaHeader(ServerRequestInterface $request): bool
    {
        return strtolower(trim($request->getHeaderLine('X-Page-Content-Editor'))) === '1';
    }

    public function isEnabledViaQuery(ServerRequestInterface $request): bool
    {
        $q = $request->getQueryParams();
        return isset($q['pce']) && (string)$q['pce'] === '1';
    }

    public function isInPageModuleOrRecordEdit(ServerRequestInterface $request): bool
    {
        $returnUrl = $request->getParsedBody()['returnUrl'] ?? $request->getQueryParams()['returnUrl'] ?? '';
        if ($returnUrl) {
            $path = $this->extractPathFromUrl($returnUrl);
            if ($path !== '' && in_array($path, $this->getDisallowedReturnUrlPaths(), true)) {
                return false;
            }
        }

        $route = $request->getAttribute('route');
        $routeId = (is_object($route) && method_exists($route, 'getOption'))
            ? (string)$route->getOption('_identifier')
            : '';

        return $routeId === 'web_layout' || $routeId === 'record_edit';
    }

    /**
     * @return string[]
     */
    public function getDisallowedReturnUrlPaths(): array
    {
        $paths = $this->defaultDisallowedReturnUrlPaths;

        try {
            $extConf = GeneralUtility::makeInstance(ExtensionConfiguration::class)
                ->get(self::EXT_KEY, 'disallowedReturnUrlPaths');

            if (is_array($extConf)) {
                $paths = array_merge($paths, $extConf);
            } elseif (is_string($extConf) && $extConf !== '') {
                $paths = array_merge($paths, preg_split('/\s*,\s*/', $extConf));
            }
        } catch (\Throwable $e) {
        }

        /** @var EventDispatcherInterface $dispatcher */
        $dispatcher = GeneralUtility::makeInstance(EventDispatcherInterface::class);
        $event = new ModifyDisallowedReturnUrlPathsEvent($paths);
        $paths = $dispatcher->dispatch($event)->getPaths();

        return array_values(array_unique(array_filter(array_map(
            static function ($p) {
                $p = trim((string)$p);
                if ($p !== '' && $p[0] !== '/') {
                    $p = '/' . $p;
                }
                return $p;
            },
            $paths
        ), static fn(string $p) => $p !== '')));
    }

    /**
     * @param mixed $value
     * @return int[]
     */
    private function normalizeTypes(mixed $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }
        if (is_array($value)) {
            return array_map('intval', $value);
        }
        if (is_string($value)) {
            return array_map('intval', preg_split('/\s*,\s*/', $value) ?: []);
        }
        return [];
    }

    private function extractPathFromUrl(string $returnUrl): string
    {
        $decoded = rawurldecode($returnUrl);
        $parts = parse_url($decoded);
        return $parts['path'] ?? '';
    }
}
