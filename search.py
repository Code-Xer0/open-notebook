import os
for root, dirs, files in os.walk('backend'):
    if '.venv' in dirs:
        dirs.remove('.venv')
    for file in files:
        if file.endswith('.py'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                if 'process_source_input' in f.read():
                    print(filepath)
