// Deprecated. Use Supabase client directly.
// const xlsx = require('xlsx');
// const path = require('path');
// const fs = require('fs');

const VENDOR_FILE_PATH = path.join(__dirname, '../Vendor LIst.xlsx');

/**
 * Reads the Vendor List Excel file and returns an array of objects.
 */
function readVendorList() {
  if (!fs.existsSync(VENDOR_FILE_PATH)) {
    console.warn(`Vendor file not found at ${VENDOR_FILE_PATH}`);
    return [];
  }

  try {
    const workbook = xlsx.readFile(VENDOR_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    console.log(`Reading sheet: ${sheetName}`); // Debug log
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { defval: "" });
    console.log(`Read ${data.length} vendors from file:`, data); // Debug log
    return data;
  } catch (error) {
    console.error("Error reading vendor list:", error);
    throw error;
  }
}

/**
 * Writes the array of objects back to the Vendor List Excel file.
 * @param {Array} data 
 */
function writeVendorList(data) {
  try {
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(data);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Sheet1"); // Assuming default sheet name
    xlsx.writeFile(workbook, VENDOR_FILE_PATH);
  } catch (error) {
    console.error("Error writing vendor list:", error);
    throw error;
  }
}

module.exports = {
  readVendorList,
  writeVendorList
};
