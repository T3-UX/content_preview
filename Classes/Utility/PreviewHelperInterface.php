<?php
declare(strict_types=1);

namespace T3UX\ContentPreview\Utility;

use Psr\Http\Message\ServerRequestInterface;

interface PreviewHelperInterface
{
    public function shouldAnnotate(ServerRequestInterface $request): bool;
    public function isFeatureFlagEnabled(): bool;
    public function shouldBeUserSeePreview(): bool;
    public function isPageTypeSuitableForPreview(int $pageType): bool;
    public function isEnabledViaHeader(ServerRequestInterface $request): bool;
    public function isEnabledViaQuery(ServerRequestInterface $request): bool;

    /** @return int[] */
    public function getAllowedPageTypes(): array;

    public function isInPageModuleOrRecordEdit(ServerRequestInterface $request): bool;

    /** @return string[] */
    public function getDisallowedReturnUrlPaths(): array;
}
