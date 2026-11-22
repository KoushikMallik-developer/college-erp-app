## What and why

<!-- What does this change do, and why is it needed? Link the issue: Closes #123 -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup (no behaviour change)
- [ ] Firestore rules or indexes
- [ ] Docs / config

## How it was tested

- [ ] `npm test` passes
- [ ] `npm run test:rules` passes (needed if `firestore.rules` changed)
- [ ] `npm run build` passes
- [ ] Tried it in the browser as the roles it affects: <!-- admin / faculty / student / parent / librarian -->

## Checklist

- [ ] New logic has a test that fails when it breaks
- [ ] Every new collection or field has a matching rule in `firestore.rules`
- [ ] New queries have an index in `firestore.indexes.json`
- [ ] No secrets, `.env` values or personal data in the diff
- [ ] Layout checked on a phone-width screen (if the UI changed)

## Deploy notes

<!-- Anything to run after merge, e.g. `npx firebase deploy --only firestore`. Write "none" if nothing. -->

## Screenshots

<!-- For UI changes: before and after. Delete this section otherwise. -->
