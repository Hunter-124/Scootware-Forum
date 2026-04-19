#!/usr/bin/python3
import re
import os

path = '/home/admin/Scootware-Forum/artifacts/api-server/src/app.ts'
if not os.path.exists(path):
    print(f"Error: {path} not found")
    exit(1)

with open(path, 'r') as f:
    content = f.read()

# Remove the block that starts around line 140
# The pattern looks for the declaration and the following if/else block
# We use a very specific pattern to avoid matching the NEW block at line 244
old_block_pattern = r'// Determine which session store to use.*?sessionStore = new MemorySessionStore\(\);\s*\}'
new_content = re.sub(old_block_pattern, '', content, count=1, flags=re.DOTALL)

if content == new_content:
    print("Warning: Pattern not matched. Checking for exact lines.")
    # Fallback: exact match of the known old block
    lines = content.splitlines()
    # Find indices
    start_idx = -1
    end_idx = -1
    for i, line in enumerate(lines):
        if 'let sessionStore: session.Store;' in line and i < 200: # Ensure it's the early one
            start_idx = i
        if 'sessionStore = new MemorySessionStore();' in line and start_idx != -1 and i < 200:
            # The next line is likely the closing brace
            if i + 1 < len(lines) and '}' in lines[i+1]:
                end_idx = i + 1
                break
    
    if start_idx != -1 and end_idx != -1:
        # Check if there is a comment above start_idx
        if start_idx > 0 and '// Determine' in lines[start_idx-1]:
            start_idx -= 1
        
        print(f"Removing lines {start_idx+1} to {end_idx+1}")
        del lines[start_idx:end_idx+1]
        new_content = '\n'.join(lines)
    else:
        print("Error: Could not find duplicate block")
        exit(1)

with open(path, 'w') as f:
    f.write(new_content)
print("SUCCESS: Duplicate sessionStore removed")
