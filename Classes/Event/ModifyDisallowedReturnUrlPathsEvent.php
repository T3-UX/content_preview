<?php
declare(strict_types=1);

namespace T3UX\ContentPreview\Event;

final class ModifyDisallowedReturnUrlPathsEvent
{
    /** @param string[] $paths */
    public function __construct(private array $paths) {}

    /** @return string[] */
    public function getPaths(): array { return $this->paths; }

    /** @param string[] $paths */
    public function setPaths(array $paths): void { $this->paths = $paths; }
}
