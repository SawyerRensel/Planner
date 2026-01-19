import { App, PluginSettingTab, Setting, Modal, Notice } from 'obsidian';
import type PlannerPlugin from '../main';
import { PlannerSettings, StatusConfig, PriorityConfig, DEFAULT_SETTINGS, OpenBehavior, getNextCalendarColor } from '../types/settings';
import { BaseGeneratorService } from '../services/BaseGeneratorService';
import { FolderSuggest } from '../components/suggests/FolderSuggest';
import { FileSuggest } from '../components/suggests/FileSuggest';

/**
 * Tab configuration
 */
interface TabConfig {
  id: string;
  label: string;
  render: (container: HTMLElement) => void;
}

/**
 * Confirmation modal for regenerating Base files
 */
class RegenerateBasesModal extends Modal {
  private onConfirm: () => void;

  constructor(app: App, onConfirm: () => void) {
    super(app);
    this.onConfirm = onConfirm;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: 'Regenerate base files' });
    contentEl.createEl('p', {
      text: 'This will overwrite your existing task list.base, calendar.base, timeline.base, and kanban.base files. Any customizations you have made to these files will be lost.',
      cls: 'planner-modal-warning'
    });
    contentEl.createEl('p', {
      text: 'Are you sure you want to continue?'
    });

    const buttonContainer = contentEl.createDiv({ cls: 'planner-modal-buttons' });

    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const confirmBtn = buttonContainer.createEl('button', {
      text: 'Regenerate',
      cls: 'mod-warning'
    });
    confirmBtn.addEventListener('click', () => {
      this.onConfirm();
      this.close();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}

export class PlannerSettingTab extends PluginSettingTab {
  plugin: PlannerPlugin;
  private activeTab = 'general';
  private tabContents: Map<string, HTMLElement> = new Map();
  private tabButtons: Map<string, HTMLElement> = new Map();

  constructor(app: App, plugin: PlannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private getTabs(): TabConfig[] {
    return [
      { id: 'general', label: 'General', render: (c) => this.renderGeneralTab(c) },
      { id: 'calendar', label: 'Calendar', render: (c) => this.renderCalendarTab(c) },
      { id: 'statuses', label: 'Statuses & Priorities', render: (c) => this.renderStatusPriorityTab(c) },
      { id: 'quickcapture', label: 'Quick Capture', render: (c) => this.renderQuickCaptureTab(c) },
    ];
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    this.tabContents.clear();
    this.tabButtons.clear();

    const tabs = this.getTabs();

    // Create tab navigation
    const tabNav = containerEl.createDiv({ cls: 'planner-settings-tabs' });
    for (const tab of tabs) {
      const btn = tabNav.createEl('button', {
        text: tab.label,
        cls: 'planner-settings-tab',
      });
      if (tab.id === this.activeTab) {
        btn.addClass('is-active');
      }
      btn.addEventListener('click', () => this.switchTab(tab.id));
      this.tabButtons.set(tab.id, btn);
    }

    // Create tab content containers
    const tabContentsEl = containerEl.createDiv({ cls: 'planner-settings-tab-contents' });
    for (const tab of tabs) {
      const content = tabContentsEl.createDiv({ cls: 'planner-settings-tab-content' });
      if (tab.id === this.activeTab) {
        content.addClass('is-active');
        tab.render(content);
      }
      this.tabContents.set(tab.id, content);
    }
  }

  private switchTab(tabId: string): void {
    if (tabId === this.activeTab) return;

    const tabs = this.getTabs();

    // Update button states
    for (const [id, btn] of this.tabButtons) {
      btn.toggleClass('is-active', id === tabId);
    }

    // Update content visibility
    for (const [id, content] of this.tabContents) {
      const isActive = id === tabId;
      content.toggleClass('is-active', isActive);

      // Lazy render: only render content on first access
      if (isActive && content.children.length === 0) {
        const tab = tabs.find(t => t.id === id);
        if (tab) {
          tab.render(content);
        }
      }
    }

    this.activeTab = tabId;
  }

  private renderGeneralTab(containerEl: HTMLElement): void {
    // General Settings heading
    ;

    new Setting(containerEl)
      .setName('Items folder')
      .setDesc('Where new items are created')
      .addText(text => {
        text
          .setPlaceholder('Planner/')
          .setValue(this.plugin.settings.itemsFolder)
          .onChange(async (value) => {
            this.plugin.settings.itemsFolder = value || DEFAULT_SETTINGS.itemsFolder;
            await this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName('Item template')
      .setDesc('Template file path for new items (optional)')
      .addText(text => {
        text
          .setPlaceholder('Templates/planner-item.md')
          .setValue(this.plugin.settings.itemTemplate)
          .onChange(async (value) => {
            this.plugin.settings.itemTemplate = value;
            await this.plugin.saveSettings();
          });
        new FileSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName('Date format')
      .setDesc('Display format for dates')
      .addDropdown(dropdown => dropdown
        .addOption('YYYY-MM-DD', 'Year-month-day')
        .addOption('MM/DD/YYYY', 'Month/day/year')
        .addOption('DD/MM/YYYY', 'Day/month/year')
        .addOption('MMM D, YYYY', 'Month day, year')
        .setValue(this.plugin.settings.dateFormat)
        .onChange(async (value) => {
          this.plugin.settings.dateFormat = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Time format')
      .setDesc('12-hour or 24-hour time')
      .addDropdown(dropdown => dropdown
        .addOption('12h', '12-hour')
        .addOption('24h', '24-hour')
        .setValue(this.plugin.settings.timeFormat)
        .onChange(async (value: '12h' | '24h') => {
          this.plugin.settings.timeFormat = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Week starts on')
      .setDesc('First day of the week')
      .addDropdown(dropdown => dropdown
        .addOption('monday', 'Monday')
        .addOption('tuesday', 'Tuesday')
        .addOption('wednesday', 'Wednesday')
        .addOption('thursday', 'Thursday')
        .addOption('friday', 'Friday')
        .addOption('saturday', 'Saturday')
        .addOption('sunday', 'Sunday')
        .setValue(this.plugin.settings.weekStartsOn)
        .onChange(async (value: PlannerSettings['weekStartsOn']) => {
          this.plugin.settings.weekStartsOn = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Open behavior')
      .setDesc('How to open items and daily notes from the calendar')
      .addDropdown(dropdown => dropdown
        .addOption('new-tab', 'Open in new tab')
        .addOption('same-tab', 'Open in same tab')
        .addOption('split-right', 'Split right')
        .addOption('split-down', 'Split down')
        .setValue(this.plugin.settings.openBehavior)
        .onChange(async (value: OpenBehavior) => {
          this.plugin.settings.openBehavior = value;
          await this.plugin.saveSettings();
        }));

    // Bases Views section
    new Setting(containerEl).setName("Bases views").setHeading();

    new Setting(containerEl)
      .setName('Bases folder')
      .setDesc('Where to save the base view files (task list, calendar, timeline, kanban)')
      .addText(text => {
        text
          .setPlaceholder('Planner/')
          .setValue(this.plugin.settings.basesFolder)
          .onChange(async (value) => {
            this.plugin.settings.basesFolder = value || DEFAULT_SETTINGS.basesFolder;
            await this.plugin.saveSettings();
          });
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName('Generate base files')
      .setDesc('Create or regenerate task list, calendar, timeline, and kanban base files')
      .addButton(button => button
        .setButtonText('Generate')
        .onClick(async () => {
          const baseGenerator = new BaseGeneratorService(this.app, () => this.plugin.settings);
          const tasksExists = baseGenerator.tasksBaseExists();
          const calendarExists = baseGenerator.calendarBaseExists();
          const timelineExists = baseGenerator.timelineBaseExists();
          const kanbanExists = baseGenerator.kanbanBaseExists();

          if (tasksExists || calendarExists || timelineExists || kanbanExists) {
            new RegenerateBasesModal(this.app, () => {
              void this.regenerateBases(baseGenerator);
            }).open();
          } else {
            await this.regenerateBases(baseGenerator);
          }
        }));
  }

  private renderCalendarTab(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Calendar configuration").setHeading();
    this.renderCalendarColors(containerEl);

    new Setting(containerEl)
      .setName('Default calendar')
      .setDesc('Auto-assigned to new items')
      .addDropdown(dropdown => {
        dropdown.addOption('', 'None');
        for (const calendarName of Object.keys(this.plugin.settings.calendars)) {
          dropdown.addOption(calendarName, calendarName);
        }
        return dropdown
          .setValue(this.plugin.settings.defaultCalendar)
          .onChange(async (value) => {
            this.plugin.settings.defaultCalendar = value || DEFAULT_SETTINGS.defaultCalendar;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Calendar view font size')
      .setDesc(`Font size for calendar events (${this.plugin.settings.calendarFontSize}px)`)
      .addSlider(slider => slider
        .setLimits(6, 18, 1)
        .setValue(this.plugin.settings.calendarFontSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.calendarFontSize = value;
          await this.plugin.saveSettings();
          // Re-render this tab to update the description
          const content = this.tabContents.get('calendar');
          if (content) {
            content.empty();
            this.renderCalendarTab(content);
          }
        }));
  }

  private renderStatusPriorityTab(containerEl: HTMLElement): void {
    // Status Configuration
    new Setting(containerEl).setName("Status configuration").setHeading();
    containerEl.createEl('p', {
      text: 'Define statuses for tasks. Use lucide icon names (e.g., circle, check-circle, lightbulb). Completed statuses auto-set date_completed.',
      cls: 'setting-item-description'
    });

    this.renderStatusList(containerEl);

    // Priority Configuration
    new Setting(containerEl).setName("Priority configuration").setHeading();
    containerEl.createEl('p', {
      text: 'Define priorities for tasks. Use lucide icon names (e.g., alert-triangle, chevrons-up, minus).',
      cls: 'setting-item-description'
    });
    this.renderPriorityList(containerEl);
  }

  private renderQuickCaptureTab(containerEl: HTMLElement): void {
    new Setting(containerEl).setName("Quick capture").setHeading();

    new Setting(containerEl)
      .setName('Default status')
      .setDesc('Status for new items created via quick capture')
      .addDropdown(dropdown => {
        for (const status of this.plugin.settings.statuses) {
          dropdown.addOption(status.name, status.name);
        }
        return dropdown
          .setValue(this.plugin.settings.quickCaptureDefaultStatus)
          .onChange(async (value) => {
            this.plugin.settings.quickCaptureDefaultStatus = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Open after create')
      .setDesc('Open the note in editor after quick capture')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.quickCaptureOpenAfterCreate)
        .onChange(async (value) => {
          this.plugin.settings.quickCaptureOpenAfterCreate = value;
          await this.plugin.saveSettings();
        }));
  }

  private renderStatusList(containerEl: HTMLElement): void {
    const listEl = containerEl.createDiv({ cls: 'planner-status-list' });

    for (let i = 0; i < this.plugin.settings.statuses.length; i++) {
      const status = this.plugin.settings.statuses[i];
      this.renderStatusItem(listEl, status, i);
    }

    // Add new status button
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText('Add status')
        .onClick(async () => {
          this.plugin.settings.statuses.push({
            name: 'New Status',
            color: '#6b7280',
            isCompleted: false,
            icon: 'circle',
          });
          await this.plugin.saveSettings();
          this.refreshCurrentTab();
        }));
  }

  private renderStatusItem(containerEl: HTMLElement, status: StatusConfig, index: number): void {
    const setting = new Setting(containerEl)
      .addText(text => text
        .setValue(status.name)
        .setPlaceholder('Status name')
        .onChange(async (value) => {
          this.plugin.settings.statuses[index].name = value;
          await this.plugin.saveSettings();
        }))
      .addText(text => text
        .setValue(status.icon || '')
        .setPlaceholder('Icon (e.g., circle)')
        .onChange(async (value) => {
          this.plugin.settings.statuses[index].icon = value || undefined;
          await this.plugin.saveSettings();
        }))
      .addColorPicker(picker => picker
        .setValue(status.color)
        .onChange(async (value) => {
          this.plugin.settings.statuses[index].color = value;
          await this.plugin.saveSettings();
        }))
      .addToggle(toggle => toggle
        .setTooltip('Is completed status')
        .setValue(status.isCompleted)
        .onChange(async (value) => {
          this.plugin.settings.statuses[index].isCompleted = value;
          await this.plugin.saveSettings();
        }))
      .addExtraButton(button => button
        .setIcon('trash')
        .setTooltip('Delete status')
        .onClick(async () => {
          this.plugin.settings.statuses.splice(index, 1);
          await this.plugin.saveSettings();
          this.refreshCurrentTab();
        }));

    setting.settingEl.addClass('planner-status-item');
  }

  private renderPriorityList(containerEl: HTMLElement): void {
    const listEl = containerEl.createDiv({ cls: 'planner-priority-list' });

    for (let i = 0; i < this.plugin.settings.priorities.length; i++) {
      const priority = this.plugin.settings.priorities[i];
      this.renderPriorityItem(listEl, priority, i);
    }

    // Add new priority button
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText('Add priority')
        .onClick(async () => {
          this.plugin.settings.priorities.push({
            name: 'New Priority',
            color: '#6b7280',
            weight: 0,
            icon: 'star',
          });
          await this.plugin.saveSettings();
          this.refreshCurrentTab();
        }));
  }

  private renderPriorityItem(containerEl: HTMLElement, priority: PriorityConfig, index: number): void {
    const setting = new Setting(containerEl)
      .addText(text => text
        .setValue(priority.name)
        .setPlaceholder('Priority name')
        .onChange(async (value) => {
          this.plugin.settings.priorities[index].name = value;
          await this.plugin.saveSettings();
        }))
      .addText(text => text
        .setValue(priority.icon || '')
        .setPlaceholder('Icon (e.g., star)')
        .onChange(async (value) => {
          this.plugin.settings.priorities[index].icon = value || undefined;
          await this.plugin.saveSettings();
        }))
      .addColorPicker(picker => picker
        .setValue(priority.color)
        .onChange(async (value) => {
          this.plugin.settings.priorities[index].color = value;
          await this.plugin.saveSettings();
        }))
      .addText(text => text
        .setPlaceholder('Weight')
        .setValue(String(priority.weight))
        .onChange(async (value) => {
          this.plugin.settings.priorities[index].weight = parseInt(value) || 0;
          await this.plugin.saveSettings();
        }))
      .addExtraButton(button => button
        .setIcon('trash')
        .setTooltip('Delete priority')
        .onClick(async () => {
          this.plugin.settings.priorities.splice(index, 1);
          await this.plugin.saveSettings();
          this.refreshCurrentTab();
        }));

    setting.settingEl.addClass('planner-priority-item');
  }

  private renderCalendarColors(containerEl: HTMLElement): void {
    const calendars = Object.entries(this.plugin.settings.calendars);

    for (const [name, config] of calendars) {
      const setting = new Setting(containerEl)
        .setName(name)
        .addText(text => {
          text
            .setPlaceholder('Folder (optional)')
            .setValue(config.folder || '')
            .onChange(async (value) => {
              this.plugin.settings.calendars[name].folder = value || undefined;
              await this.plugin.saveSettings();
            });
          new FolderSuggest(this.app, text.inputEl);
        })
        .addColorPicker(picker => picker
          .setValue(config.color)
          .onChange(async (value) => {
            this.plugin.settings.calendars[name].color = value;
            await this.plugin.saveSettings();
          }))
        .addExtraButton(button => button
          .setIcon('trash')
          .setTooltip('Delete calendar')
          .onClick(async () => {
            delete this.plugin.settings.calendars[name];
            await this.plugin.saveSettings();
            this.refreshCurrentTab();
          }));

      setting.settingEl.querySelector('.setting-item-control input[type="text"]')?.setAttribute('title', 'Folder where new items for this calendar are created');
    }

    // Add new calendar
    let newCalendarName = '';
    new Setting(containerEl)
      .setName('Add calendar')
      .addText(text => text
        .setPlaceholder('Calendar name')
        .onChange(value => {
          newCalendarName = value;
        }))
      .addButton(button => button
        .setButtonText('Add')
        .onClick(async () => {
          if (newCalendarName && !this.plugin.settings.calendars[newCalendarName]) {
            const calendarCount = Object.keys(this.plugin.settings.calendars).length;
            const nextColor = getNextCalendarColor(calendarCount);
            this.plugin.settings.calendars[newCalendarName] = { color: nextColor };
            await this.plugin.saveSettings();
            this.refreshCurrentTab();
          }
        }));
  }

  private refreshCurrentTab(): void {
    const content = this.tabContents.get(this.activeTab);
    if (content) {
      content.empty();
      const tabs = this.getTabs();
      const tab = tabs.find(t => t.id === this.activeTab);
      if (tab) {
        tab.render(content);
      }
    }
  }

  private async regenerateBases(baseGenerator: BaseGeneratorService): Promise<void> {
    try {
      const result = await baseGenerator.generateAllBases(true);

      const generated: string[] = [];
      if (result.tasks) generated.push('Task List');
      if (result.calendar) generated.push('Calendar');
      if (result.timeline) generated.push('Timeline');
      if (result.kanban) generated.push('Kanban');

      if (generated.length > 0) {
        new Notice(`${generated.join(', ')}.base file${generated.length > 1 ? 's have' : ' has'} been generated.`);
      } else {
        new Notice('Base files were already up to date.');
      }
    } catch (error) {
      console.error('Failed to generate base files:', error);
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to generate base files: ${message}`);
    }
  }
}
