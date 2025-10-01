# Content Preview
![Content preview](./Resources/Public/Images/screenshot.png?raw=true "Content preview")

**Content Preview** is a TYPO3 extension that improves the editing workflow by adding a **content preview panel** directly into the Page module.
It provides a **side-by-side split view**: TYPO3’s backend UI on the left, and a live frontend preview on the right. The preview is annotated with **✎ Edit buttons** on every content element. Clicking a button opens the corresponding `tt_content` editor, while the preview **automatically scrolls** to the edited element.

This significantly reduces context-switching for editors and brings TYPO3 closer to modern CMS editing experiences.

Right now, we support TYPO3 v12 and v13.

> 🔧 Content preview is controlled by the feature flag: `contentPreview.enable`

---

## Installation

1. **Install via Composer**

```bash
composer require t3-ux/content_preview
```

2. **Enable the feature flag** (enabled by default):

```php
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
    - If you want to disable preview for a user: `options.contentPreview.enable = 0`
- **Safety rails** (to avoid unwanted preview rendering):
    - **Doktype allowlist** (configurable) ensures only relevant page types show preview.
    - **ReturnUrl blacklist** ensures preview is disabled for irrelevant modules (e.g. `link-reports`).
    - Works only in backend for `web_layout` (Page module) and `record_edit` routes.

---

## How it works

The extension has **two cooperating layers**: backend integration and frontend modification.

> 🔧 We require your frontend to have ```id=c####``` parameter within your CE, that means you should have identifier prefixed by ```c``` and id of content element.

Description below is true for PostMessage approach.

### 1. Backend integration (hook)

- Runs only when the current route is `web_layout` or `record_edit`.
- Checks whether preview should run at all:
    - Feature flags and per-user toggle.
    - Doktype allowlist.
    - `returnUrl` blacklist (modules like `link-reports` are excluded by default).
- Builds a **preview URL** with the correct language context (from `?language` or module data).
- Loads the required JavaScript and CSS for split view (`pce-split.js`, stylesheets).

### 2. Frontend modification (middleware)

- Intercepts frontend HTML responses when `?pce=1` or the header is present.
- Actively **injects extra HTML** into the response:
    - Adds ✎ edit buttons next to every content element with DOM id `c{uid}`.
    - Injects CSS and JS needed for highlighting and scroll handling.
- This is not just a passive JS overlay – the HTML output is modified to include buttons and attributes.

### 3. Backend JavaScript (split view UI)

- Renders the split layout in the backend (left: Page module, right: preview iframe).
- Manages navigation between editing and preview:
    - Clicking an edit button → opens the correct record editor.
    - Saving a record → preview iframe scrolls back to the edited element.
- Handles communication via `sessionStorage` and `postMessage`.
- Experimental: **navigation inside preview** – when clicking internal links in preview, the backend can switch context to the target page. (Language handling, navigation via DataProcessor and cross-domain support are still limited.) - for full integration, add ```data-pce-page-uid``` attribute to your links with pid value. This feature is disabled by default.

---

## Configuration

The Content Preview is highly configurable. Administrators can define **when and how** the preview is shown, and developers can extend its logic.

### Global feature flags

Enable or disable the preview globally:

```typoscript
SYS.features.contentPreview.enable = true|false
SYS.features.contentPreview.postMessages = true|false
```

- `enable` – turns the feature on/off for the whole system.
- `postMessages` – switches between **Full mode** (with postMessage communication and panel) and **Lite mode** (new approach, with javascript injection).

### Per-user TSConfig

Enable/disable for individual users, and extend allowlists if needed:

```typoscript
# Enable (default if unset)
options.contentPreview.enable = 1

# Extend allowed doktypes
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

- **Allowlist** ensures only pages with specific doktypes are previewed.
- **Blacklist** ensures preview is skipped when `returnUrl` points to excluded modules (e.g. reports).

### Runtime extension via PSR-14 events

For more dynamic scenarios, you can hook into PSR-14 events:

- **Modify doktype allowlist**: `T3UX\ContentPreview\Event\ModifyPreviewPageTypesEvent`
- **Modify returnUrl blacklist**: `T3UX\ContentPreview\Event\ModifyDisallowedReturnUrlPathsEvent`
  → lets you add/remove backend routes where preview must never run.

Register listeners in `Services.yaml` *or* using PHP attributes (`#[AsEventListener]`).
See [TYPO3 Event Dispatcher docs](https://docs.typo3.org/m/typo3/reference-coreapi/main/en-us/ApiOverview/Events/EventDispatcher/Index.html).

---

## Troubleshooting

**Nothing happens in backend**
- Make sure you are in `web_layout` or `record_edit`.
- Ensure the `returnUrl` is not blacklisted (default: `/typo3/module/page/link-reports`).

**Edit buttons missing in preview**
- Verify that content elements are annotated with the `injectEditButtons` method.

---

## Roadmap

Planned improvements and areas for contribution:

- **Workspaces support** – allow preview of unpublished content.
- **Start/stop date simulation** – simulate scheduled publishing/expiry.
- **Frontend user/group simulation** – preview as specific FE user/group.
- **Alternative preview modes** – floating windows or external tabs.
- **Cross-domain improvements** – more robust preview for multi-domain/multi-root setups.

---

## Support & contributions

- Please report issues via [GitHub Issues](https://github.com/t3-ux/content_preview/issues).
- Contributions, bug reports, and feedback are welcome.
- For TYPO3-specific questions, also see the [TYPO3 documentation](https://docs.typo3.org).
