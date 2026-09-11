# Prompt Studio

A browser-based brief builder for image generation and editing. It produces prompts to paste into ChatGPT; it does not generate images or transfer attachments itself.

- `npm run dev` — open `/prompt-studio.html` on the displayed local URL.
- `npm run build` — builds `dist/prompt-studio.html`.
- `npm test` — checks prompt compilation across content types and English/Japanese workflows.

## Visual briefing and repair

Optional **Composition & success checks** fields capture purpose, placement/reading order, and hard requirements. Each reference can specify details to borrow/preserve and ignore/exclude. Editing also supports allowed physical consequences such as changed shadows.

After generation, expand **Review & repair your result**. Inspect the actual image against your requirements, describe a focused correction, and select/copy the generated repair prompt. Attach the best accepted source in ChatGPT. These are user-directed checks, not automatic image analysis. Form values last for the current page session; save your prompt before reloading.

These additions adapt the practical workflows in [Avid’s image prompting course](https://x.com/Av1dlive/status/2098055179761525165): observable visual decisions, scoped reference roles, acceptance checks, and focused change/preserve/allow edits. No model-version claims or fidelity guarantees are assumed.
