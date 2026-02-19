// Scraper Content Script
// Runs in ISOLATED world

console.log('PHAT Scraper Loaded');

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'GET_PAGE_METADATA') {
        const metadata = extractMetadata();
        sendResponse(metadata);
    } else if (request.action === 'GET_TABLE_DATA') {
        const tableData = extractTableData();
        sendResponse(tableData);
    }
});

function extractMetadata() {
    // Basic extraction primarily for filename generation
    const metadata = {
        requestId: '',
        client: '',
        location: '',
        requestedBy: '',
        rawText: document.body.textContent // Fallback
    };

    // Attempt to scrape relevant fields based on known structure (from ham-filename-extension logic)
    // We can refine this as we port the logic
    // Targeted DOM Extraction (Primary)
    const getTableValue = (label) => {
        // Look for cells (th, td) or labels that look like the key
        const candidates = Array.from(document.querySelectorAll('th, td, label, dt'));

        for (const el of candidates) {
            let text = el.textContent.trim();
            // aggressive normalization: remove colons, whitespace
            // NEW: also normalize inner whitespace to single space
            text = text.replace(/[:\s]+$/, '').replace(/\s+/g, ' ');

            if (text.toLowerCase() === label.toLowerCase()) {
                // Found the label! Look for value.

                // Case 1: Table row (th -> td or td -> td)
                if ((el.tagName === 'TH' || el.tagName === 'TD') && el.nextElementSibling) {
                    return el.nextElementSibling.textContent.trim();
                }

                // Case 2: Label -> Input
                if (el.tagName === 'LABEL') {
                    const id = el.getAttribute('for');
                    if (id) {
                        const input = document.getElementById(id);
                        if (input) return input.value || input.innerText;
                    }
                }
            }
        }
        return null;
    };

    // Fallback Regex (Secondary)
    // We keep this for non-table layouts but make it stricter
    const extractRegex = (label) => {
        const text = document.body.textContent;
        // Match "Label" followed immediately by ":" (optional) and value, 
        // but ensure Label is a whole word constraint if possible, or start of line
        const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // We use the User's example "Request[tab]123456" -> \s+ covers tabs
        const regex = new RegExp(`${escapedLabel}[:]?\\s+([^\\n\\r]+)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    };

    const getValue = (label) => getTableValue(label) || extractRegex(label);

    try {
        // Labels based on User's provided snippet:
        // "Request", "Requested For", "Requested By", "Province, City, Barangay"

        // Note: 'Request' from regex matched 'Detail'. 
        // DOM exact match should fix this as 'Request Detail' != 'Request'.

        metadata.requestId = getValue('Request');
        metadata.client = getValue('Requested For');
        metadata.requestedBy = getValue('Requested By');
        metadata.location = getValue('Province, City, Barangay');

        const rawHazards = getValue('Hazard Type');
        if (rawHazards) {
            metadata.hazardType = rawHazards.split(',').map(h => h.trim());
        }

        // If location is still empty, try "HAR Lot Description, Location" or "Lot Description"
        if (!metadata.location || metadata.location === 'Not found') {
            metadata.location = getValue('HAR Lot Description, Location') || getValue('Other Location Details') || '';
        }

    } catch (e) {
        console.error('Error extracting metadata:', e);
    }

    return metadata;
}

function extractTableData() {
    const table = document.querySelector('#assessment-grid table.items');
    if (!table) return [];

    // Extract rows as arrays of text, respecting current DOM state (edits)
    return Array.from(table.querySelectorAll('tbody tr')).map(tr =>
        Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
    );
}

// Phase 1: Auto-scrape on page load — push to session storage
(function autoScrape() {
    try {
        const metadata = extractMetadata();
        chrome.storage.session.set({ pageMetadata: metadata }, () => {
            if (chrome.runtime.lastError) {
                console.warn('PHAT: Could not save metadata to session storage:', chrome.runtime.lastError.message);
            } else {
                console.log('PHAT: Metadata auto-scraped and cached');
            }
        });
    } catch (e) {
        console.error('PHAT: Auto-scrape failed:', e);
    }
})();
