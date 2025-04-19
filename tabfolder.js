// Tab Folders implementation for Firefox
class TabFolders {
    constructor() {
        console.log('TabFolders: Initializing...');
        this.init();
    }

    init() {
        try {
            console.log('TabFolders: Starting initialization');
            this.#initContextMenu();
            this.#addFolderStyles();
            this.#initEventListeners();
            console.log('TabFolders: Initialization completed successfully');
        } catch (error) {
            console.error('TabFolders initialization failed:', error);
        }
    }

    #addFolderStyles() {
        try {
            console.log('TabFolders: Adding folder styles');
            // Add CSS for nested folder indentation - ONLY styling, no behavior changes
            const styleSheet = document.createElement('style');
            styleSheet.id = 'tabfolders-styles';
            styleSheet.textContent = `
                /* Indentation for nested folders */
                tab-group[nested-level] {
                    margin-left: var(--nested-indent, 10px) !important;
                }
            `;
            document.head.appendChild(styleSheet);
            console.log('TabFolders: Folder styles added successfully');
        } catch (error) {
            console.error('TabFolders: Failed to add folder styles:', error);
        }
    }

    #initContextMenu() {
        try {
            console.log('TabFolders: Initializing context menu');
            const contextMenuItems = window.MozXULElement.parseXULToFragment(`
                <menuitem id="tab-folder-context-new" 
                         label="New Folder"/>
            `);
            const tabContextMenu = document.getElementById('tabContextMenu');
            if (tabContextMenu) {
                tabContextMenu.appendChild(contextMenuItems);
                console.log('TabFolders: Context menu item added successfully');
                document.getElementById('tab-folder-context-new')
                    .addEventListener('command', () => this.onNewFolder());
            } else {
                console.warn('TabFolders: tabContextMenu element not found');
            }
        } catch (error) {
            console.error('Context menu initialization failed:', error);
        }
    }

    #initEventListeners() {
        console.log('TabFolders: Setting up event listeners');
        const events = [
            ['TabGrouped', this.#onTabGrouped],
            ['TabUngrouped', this.#onTabUngrouped],
            ['TabGroupRemoved', this.#onTabGroupRemoved],
            ['TabGroupCreate', this.#onTabGroupCreate],
            ['TabPinned', this.#onTabPinned],
            ['TabUnpinned', this.#onTabUnpinned]
        ];

        for (const [event, handler] of events) {
            console.log(`TabFolders: Adding listener for ${event}`);
            window.addEventListener(event, handler.bind(this));
        }

        // Add cleanup on window unload
        window.addEventListener('unload', () => {
            console.log('TabFolders: Cleaning up on window unload');
            this.cleanup();
        });
        
        console.log('TabFolders: Event listeners setup completed');
    }

    #getParentElements(element) {
        const parents = [];
        let current = element.parentElement;
        while (current) {
            parents.push({
                tagName: current.tagName,
                className: current.className,
                attributes: Array.from(current.attributes).map(attr => `${attr.name}=${attr.value}`).join(', ')
            });
            current = current.parentElement;
        }
        return parents;
    }

    cleanup() {
        console.log('TabFolders: Starting cleanup');
        const events = [
            'TabGrouped', 'TabUngrouped', 'TabGroupRemoved', 'TabGroupCreate',
            'TabPinned', 'TabUnpinned'
        ];

        for (const event of events) {
            console.log(`TabFolders: Removing listener for ${event}`);
            window.removeEventListener(event, this[`#on${event}`].bind(this));
        }

        // Remove style sheet
        const styleSheet = document.getElementById('tabfolders-styles');
        if (styleSheet) {
            styleSheet.remove();
            console.log('TabFolders: Removed style sheet');
        }

        const menuItem = document.getElementById('tab-folder-context-new');
        if (menuItem) {
            menuItem.remove();
            console.log('TabFolders: Context menu item removed');
        }
        console.log('TabFolders: Cleanup completed');
    }

    #onTabGrouped(event) {
        console.log('TabFolders: Tab grouped event received');
        const tab = event.target;
        const group = tab.group;
        if (!group) {
            console.warn('TabFolders: No group found for grouped tab');
            return;
        }
        
        group.pinned = tab.pinned;
        this.#updateFolderState(group);
        console.log('TabFolders: Tab grouped successfully');
    }

    #onTabUngrouped(event) {
        const tab = event.target;
        const group = event.detail;
        if (!group || !group.hasAttribute('folder-group')) {
            return;
        }
        
        this.#updateFolderState(group);
        
        // Remove empty folder
        if (group.querySelectorAll('tab').length === 0) {
            group.remove();
        }
    }

    #updateFolderState(group) {
        if (!group || !group.hasAttribute('folder-group')) {
            console.warn('TabFolders: Invalid group for folder state update');
            return;
        }
        
        const tabs = group.querySelectorAll('tab');
        if (tabs.length === 0) {
            group.remove();
        }
    }

    #onTabGroupCreate(event) {
        const group = event.target;
        if (!group.pinned) {
            return;
        }

        group.setAttribute('folder-group', 'true');
        this.#updateFolderState(group);
    }

    #onTabPinned(event) {
        console.log('TabFolders: Tab pinned event received');
        const tab = event.target;
        const group = tab.group;
        if (group && group.hasAttribute('folder-group')) {
            group.pinned = true;
            console.log('TabFolders: Group pinned state updated');
        }
    }

    #onTabUnpinned(event) {
        console.log('TabFolders: Tab unpinned event received');
        const tab = event.target;
        const group = tab.group;
        if (group && group.hasAttribute('folder-group')) {
            group.pinned = false;
            console.log('TabFolders: Group unpinned state updated');
        }
    }

    #onTabGroupRemoved(event) {
        const group = event.target;
        if (group.hasAttribute('folder-group')) {
            // Clean up any folder-specific attributes or state
            for (const tab of group.querySelectorAll('tab')) {
                tab.removeAttribute('had-pinned-changed');
                tab.removeAttribute('pinned-changed');
            }
        }
    }

    // Add a specific handler for tab group menu ungroup operations
    #safeUngroupNestedFolder(group) {
        if (!group || !group.hasAttribute('folder-group')) {
            return;
        }
        
        // Get all tabs in the folder first before we start ungrouping
        const tabs = Array.from(group.querySelectorAll('tab'));
        if (!tabs.length) {
            return;
        }
        
        // Check if this is a nested folder
        const parentGroup = group.closest('tab-group[folder-group="true"]:not(#' + group.id + ')');
        
        // If it's a nested folder, move tabs to parent group instead of ungrouping
        if (parentGroup) {
            // Move each tab to the parent group
            tabs.forEach(tab => {
                if (tab && tab.parentNode === group) {
                    parentGroup.appendChild(tab);
                }
            });
            
            // Remove the now-empty group
            if (group.querySelectorAll('tab').length === 0) {
                group.remove();
            }
        } else {
            // Not nested, perform regular ungrouping safely
            // We need to create a copy because the collection will change as we ungroup
            tabs.forEach(tab => {
                if (tab && tab.parentNode === group) {
                    try {
                        gBrowser.ungroupTab(tab);
                    } catch (e) {
                        console.warn('Failed to ungroup tab:', e);
                    }
                }
            });
        }
    }

    onNewFolder() {
        console.log('TabFolders: Creating new folder');
        try {
            // Get all tabs and identify selected ones
            const allTabs = Array.from(gBrowser.tabs);
            
            // Get both multiselected tabs and the currently selected tab
            const multiselectedTabs = allTabs.filter(tab => tab.multiselected);
            const selectedTab = gBrowser.selectedTab;
            
            // If we have multiselected tabs, use those. Otherwise, use just the selected tab
            const selectedTabs = multiselectedTabs.length > 0 ? multiselectedTabs : [selectedTab];
            
            console.log('TabFolders: Selection state:', {
                multiselectedCount: multiselectedTabs.length,
                selectedTabId: selectedTab?.id,
                usingMultiselection: multiselectedTabs.length > 0
            });

            const tabs = selectedTabs.filter(tab => tab && tab.parentNode);
            
            console.log('TabFolders: Tab selection details:', {
                allTabsLength: allTabs.length,
                selectedTabsLength: selectedTabs.length,
                validTabsLength: tabs.length,
                tabDetails: tabs.map(tab => ({
                    id: tab.id,
                    pinned: tab.pinned,
                    selected: tab.selected,
                    multiselected: tab.multiselected
                }))
            });

            if (!tabs.length) {
                console.warn('TabFolders: No valid tabs selected for new folder');
                return;
            }

            // Check if tabs are already in a folder
            // We'll use the first tab as a reference to find the parent folder
            const parentGroup = tabs[0].closest('tab-group[folder-group="true"]');
            
            console.log('TabFolders: Parent folder detection:', {
                hasParentFolder: !!parentGroup,
                parentFolderId: parentGroup?.id,
                parentFolderLabel: parentGroup?.label
            });

            // Create a new tab group element
            const group = document.createXULElement('tab-group');
            group.id = `tabgroup-${Date.now()}`;
            
            // Set group properties
            group.pinned = true;
            group.setAttribute('folder-group', 'true');
            // Set the label before appending to DOM to avoid undefined label issue
            group.setAttribute('label', 'New Folder');

            // Move tabs into the group first - before adding group to DOM
            for (const tab of tabs) {
                if (!tab.pinned) {
                    console.log(`TabFolders: Pinning tab ${tab.id}`);
                    gBrowser.pinTab(tab);
                }
            }

            // Handle folder insertion based on whether we're creating a nested folder
            if (parentGroup) {
                console.log('TabFolders: Creating nested folder inside', parentGroup.id);
                try {
                    // Set nesting level for indentation
                    const parentLevel = parseInt(parentGroup.getAttribute('nested-level') || '0');
                    const nestedLevel = parentLevel + 1;
                    group.setAttribute('nested-level', nestedLevel);
                    console.log(`TabFolders: Setting nested level to ${nestedLevel}`);
                    
                    // Insert the new folder into the parent folder
                    parentGroup.appendChild(group);
                    console.log('TabFolders: Successfully created nested folder');
                } catch (error) {
                    console.error('TabFolders: Failed to create nested folder:', error);
                    // Fallback to standard insertion if nested approach fails
                    this._insertGroupIntoTabContainer(group);
                }
            } else {
                // Standard insertion for non-nested folders
                this._insertGroupIntoTabContainer(group);
            }
            
            // Now move the tabs to the group after it's in the DOM
            console.log('TabFolders: Moving tabs into group:', tabs.length);
            for (const tab of tabs) {
                console.log(`TabFolders: Moving tab ${tab.id} to group`);
                group.appendChild(tab);
            }

            // After insertion and moving tabs, set the label again to ensure it's properly set
            setTimeout(() => {
                if (group && group.parentNode) {
                    group.label = 'New Folder';
                }
            }, 50);

            // Verify the group contents
            console.log('TabFolders: New folder created with', {
                selectedTabs: tabs.length,
                groupTabs: group.children.length,
                pinnedTabs: Array.from(group.children).filter(t => t.pinned).length,
                tabIds: Array.from(group.children).map(t => t.id),
                isNested: !!parentGroup,
                parentGroupId: parentGroup?.id,
                nestedLevel: group.getAttribute('nested-level')
            });

            // Add special handler for folder ungrouping
            if (group.__ungroupHandler) {
                group.removeEventListener('command', group.__ungroupHandler);
            }
            
            group.__ungroupHandler = (event) => {
                // Intercept ungroup operations on this folder
                if (event.target.id === 'tabGroupEditor_ungroupTabs') {
                    event.preventDefault();
                    event.stopPropagation();
                    this.#safeUngroupNestedFolder(group);
                    return false;
                }
            };
            
            group.addEventListener('command', group.__ungroupHandler, true);

        } catch (error) {
            console.error('Failed to create new folder:', error);
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
                selectedTabs: gBrowser.selectedTabs?.length || 0
            });
        }
    }

    // Helper method to insert a group into the tab container
    _insertGroupIntoTabContainer(group) {
        try {
            // Determine proper parent to insert the group
            const tabContainer = gBrowser.tabContainer;
            
            // Find insertion point - use proper containerNode
            // The vertical pinned tabs container is the preferred location if it exists
            if (gBrowser.verticalPinnedTabsContainer) {
                console.log('TabFolders: Using vertical pinned tabs container');
                const insertPoint = gBrowser.verticalPinnedTabsContainer.querySelector('.vertical-pinned-tabs-container-separator');
                if (insertPoint) {
                    console.log('TabFolders: Inserting before separator');
                    insertPoint.parentNode.insertBefore(group, insertPoint);
                } else {
                    console.log('TabFolders: Appending to vertical pinned tabs container');
                    gBrowser.verticalPinnedTabsContainer.appendChild(group);
                }
            } else {
                console.log('TabFolders: Using standard tab container');
                tabContainer.appendChild(group);
            }
            console.log('TabFolders: Group inserted into container successfully');
        } catch (error) {
            console.error('TabFolders: Failed to insert group into container:', error);
            // Last resort fallback
            try {
                gBrowser.tabContainer.appendChild(group);
                console.log('TabFolders: Used fallback insertion method');
            } catch (finalError) {
                console.error('TabFolders: All insertion methods failed:', finalError);
            }
        }
    }
}

// Initialize when window loads
window.addEventListener('load', () => {
    console.log('TabFolders: Window load event received');
    try {
        window.TabFolders = new TabFolders();
        console.log('TabFolders: Successfully initialized TabFolders instance');
    } catch (error) {
        console.error('TabFolders initialization failed:', error);
    }
});
