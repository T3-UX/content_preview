<?php

declare(strict_types=1);

namespace T3UX\ContentPreview\Event;

final class ModifyPreviewPageTypesEvent
{
    /** @param int[] $pageTypes */
    public function __construct(private array $pageTypes)
    {
    }

    /** @return int[] */
    public function getPageTypes(): array
    {
        return $this->pageTypes;
    }

    /** @param int[] $pageTypes */
    public function setPageTypes(array $pageTypes): void
    {
        $this->pageTypes = $pageTypes;
    }
}
