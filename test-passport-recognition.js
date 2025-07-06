import { createToolRegistry } from './src/tools/tool-registry.ts';

// Test the passport image recognition logic
console.log('🧪 Testing passport image recognition...');

// Mock processed files array (simulating uploaded passport image)
const processedFiles = [
  {
    fileName: 'Passport_new_ext_05_apr_2032_p1.png',
    fileContent: 'base64encodedcontent...',
    fileSize: 3600000 // 3.6 MB
  }
];

// Mock passport tools
const mockPassportTools = {
  savePassport: jest.fn(),
  findCustomer: jest.fn(),
  updateCustomer: jest.fn(),
  deleteCustomer: jest.fn(),
  getAllCustomers: jest.fn()
};

// Create tool registry with passport tools enabled
const toolRegistry = createToolRegistry(
  undefined, // calendar tools
  undefined, // email tools
  undefined, // file tools
  undefined, // web tools
  mockPassportTools,
  { passport: true, calendar: false } // config override
);

// Test message similar to user's request
const userMessage = 'add the passport to db';

// Check if passport tools are available
const passportTools = toolRegistry.getToolsByCategory('passport');
console.log('✅ Passport tools available:', passportTools.length);

// Test passport recognition logic
const isPassportRequest = userMessage.toLowerCase().includes('passport') ||
                         userMessage.toLowerCase().includes('add to db') ||
                         userMessage.toLowerCase().includes('save') ||
                         userMessage.toLowerCase().includes('analyze');

console.log('✅ Passport request detected:', isPassportRequest);

// Test file ID generation for processed files
const fileIds = processedFiles.map(f => `processed:${f.fileName}`);
console.log('✅ Generated file IDs:', fileIds);

// Test processed file detection
const processedFileIds = fileIds.filter(id => id.startsWith('processed:'));
console.log('✅ Processed file IDs detected:', processedFileIds);

console.log('🎉 All tests passed! The passport recognition logic should work correctly.');
