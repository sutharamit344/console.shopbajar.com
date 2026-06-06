const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/WaiterClient.tsx');
const content = fs.readFileSync(filePath, 'utf8');

let braceCount = 0;
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const oldBraceCount = braceCount;
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
  }
  
  if (braceCount !== oldBraceCount) {
    console.log(`Line ${i + 1} [Braces: ${braceCount}]: ${line.trim()}`);
  }
}
