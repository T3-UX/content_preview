<?php

declare(strict_types=1);

namespace T3UX\ContentPreview\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use T3UX\ContentPreview\Service\PreviewInjectionService;
use T3UX\ContentPreview\Utility\PreviewHelper;

final class PageContentEditorPreviewMiddleware implements MiddlewareInterface
{
    public function __construct(
        private readonly PreviewInjectionService $previewInjectionService,
        private readonly PreviewHelper $previewHelper
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $response = $handler->handle($request);

        $contentType = $response->getHeaderLine('Content-Type') ?: '';
        if (stripos($contentType, 'text/html') === false) {
            return $response;
        }

        if (!$this->previewHelper->shouldAnnotate($request)) {
            return $response;
        }

        return $this->previewInjectionService->applyInjection($request, $response);
    }
}
