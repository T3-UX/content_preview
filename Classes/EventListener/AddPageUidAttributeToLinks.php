<?php

declare(strict_types=1);

namespace T3UX\ContentPreview\EventListener;

use T3UX\ContentPreview\Utility\PreviewHelper;
use TYPO3\CMS\Core\LinkHandling\LinkService;
use TYPO3\CMS\Frontend\Event\AfterLinkIsGeneratedEvent;

final readonly class AddPageUidAttributeToLinks
{
    public function __construct(private LinkService $linkService, private PreviewHelper $previewHelper) {}

    public function __invoke(AfterLinkIsGeneratedEvent $event): void
    {
        $cObj = $event->getContentObjectRenderer();
        $request = $cObj->getRequest();
        if (!$this->previewHelper->shouldAnnotate($request)) {
            return;
        }

        $result = $event->getLinkResult();

        if (!in_array($result->getType(), [LinkService::TYPE_PAGE, LinkService::TYPE_INPAGE], true)) {
            return;
        }

        $pageId = $result->getLinkConfiguration()['parameter'] ?? 0;

        if ((int)($result->getLinkConfiguration()['page']['doktype'] ?? 1) === 4) {
            $pageId = (int)$result->getLinkConfiguration()['page']['shortcut'];
        } elseif (isset($result->getLinkConfiguration()['parameter'])) {
            $pageId = (int)($this->linkService->resolve((string)$pageId ?? '')['pageuid'] ?? 0);
        }

        $event->setLinkResult($result->withAttribute('data-pce-page-uid', (string)$pageId));
    }
}
