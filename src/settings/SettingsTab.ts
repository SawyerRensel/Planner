import { App, PluginSettingTab, Setting, Modal, Notice } from 'obsidian';
import type PlannerPlugin from '../main';
import { PlannerSettings, StatusConfig, PriorityConfig, DEFAULT_SETTINGS, OpenBehavior, getNextCalendarColor } from '../types/settings';
import { BaseGeneratorService } from '../services/BaseGeneratorService';
import { FolderSuggest, FolderListSuggest } from '../components/suggests/FolderSuggest';

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

    contentEl.createEl('h2', { text: 'Regenerate Base Files' });
    contentEl.createEl('p', {
      text: 'This will overwrite your existing Tasks.base and Calendar.base files. Any customizations you have made to these files will be lost.',
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

  constructor(app: App, plugin: PlannerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // General Settings
    containerEl.createEl('h2', { text: 'General Settings' });

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
      .addText(text => text
        .setPlaceholder('Templates/planner-item.md')
        .setValue(this.plugin.settings.itemTemplate)
        .onChange(async (value) => {
          this.plugin.settings.itemTemplate = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Date format')
      .setDesc('Display format for dates')
      .addDropdown(dropdown => dropdown
        .addOption('YYYY-MM-DD', 'YYYY-MM-DD')
        .addOption('MM/DD/YYYY', 'MM/DD/YYYY')
        .addOption('DD/MM/YYYY', 'DD/MM/YYYY')
        .addOption('MMM D, YYYY', 'MMM D, YYYY')
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
        .addOption('new-tab', 'Open in New Tab')
        .addOption('same-tab', 'Open in Same Tab')
        .addOption('split-right', 'Split Right')
        .addOption('split-down', 'Split Down')
        .setValue(this.plugin.settings.openBehavior)
        .onChange(async (value: OpenBehavior) => {
          this.plugin.settings.openBehavior = value;
          await this.plugin.saveSettings();
        }));

    // Calendar Configuration
    containerEl.createEl('h2', { text: 'Calendar Configuration' });
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
          this.display(); // Refresh to update description
        }));

    // Bases Views
    containerEl.createEl('h2', { text: 'Bases Views' });

    new Setting(containerEl)
      .setName('Bases folder')
      .setDesc('Where to save the Tasks.base and Calendar.base files')
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
      .setName('Generate Base files')
      .setDesc('Create or regenerate Tasks.base and Calendar.base files')
      .addButton(button => button
        .setButtonText('Generate')
        .onClick(async () => {
          const baseGenerator = new BaseGeneratorService(this.app, () => this.plugin.settings);
          const tasksExists = await baseGenerator.tasksBaseExists();
          const calendarExists = await baseGenerator.calendarBaseExists();

          if (tasksExists || calendarExists) {
            // Show confirmation modal
            new RegenerateBasesModal(this.app, async () => {
              await this.regenerateBases(baseGenerator);
            }).open();
          } else {
            // No existing files, just create them
            await this.regenerateBases(baseGenerator);
          }
        }));

    // Item Identification
    containerEl.createEl('h2', { text: 'Item Identification' });

    new Setting(containerEl)
      .setName('Identification method')
      .setDesc('How to identify planner items')
      .addDropdown(dropdown => dropdown
        .addOption('folder', 'By folder')
        .addOption('tag', 'By tag')
        .addOption('both', 'Both (folder OR tag)')
        .setValue(this.plugin.settings.identificationMethod)
        .onChange(async (value: PlannerSettings['identificationMethod']) => {
          this.plugin.settings.identificationMethod = value;
          await this.plugin.saveSettings();
          this.display(); // Refresh to show/hide relevant settings
        }));

    if (this.plugin.settings.identificationMethod !== 'tag') {
      new Setting(containerEl)
        .setName('Include folders')
        .setDesc('Folders to scan for items (comma-separated)')
        .addText(text => {
          text
            .setPlaceholder('Planner/')
            .setValue(this.plugin.settings.includeFolders.join(', '))
            .onChange(async (value) => {
              this.plugin.settings.includeFolders = value
                .split(',')
                .map(s => s.trim())
                .filter(s => s.length > 0);
              await this.plugin.saveSettings();
            });
          new FolderListSuggest(this.app, text.inputEl);
        });
    }

    if (this.plugin.settings.identificationMethod !== 'folder') {
      new Setting(containerEl)
        .setName('Include tags')
        .setDesc('Tags that identify items (comma-separated, without #)')
        .addText(text => text
          .setPlaceholder('planner, task, event')
          .setValue(this.plugin.settings.includeTags.join(', '))
          .onChange(async (value) => {
            this.plugin.settings.includeTags = value
              .split(',')
              .map(s => s.trim().replace(/^#/, ''))
              .filter(s => s.length > 0);
            await this.plugin.saveSettings();
          }));
    }

    // Status Configuration
    containerEl.createEl('h2', { text: 'Status Configuration' });
    containerEl.createEl('p', {
      text: 'Define statuses for tasks. Use Lucide icon names (e.g., circle, check-circle, lightbulb). Completed statuses auto-set date_completed.',
      cls: 'setting-item-description'
    });

    this.renderStatusList(containerEl);

    // Priority Configuration
    containerEl.createEl('h2', { text: 'Priority Configuration' });
    containerEl.createEl('p', {
      text: 'Define priorities for tasks. Use Lucide icon names (e.g., alert-triangle, chevrons-up, minus).',
      cls: 'setting-item-description'
    });
    this.renderPriorityList(containerEl);

    // Quick Capture
    containerEl.createEl('h2', { text: 'Quick Capture' });

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
          this.display();
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
          this.display();
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
          this.display();
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
          this.display();
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
            this.display();
          }));

      // Add description for the folder field
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
            this.display();
          }
        }));
  }

  private async regenerateBases(baseGenerator: BaseGeneratorService): Promise<void> {
    try {
      const result = await baseGenerator.generateAllBases(true);

      if (result.tasks && result.calendar) {
        new Notice('Tasks.base and Calendar.base files have been generated.');
      } else if (result.tasks) {
        new Notice('Tasks.base file has been generated.');
      } else if (result.calendar) {
        new Notice('Calendar.base file has been generated.');
      } else {
        new Notice('Base files were already up to date.');
      }
    } catch (error) {
      console.error('Failed to generate base files:', error);
      new Notice(`Failed to generate base files: ${error.message}`);
    }
  }
}
