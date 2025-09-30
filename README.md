# Content Preview

**Content Preview** is a TYPO3 extension that improves the editing workflow by adding a **content preview panel** directly into the Page module.
It provides a **side-by-side split view**: TYPO3’s backend UI on the left, and a live frontend preview on the right. The preview is annotated with **✎ Edit buttons** on every content element. Clicking a button opens the corresponding `tt_content` editor, while the preview **automatically scrolls** to the edited element.

This significantly reduces context-switching for editors and brings TYPO3 closer to modern CMS editing experiences.

Right now, support for TYPO3 v12 and v13.

> 🔧 Content preview is controlled by the feature flag: `contentPreview.enable`

---

## Installation

1. **Install via Composer**

```bash
composer require t3-ux/content_preview
```

2. **Enable the feature flag** (enabled by default):

```typoscript

$GLOBALS['TYPO3_CONF_VARS']['SYS']['features']['contentPreview.enable'] = true
```

---

## What it does

- Adds a **split view** inside the **Page module** (and also when editing a single content element):
    - Left side: standard TYPO3 Page module UI.
    - Right side: frontend preview of the current page, inside an iframe.
- The frontend preview is **annotated**: each `tt_content` element (`id="c{uid}"`) receives an **Edit button**.
- When clicking an edit button:
    - The corresponding element opens in TYPO3’s record editing form.
    - After saving, the preview automatically **scrolls back to that element**.
- **Activation methods for preview annotating** (opt-in switches):
    - HTTP header `X-Page-Content-Editor: 1`
    - Query string `?pce=1`
- **Configuration option to disable preview for user**:
    - If you want to disable preview to user: ```['options.']['contentPreview.']['enable'] = 0```
- **Safety rails** (to avoid unwanted preview rendering):
    - **Doktype allowlist** (configurable) ensures only relevant page types show preview.
    - **ReturnUrl blacklist** ensures preview is disabled for irrelevant modules (e.g. link-reports).
    - Works only in backend for `web_layout` (Page module) and `record_edit` routes.

---

## How it works

The extension consists of three cooperating parts:

1. **Backend hook (`PageRendererHook::renderPreProcess`)**
    - Runs only when the current route is `web_layout` or `record_edit`.
    - Decides what to render based on route.
    - Checks the **returnUrl blacklist** to skip irrelevant modules.
    - Verifies whether the user has the feature enabled (per-user toggle).
    - Builds a **preview URL** with the correct language context (from `?language` or module data).
    - Loads the JavaScript and styles for split view (`pce-split.js`) into the TYPO3 backend.

2. **Frontend middleware (`PageContentEditorPreviewMiddleware`)**
    - Intercepts frontend HTML responses when `?pce=1` or the header is present.
    - Injects **edit buttons** into every content element with DOM id `c{uid}`.
    - Adds supporting CSS/JS assets for the editor preview.

3. **JavaScript (`pce-split.js and other`)**
    - Renders the **split layout** in the backend (left: TYPO3 module, right: iframe preview).
    - Loads the preview iframe.
    - Manages navigation back and forth:
        - Clicking an edit button in preview → opens correct record editor in backend.
        - Saving in backend → preview scrolls back to the same element.
    - Synchronizes focus and navigation using `sessionStorage` + `postMessage`.

This architecture ensures editors can switch between **editing** and **previewing** without leaving the Page module.

---

## Configuration

The Content Preview is highly configurable. Administrators can define **when and how** the preview is shown, and developers can extend its logic.

### Global feature flag

Enable or disable the preview globally:

```typoscript
SYS.features.contentPreview.enable = true|false
```

### Per-user TSConfig

Enable/disable for individual users, and optionally extend allowlists:

```typoscript
# Enable (default if unset)
options.contentPreview.enable = 1

options.pageContentEditor.pageTypesWhitelist = 1, 137
```

### Extension configuration

Define global rules via `LocalConfiguration.php` or `AdditionalConfiguration.php`:

```php
$GLOBALS['TYPO3_CONF_VARS']['EXTENSIONS']['content_preview'] = [
    'pageTypesWhitelist' => [1, 137],
    'disallowedReturnUrlPaths' => [
        '/typo3/module/page/link-reports',
        '/typo3/module/page/custom-report',
    ],
];
```

### Runtime extension via PSR-14 events

For more dynamic scenarios, you can hook into PSR-14 events to adjust configuration at runtime:

**Modify doktype allowlist**
Event: `T3UX\ContentPreview\Event\ModifyPreviewPageTypesEvent`

```php
$types = $event->getPageTypes();
$types[] = 137; // custom doktype
$event->setPageTypes($types);
```

**Modify returnUrl blacklist**
Event: `T3UX\ContentPreview\Event\ModifyDisallowedReturnUrlPathsEvent`

```php
$paths = $event->getPaths();
$paths[] = '/typo3/module/page/another-report';
$event->setPaths($paths);
```

Register listeners as usual in `Services.yaml`.

---

## Troubleshooting

**Nothing happens in backend**
- Make sure you are in `web_layout` or `record_edit`.
- Ensure the returnUrl is not blacklisted (e.g. `/typo3/module/page/link-reports` is excluded by default).

**Edit buttons missing in preview**
- Verify that content elements are annotated with ```injectEditButtons``` method.

---

## Roadmap

Planned improvements and areas for contribution:

- **Workspaces support** – allow preview of unpublished content, integrated with TYPO3’s workspace mechanism.
- **Start/stop date simulation** – simulate scheduled publishing/expiry directly in preview.
- **Frontend user/group simulation** – preview pages as if logged in as a specific user/group.
- **Alternative preview modes** – support floating windows or opening preview in a separate tab.
- **Cross-domain improvements** – make preview work  with multi-domain/multi-root setups without relogin.
