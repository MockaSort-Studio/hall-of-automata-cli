import os

root = os.path.expanduser('~/.hall')
slug = open(os.path.expanduser('~/.hall/.repo-slug')).read().strip()

project_root = f'{root}/{slug}'
os.makedirs(project_root, exist_ok=True)

config_path = f'{project_root}/config.json'
if not os.path.exists(config_path):
    open(config_path, 'w').write('{}')
    print(f'Initialized project: {slug}')
else:
    print(f'Using project: {slug}')
