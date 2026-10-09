/** Shared disclosure and popover primitives for explanatory interface text. */

/**
 * Put one explicitly identified tan information box behind a native disclosure.
 *
 * The caller keeps ownership of `content`, including any live region, links, or
 * controls it contains. Native details/summary supplies keyboard operation and
 * the expanded state without copying or flattening that content.
 */
export function tanDisclosure(content, label) {
  const details = document.createElement('details');
  details.className = 'tan-disclosure';
  const summary = document.createElement('summary');
  summary.textContent = label;
  details.append(summary, content);
  return details;
}

/**
 * Text popover that can be read by pointer, touch, or keyboard users.
 *
 * Hover and focus expose it transiently; click pins it. A second click, Escape,
 * focus leaving the control, or a pointer press elsewhere dismisses it. The
 * trigger remains usable when a neighbouring form control is disabled.
 */
export class InfoPopover {
  constructor(host, { id, label }) {
    this.host = host;
    const classes = String(this.host.className ?? '').split(/\s+/).filter(Boolean);
    if (!classes.includes('info-popover')) classes.push('info-popover');
    this.host.className = classes.join(' ');
    this.hovered = false;
    this.focused = false;
    this.pinned = false;
    this.dismissed = false;

    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.className = 'info-popover-button';
    this.button.textContent = 'i';
    this.button.setAttribute('aria-label', label);
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-controls', id);

    this.popover = document.createElement('span');
    this.popover.id = id;
    this.popover.className = 'info-popover-content';
    this.popover.setAttribute('role', 'tooltip');
    this.popover.hidden = true;
    this.button.setAttribute('aria-describedby', id);
    this.host.replaceChildren(this.button, this.popover);

    this.host.addEventListener('pointerenter', () => {
      this.hovered = true;
      if (!this.dismissed) this.sync();
    });
    this.host.addEventListener('pointerleave', () => {
      this.hovered = false;
      if (!this.focused) this.dismissed = false;
      this.sync();
    });
    this.host.addEventListener('focusin', () => {
      this.focused = true;
      if (!this.dismissed) this.sync();
    });
    this.host.addEventListener('focusout', (event) => {
      if (this.host.contains(event.relatedTarget)) return;
      this.focused = false;
      this.pinned = false;
      if (!this.hovered) this.dismissed = false;
      this.sync();
    });
    this.button.addEventListener('click', () => {
      if (!this.pinned) {
        this.pinned = true;
        this.dismissed = false;
      } else {
        this.pinned = false;
        this.dismissed = true;
      }
      this.sync();
    });
    this.button.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || this.popover.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      this.close({ suppressUntilExit: true });
      this.button.focus({ preventScroll: true });
    });
    document.addEventListener?.('pointerdown', (event) => {
      if (this.popover.hidden || this.host.contains(event.target)) return;
      this.close({ suppressUntilExit: true });
    }, true);
  }

  update(text) {
    this.popover.textContent = text ?? '';
  }

  close({ suppressUntilExit = false } = {}) {
    this.pinned = false;
    this.dismissed = suppressUntilExit;
    this.popover.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
  }

  sync() {
    const open = !this.dismissed && (this.pinned || this.hovered || this.focused);
    this.popover.hidden = !open;
    this.button.setAttribute('aria-expanded', String(open));
    if (open) this.position();
  }

  /** Keep the fixed popover inside the current viewport, above if needed. */
  position() {
    if (!this.button.getBoundingClientRect || !this.popover.getBoundingClientRect) return;
    const viewportWidth = globalThis.window?.innerWidth;
    const viewportHeight = globalThis.window?.innerHeight;
    if (!Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight)) return;
    const margin = 16;
    const gap = 4;
    const button = this.button.getBoundingClientRect();
    const box = this.popover.getBoundingClientRect();
    const left = Math.max(margin, Math.min(button.right - box.width, viewportWidth - box.width - margin));
    const below = button.bottom + gap;
    const top = below + box.height <= viewportHeight - margin
      ? below : Math.max(margin, button.top - box.height - gap);
    this.popover.style.left = `${left}px`;
    this.popover.style.top = `${top}px`;
  }
}
