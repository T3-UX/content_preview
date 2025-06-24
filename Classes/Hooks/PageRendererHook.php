<?php

declare(strict_types=1);

namespace T3UX\ContentPreview\Hooks;

use Doctrine\DBAL\ParameterType;
use T3UX\ContentPreview\Utility\PreviewHelper;
use Psr\Http\Message\ServerRequestInterface;
use TYPO3\CMS\Backend\Module\ModuleData;
use TYPO3\CMS\Backend\Routing\PreviewUriBuilder;
use TYPO3\CMS\Backend\Routing\UriBuilder as BackendUriBuilder;
use TYPO3\CMS\Backend\Utility\BackendUtility;
use TYPO3\CMS\Core\Database\ConnectionPool;
use TYPO3\CMS\Core\Http\ApplicationType;
use TYPO3\CMS\Core\Http\Uri;
use TYPO3\CMS\Core\Page\JavaScriptModuleInstruction;
use TYPO3\CMS\Core\Page\PageRenderer;
use TYPO3\CMS\Core\Routing\Route;
use TYPO3\CMS\Core\Utility\GeneralUtility;
use TYPO3\CMS\Core\Utility\PathUtility;

final class PageRendererHook
{
    /**
     * TYPO3 hook entrypoint
     * @param array<string,mixed> $params
     */
    public function renderPreProcess(array $params): void
    {
        $request = $GLOBALS['TYPO3_REQUEST'] ?? null;
        if (!$request instanceof ServerRequestInterface) {
            return;
        }

        if (!$this->shouldProcess($request)) {
            return;
        }

        $context = $this->resolveContext($request);
        if ($context === null) {
            return;
        }

        $this->bootSplitModule($context['pageId'], $request);
    }

    private function shouldProcess(ServerRequestInterface $request): bool
    {
        if (!ApplicationType::fromRequest($request)->isBackend()) {
            return false;
        }

        $helper = GeneralUtility::makeInstance(PreviewHelper::class);

        if (!$helper->isInPageModuleOrRecordEdit($request)) {
            return false;
        }

        if ($helper->shouldBeUserSeePreview() === false) {
            return false;
        }

        return true;
    }

    /**
     * @return array{pageId:int, language:int}|null
     */
    private function resolveContext(ServerRequestInterface $request): ?array
    {
        $routeId = $this->getRouteId($request);

        return match ($routeId) {
            'web_layout'   => $this->resolveFromWebLayout($request),
            'record_edit'  => $this->resolveFromRecordEdit($request),
            default        => null,
        };
    }

    private function getRouteId(ServerRequestInterface $request): string
    {
        /** @var Route|null $route */
        $route = $request->getAttribute('route');

        return is_object($route) && method_exists($route, 'getOption')
            ? (string)$route->getOption('_identifier')
            : '';
    }

    /**
     * @return array{pageId:int, language:int}|null
     */
    private function resolveFromWebLayout(ServerRequestInterface $request): ?array
    {
        $pageId = (int)($request->getParsedBody()['id'] ?? $request->getQueryParams()['id'] ?? 0);
        $language = (int)($request->getQueryParams()['language'] ?? 0);

        if ($pageId <= 0 || $language === -1) {
            return null;
        }

        $doktype = $this->fetchPageDoktype($pageId);
        if ($doktype === null) {
            return null;
        }

        if (!GeneralUtility::makeInstance(PreviewHelper::class)->isPageTypeSuitableForPreview($doktype)) {
            return null;
        }

        return ['pageId' => $pageId, 'language' => $language];
    }

    /**
     * @return array{pageId:int, language:int}|null
     */
    private function resolveFromRecordEdit(ServerRequestInterface $request): ?array
    {
        $qp = $request->getQueryParams();
        $pb = $request->getParsedBody();
        $edit = $qp['edit']['tt_content'] ?? $pb['edit']['tt_content'] ?? [];

        if (!is_array($edit) || $edit === []) {
            return null;
        }

        $firstKey = array_key_first($edit);
        $focusUid = (int)$firstKey;
        if ($focusUid <= 0) {
            return null;
        }

        $row = $this->fetchTtContentMeta($focusUid);
        if ($row === null) {
            return null;
        }

        $pageId = ($edit[$firstKey] === 'edit') ? (int)$row['pid'] : $focusUid;

        $language = (int)$row['sys_language_uid'];
        if ($language === -1) {
            $language = 0;
        }

        return ['pageId' => $pageId, 'language' => $language];
    }

    private function fetchPageDoktype(int $pageId): ?int
    {
        $qb = GeneralUtility::makeInstance(ConnectionPool::class)->getQueryBuilderForTable('pages');
        $qb->getRestrictions()->removeAll();

        $row = $qb->select('doktype')
            ->from('pages')
            ->where($qb->expr()->eq('uid', $qb->createNamedParameter($pageId, ParameterType::INTEGER)))
            ->setMaxResults(1)
            ->executeQuery()
            ->fetchAssociative();

        return $row ? (int)$row['doktype'] : null;
    }

    /**
     * @return array{pid:int, sys_language_uid:int}|null
     */
    private function fetchTtContentMeta(int $uid): ?array
    {
        $qb = GeneralUtility::makeInstance(ConnectionPool::class)->getQueryBuilderForTable('tt_content');

        $row = $qb->select('pid', 'sys_language_uid')
            ->from('tt_content')
            ->where($qb->expr()->eq('uid', $qb->createNamedParameter($uid, ParameterType::INTEGER)))
            ->setMaxResults(1)
            ->executeQuery()
            ->fetchAssociative();

        if (!$row) {
            return null;
        }

        return [
            'pid' => (int)$row['pid'],
            'sys_language_uid' => (int)$row['sys_language_uid'],
        ];
    }

    private function bootSplitModule(int $pageId, ServerRequestInterface $request): void
    {
        /** @var PageRenderer $pageRenderer */
        $pageRenderer = GeneralUtility::makeInstance(PageRenderer::class);
        $helper = GeneralUtility::makeInstance(PreviewHelper::class);

        if ($helper->isPostMessagesEnabled()) {
            $pageRenderer->addCssFile(
                PathUtility::getPublicResourceWebPath(
                    'EXT:content_preview/Resources/Public/Backend/Module/pce-split.css'
                )
            );
            $moduleId = '@macopedia-pce-split';
        } else {
            $pageRenderer->addCssFile(
                PathUtility::getPublicResourceWebPath(
                    'EXT:content_preview/Resources/Public/Backend/Injection/Module/pce-split.css'
                )
            );
            $moduleId = '@macopedia-pce-split-injection';
        }

        $previewUrl = $this->buildPreviewUrl($pageId, $request);
        $backendUris = $this->buildBackendRoutes($pageId);

        $instruction = JavaScriptModuleInstruction::create($moduleId);
        $instruction->invoke(
            'boot',
            $previewUrl,
            $backendUris['recordEditBase'],
            $backendUris['returnUrlBase'],
            $backendUris['pagesUrlBase'],
        );

        $pageRenderer
            ->getJavaScriptRenderer()
            ->addJavaScriptModuleInstruction($instruction);
    }

    private function buildPreviewUrl(int $pageId, ServerRequestInterface $request): string
    {
        $q = $request->getQueryParams();

        $language = array_key_exists('language', $q)
            ? (int)$q['language']
            : null;

        if ($language === null) {
            $moduleData = $request->getAttribute('moduleData');
            if ($moduleData instanceof ModuleData) {
                $language = (int)$moduleData->get('language', 0);
            } else {
                $language = 0;
            }
        }

        $previewUri = PreviewUriBuilder::create($pageId)
            ->withRootLine(BackendUtility::BEgetRootLine($pageId))
            ->withLanguage($language)
            ->buildUri();

        return (string)($previewUri instanceof Uri ? $previewUri : new Uri((string)$previewUri));
    }

    /**
     * @return array{recordEditBase:string, returnUrlBase:string, pagesUrlBase:string}
     */
    private function buildBackendRoutes(int $pageId): array
    {
        /** @var BackendUriBuilder $uriBuilder */
        $uriBuilder = GeneralUtility::makeInstance(BackendUriBuilder::class);

        return [
            'recordEditBase' => (string)$uriBuilder->buildUriFromRoute('record_edit'),
            'returnUrlBase' => (string)$uriBuilder->buildUriFromRoute('web_layout', ['id' => $pageId]),
            'pagesUrlBase' => (string)$uriBuilder->buildUriFromRoute('web_layout'),
        ];
    }
}
