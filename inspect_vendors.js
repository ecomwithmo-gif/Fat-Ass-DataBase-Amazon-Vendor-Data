const { readVendorList } = require('./server/utils/fileHandler');

try {
  const vendors = readVendorList();
  if (vendors.length > 0) {
    console.log("Vendor Keys:", Object.keys(vendors[0]));
    console.log("Sample Vendor:", vendors[0]);
  } else {
    console.log("No vendors found in file.");
  }
} catch (err) {
  console.error(err);
}
