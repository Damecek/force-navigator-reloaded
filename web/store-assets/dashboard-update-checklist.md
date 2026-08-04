# Chrome Web Store dashboard update checklist

Apply these changes only after the corresponding source changes are committed, pushed to `main`, and included in a
published extension package.

## Product details

- Confirm the published package exposes the title `Force Navigator Reloaded for Salesforce`.
- Confirm the published package exposes this 116-character summary:
  `Keyboard-first Salesforce command palette and shortcuts for Setup, objects, flows, permissions, users, and Login As.`
- Replace the detailed description with the complete contents of `web/web-store-listing.md`.
- Change the primary category from `Tools` to `Developer Tools`.
- Keep the primary language set to English.

## Graphic assets

- Upload the screenshots in this exact order:
  1. `screenshots/01-find-any-page.png`
  2. `screenshots/02-fuzzy-search.png`
  3. `screenshots/03-open-new-tab.png`
  4. `screenshots/04-configure-sources.png`
  5. `screenshots/05-one-shortcut.png`
- Replace the small promotional tile with `promotional-small.png`.
- Replace the marquee promotional image with `promotional-marquee.png`.
- Remove the two superseded screenshots only after all five replacements are uploaded successfully.

## Trust and measurement

- Verify that the support URL points to `https://github.com/Damecek/force-navigator-reloaded/issues`.
- Verify that the homepage points to `https://github.com/Damecek/force-navigator-reloaded` unless a verified product
  domain is available.
- Enable the Chrome Web Store managed Google Analytics integration if the dashboard offers the opt-in and it is not
  already enabled.
- Do not add extension-side analytics or change the existing privacy disclosures as part of this listing update.

## Submission verification

- Save the Store listing draft and inspect every dashboard warning before submitting it.
- Submit the updated listing for review.
- Confirm that the screenshot and promotional-image review statuses do not show `Rejected`.
- After publication, open the public listing in a signed-out context and verify the title, summary, description,
  category, screenshot order, promotional imagery, version, support link, and privacy disclosure.
