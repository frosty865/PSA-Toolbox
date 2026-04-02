// JSON File Converter - Fix structured JSON files to flat form data format
// Run this with: node fix_json_files.js

const fs = require('fs');
const path = require('path');

// Function to convert structured JSON to flat form data
function convertStructuredToFlat(data) {
    let formData = {};
    
    // If this is the structured export format, extract the form data
    if (data.facilityInfo || data.contactInfo || data.assessmentData) {
        // Add facility info fields
        if (data.facilityInfo) {
            Object.keys(data.facilityInfo).forEach(key => {
                formData[key] = data.facilityInfo[key];
            });
        }
        
        // Add contact info fields  
        if (data.contactInfo) {
            Object.keys(data.contactInfo).forEach(key => {
                formData[key] = data.contactInfo[key];
            });
        }
        
        // Add any other top-level fields that might be form data
        Object.keys(data).forEach(key => {
            if (key !== 'facilityInfo' && key !== 'contactInfo' && key !== 'assessmentData' && key !== 'exportDate' && key !== 'version') {
                formData[key] = data[key];
            }
        });
        
        // Add metadata
        formData.exportDate = data.exportDate || new Date().toISOString();
        formData.version = data.version || '3.0';
        
        return formData;
    }
    
    // If it's already flat, return as-is
    return data;
}

// Function to process a single JSON file
function processJsonFile(filePath) {
    try {
        console.log(`Processing: ${filePath}`);
        
        // Read the file
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(fileContent);
        
        // Convert to flat format
        const flatData = convertStructuredToFlat(data);
        
        // Create backup
        const backupPath = filePath.replace('.json', '_backup.json');
        fs.writeFileSync(backupPath, fileContent);
        console.log(`  Backup created: ${backupPath}`);
        
        // Write the converted data
        const convertedJson = JSON.stringify(flatData, null, 2);
        fs.writeFileSync(filePath, convertedJson);
        console.log(`  Converted successfully`);
        
        return true;
    } catch (error) {
        console.error(`  Error processing ${filePath}:`, error.message);
        return false;
    }
}

// Main function
function main() {
    console.log('JSON File Converter - Converting structured JSON files to flat format');
    console.log('===============================================================');
    
    // Look for JSON files in the current directory
    const files = fs.readdirSync('.')
        .filter(file => file.endsWith('.json') && !file.includes('_backup'))
        .filter(file => file.startsWith('SAFE_Assessment_'));
    
    if (files.length === 0) {
        console.log('No SAFE_Assessment_*.json files found in current directory');
        return;
    }
    
    console.log(`Found ${files.length} JSON files to process:`);
    files.forEach(file => console.log(`  - ${file}`));
    console.log('');
    
    let successCount = 0;
    let errorCount = 0;
    
    files.forEach(file => {
        const success = processJsonFile(file);
        if (success) {
            successCount++;
        } else {
            errorCount++;
        }
    });
    
    console.log('');
    console.log('Conversion Summary:');
    console.log(`  Successfully converted: ${successCount} files`);
    console.log(`  Errors: ${errorCount} files`);
    console.log('');
    console.log('All original files have been backed up with _backup.json suffix');
    console.log('You can now import the converted JSON files successfully!');
}

// Run the converter
main();

