# R-EC-03 — Resolve Missing Images in R2 (Registry Hygiene)

**Source:** R2 validation findings (pnpm validate, 2026-04-09)
**Layer:** Registry / Data Quality

**Execution Authority:**
This EC is the authoritative execution checklist for R-EC-03.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of R-EC-03.

---

## Before Starting
- [ ] `pnpm validate` has been run and shows 404 image URLs
- [ ] rclone is configured with R2 remote

---

## Findings (5 missing images)

1. `pttr/pttr-hr-black-cat-4c1.webp` — hero image 404
2. `msp1/msp1-hr-black-widow-3c1.webp` — hero image 404
3. `shld/shld-mm-hydra-high-council.webp` — mastermind image 404
4. `shld/shld-vi-a-i-m-hydra-offshoot-taskmaster.webp` — villain image 404
5. `2099/2099-mm-sinister-six-2099.webp` — mastermind image 404

---

## Diagnosis Required
For each missing image, determine:
- [ ] Does the image exist in R2 under a different filename? (slug mismatch)
- [ ] Does the image exist locally but was never uploaded?
- [ ] Is the `imageUrl` in the card JSON pointing to the wrong path?
- [ ] Is this a set that legitimately has no image for this card?

---

## Guardrails
- Do NOT generate or fabricate images
- Do NOT modify image filenames in R2 without updating card JSON to match
- Image URLs use hyphens, not underscores (per 00.2 §3.2)
- Hero images: prefer the stored `imageUrl` field in card JSON

---

## Resolution Options (per image)
- **Slug mismatch**: update card JSON `imageUrl` to match actual R2 filename
- **Not uploaded**: upload the image via rclone
- **Legitimately absent**: add to a known-exceptions list in the validation script

---

## After Completing
- [ ] Each of the 5 images is resolved (fixed, uploaded, or documented as exception)
- [ ] `pnpm validate` image spot-check section shows 0 missing
- [ ] No new images were fabricated

---

## Status
**Deferred** — requires manual diagnosis per image. Not blocking EC-002.
The game engine does not render images — it stores `ext_id` strings only.
Image availability is a UI concern, not an engine concern.
