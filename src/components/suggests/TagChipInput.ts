import { App } from 'obsidian';
import { TagSuggest } from './FileLinkSuggest';

/**
 * Options for creating a tag chip input
 */
interface TagChipInputOptions {
  /** Initial tags to display */
  initialTags: string[];
  /** Callback when tags change */
  onChange: (tags: string[]) => void;
  /** Placeholder text for the input */
  placeholder?: string;
}

/**
 * Creates a tag chip input component with auto-suggest.
 * Tags are displayed as styled chips that can be removed by clicking.
 * New tags can be added by typing and pressing Enter or comma.
 */
export function createTagChipInput(
  app: App,
  container: HTMLElement,
  options: TagChipInputOptions
): {
  container: HTMLElement;
  input: HTMLInputElement;
  setTags: (tags: string[]) => void;
  getTags: () => string[];
} {
  const { initialTags, onChange, placeholder = 'Add tag...' } = options;

  // Track current tags
  let currentTags = [...initialTags];

  // Create container
  const chipContainer = container.createDiv({ cls: 'planner-tag-input-container' });

  // Create chips container (will hold chips and input)
  const chipsWrapper = chipContainer;

  // Create the text input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'planner-tag-input';
  input.placeholder = currentTags.length === 0 ? placeholder : '';

  /**
   * Normalize a tag value by stripping # prefix
   */
  function normalizeTag(tag: string): string {
    return tag.trim().replace(/^#/, '');
  }

  /**
   * Render all tag chips
   */
  function renderChips(): void {
    // Remove existing chips (but keep input)
    const existingChips = chipsWrapper.querySelectorAll('.planner-tag-chip');
    existingChips.forEach(chip => chip.remove());

    // Add chips before the input
    for (const tag of currentTags) {
      const chip = createChip(tag);
      chipsWrapper.insertBefore(chip, input);
    }

    // Update placeholder
    input.placeholder = currentTags.length === 0 ? placeholder : '';
  }

  /**
   * Create a single tag chip element
   */
  function createChip(tag: string): HTMLElement {
    const chip = document.createElement('span');
    chip.className = 'planner-tag-chip';

    const text = document.createElement('span');
    text.textContent = `#${tag}`;
    chip.appendChild(text);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'planner-tag-chip-remove';
    removeBtn.textContent = '×';
    removeBtn.type = 'button';
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeTag(tag);
    });
    chip.appendChild(removeBtn);

    return chip;
  }

  /**
   * Add a new tag
   */
  function addTag(tag: string): void {
    const normalized = normalizeTag(tag);
    if (normalized && !currentTags.includes(normalized)) {
      currentTags.push(normalized);
      renderChips();
      onChange(currentTags);
    }
    input.value = '';
  }

  /**
   * Remove a tag
   */
  function removeTag(tag: string): void {
    const index = currentTags.indexOf(tag);
    if (index !== -1) {
      currentTags.splice(index, 1);
      renderChips();
      onChange(currentTags);
    }
  }

  /**
   * Set tags programmatically
   */
  function setTags(tags: string[]): void {
    currentTags = tags.map(normalizeTag).filter(t => t.length > 0);
    renderChips();
  }

  /**
   * Get current tags
   */
  function getTags(): string[] {
    return [...currentTags];
  }

  // Handle input events
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const value = input.value.trim();
      if (value) {
        // Handle comma-separated input
        const tags = value.split(',').map(t => t.trim()).filter(t => t);
        tags.forEach(addTag);
      }
    } else if (e.key === 'Backspace' && input.value === '' && currentTags.length > 0) {
      // Remove last tag on backspace when input is empty
      removeTag(currentTags[currentTags.length - 1]);
    }
  });

  // Also handle comma in input event (for paste with commas)
  input.addEventListener('input', () => {
    if (input.value.includes(',')) {
      const parts = input.value.split(',');
      // Add all complete parts (everything except the last)
      for (let i = 0; i < parts.length - 1; i++) {
        const tag = parts[i].trim();
        if (tag) addTag(tag);
      }
      // Keep the last part in the input
      input.value = parts[parts.length - 1];
    }
  });

  // Focus input when clicking container
  chipContainer.addEventListener('click', () => {
    input.focus();
  });

  // Append input to container
  chipsWrapper.appendChild(input);

  // Attach tag suggest
  new TagSuggest(app, input);

  // Initial render
  renderChips();

  return {
    container: chipContainer,
    input,
    setTags,
    getTags,
  };
}
