// lib/filename-generator.js

const hazardMap = {
    'Active Fault': 'AF',
    'Liquefaction': 'LIQN',
    'Landslide - Earthquake - Induced': 'EIL',
    'Tsunami': 'TSU',
    'Lahar': 'LHR',
    'Pyroclastic Flow': 'PF',
    'Base Surge': 'BS',
    'Lava Flow': 'LF'
};

const orgAbbreviations = {
    'Government': 'Govt',
    'Department': 'Dept',
    'Company': 'Co',
    'Development': 'Devt',
    'Incorporated': 'Inc',
    'Corporation': 'Corp',
    'Limited': 'Ltd',
    'and': '&',
    'Association': 'Assn',
    'Foundation': 'Fdn',
    'Cooperative': 'Coop',
    'Services': 'Svcs',
    'International': 'Intl',
    'Group': 'Grp',
    'Construction': 'Constr',
    'Builders': 'Bldrs',
    'Consultants': 'Cons',
    'Enterprises': 'Ent',
    'Trading': 'Trdg',
    'Manufacturing': 'Mfg',
    'Engineering': 'Engr'
};

function normalizePascal(text) {
    if (!text) return '';
    return text
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

function abbreviateOrgName(name) {
    if (!name) return '';
    let result = name;
    Object.entries(orgAbbreviations).forEach(([full, abbr]) => {
        const regex = new RegExp(`\\b${full}\\b`, 'gi');
        result = result.replace(regex, abbr);
    });
    return result;
}

/**
 * Generates filenames based on metadata.
 * @param {Object} metadata - Extracted metadata { requestId, hazards, client, requestedBy, location }
 * @param {string} suffix - User preference suffix (e.g. ArP)
 * @returns {Array<string>} List of filenames
 */
export function generateFilenames(metadata, suffix = 'ArP') {
    const { requestId, hazardType, client, requestedBy, location } = metadata;

    if (!requestId || !location) return ['Missing required metadata (ID or Location)'];

    // Parse Location
    // The page field is labeled "Province, City, Barangay" but the actual value
    // is ordered as "Barangay, City, Province" so parts[0]=brgy, parts[1]=city, parts[2]=province.
    // This matches the original ham-filename-extension/popup.js assignment.
    let parts = (location || '').split(',').map(s => s.trim());

    const brgy = parts[0] || '';
    const city = parts[1] || '';
    const province = parts[2] || '';

    const locationFormatted = `${province}-${city}-Brgy${brgy}`.replace(/\s+/g, '');
    const clientFormatted = normalizePascal(abbreviateOrgName(client));

    // Format Requester
    let reqByFormatted = '';
    if (requestedBy) {
        const nameParts = requestedBy.split(' ');
        if (nameParts.length >= 3) {
            const first = nameParts[0].charAt(0).toUpperCase();
            const middle = nameParts[1].charAt(0).toUpperCase();
            const last = nameParts[nameParts.length - 1];
            const lastFormatted = last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
            reqByFormatted = `${first}${middle}${lastFormatted}`;
        } else if (nameParts.length === 2) {
            const first = nameParts[0].charAt(0).toUpperCase();
            const last = nameParts[1];
            const lastFormatted = last.charAt(0).toUpperCase() + last.slice(1).toLowerCase();
            reqByFormatted = `${first}${lastFormatted}`;
        } else {
            const name = nameParts[0];
            reqByFormatted = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
        }
    }

    // Hazard Codes
    // hazardType is likely a comma-separated string or array
    let hazardList = [];
    if (Array.isArray(hazardType)) {
        hazardList = hazardType;
    } else if (typeof hazardType === 'string') {
        hazardList = hazardType.split(',').map(h => h.trim());
    }

    const hazardCodes = Object.entries(hazardMap)
        .filter(([label]) => hazardList.includes(label))
        .map(([_, code]) => code);

    const afGroup = hazardCodes.filter(h => ['AF', 'LIQN', 'EIL', 'TSU'].includes(h));
    const volGroup = hazardCodes.filter(h => ['LHR', 'PF', 'BS', 'LF'].includes(h));

    const filenames = [];

    // Earthquake
    if (hazardCodes.includes('AF')) {
        filenames.push('AF');
        afGroup.filter(code => code !== 'AF').forEach(code => {
            filenames.push(`AF-${code}`);
        });
    } else if (afGroup.length > 0) {
        // If AF not present but other EQ hazards are, usually we still group under AF or just list them?
        // Original logic only pushed if AF was present.
        // Let's stick to original logic: "Add AF base filename if Active Fault is present"
    }

    // Volcano
    if (volGroup.length > 0) {
        filenames.push('VOL');
        volGroup.forEach(code => {
            filenames.push(`VOL-${code}`);
        });
    }

    // Build final strings
    return filenames.map(code =>
        `${requestId}_${code}_${locationFormatted}_${clientFormatted}-${reqByFormatted}_${suffix}`
    );
}
