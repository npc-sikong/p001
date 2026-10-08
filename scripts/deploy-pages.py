# -*- coding: utf-8 -*-
"""Publish locally built dist to GitHub Pages without a cloud project build."""
from pathlib import Path
import argparse
import json
import os
import re
import subprocess

root = Path(__file__).resolve().parent.parent
if not root.is_relative_to(Path('/Volumes/pro990')):
    raise SystemExit('Run this project from the pro990 disk as required by AGENTS.md')
temp_dir = root / '.work/tmp'
temp_dir.mkdir(parents=True, exist_ok=True)
env = {**os.environ, 'TMPDIR': str(temp_dir), 'PYTHONDONTWRITEBYTECODE': '1',
       'GODEBUG': 'http2client=0', 'GH_PROMPT_DISABLED': '1', 'GIT_TERMINAL_PROMPT': '0'}


def run(args, *, check=True, data=None):
    result = subprocess.run(args, cwd=root, env=env, input=data, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        raise SystemExit(result.stderr.strip() or result.stdout.strip() or str(args))
    return result


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('repository', help='GitHub owner/repository, e.g. npc-sikong/p001')
args = parser.parse_args()
if not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', args.repository):
    raise SystemExit('Expected owner/repository')
remote = run(['git', 'remote', 'get-url', 'origin']).stdout.strip().removesuffix('.git')
if remote not in ('https://github.com/' + args.repository, 'git@github.com:' + args.repository):
    raise SystemExit('origin does not match the requested GitHub repository')
if run(['git', 'branch', '--show-current']).stdout.strip() != 'main':
    raise SystemExit('Deploy from main')
if run(['git', 'status', '--porcelain']).stdout.strip():
    raise SystemExit('Commit the local source and dist before deployment')

source_commit = run(['git', 'rev-parse', 'HEAD']).stdout.strip()
tree = run(['git', 'rev-parse', 'HEAD:dist']).stdout.strip()
files = run(['git', 'ls-tree', '--name-only', tree]).stdout.splitlines()
if not {'index.html', '.nojekyll', 'build-info.json'}.issubset(files):
    raise SystemExit('Run the latest build-v23.py and commit dist first')
previous = run(['git', 'ls-remote', '--heads', 'origin', 'gh-pages']).stdout.strip()
old_commit = ''
if previous:
    old_commit = previous.split()[0]
    run(['git', 'fetch', 'origin', 'gh-pages:refs/remotes/origin/gh-pages'])
if old_commit and run(['git', 'rev-parse', old_commit + '^{tree}']).stdout.strip() == tree:
    pages_commit = old_commit
else:
    command = ['git', 'commit-tree', tree]
    if old_commit:
        command += ['-p', old_commit]
    pages_commit = run(command, data='Publish locally built prototype from ' + source_commit + '\n').stdout.strip()
    run(['git', 'update-ref', 'refs/heads/gh-pages', pages_commit])
    run(['git', 'push', 'origin', 'refs/heads/gh-pages:refs/heads/gh-pages'])

endpoint = 'repos/' + args.repository + '/pages'
settings_result = run(['gh', 'api', endpoint], check=False)
settings = json.loads(settings_result.stdout or '{}')
request = {'build_type': 'legacy', 'source': {'branch': 'gh-pages', 'path': '/'}}
request_path = temp_dir / 'pages-publishing-source.json'
request_path.write_text(json.dumps(request) + '\n', encoding='utf-8')
if settings_result.returncode:
    if '404' not in settings_result.stderr and settings.get('message') != 'Not Found':
        raise SystemExit(settings_result.stderr or settings_result.stdout)
    settings = json.loads(run(['gh', 'api', '--method', 'POST', endpoint, '--input', str(request_path)]).stdout)
elif settings.get('build_type') != 'legacy' or settings.get('source') != request['source']:
    run(['gh', 'api', '--method', 'PUT', endpoint, '--input', str(request_path)])
    settings = json.loads(run(['gh', 'api', endpoint]).stdout)

info = {'repository': 'https://github.com/' + args.repository,
        'url': settings.get('html_url'), 'sourceCommit': source_commit,
        'pagesCommit': pages_commit, 'publishingSource': request,
        'status': settings.get('status'), 'prototypeOnly': True}
record = root / 'artifacts/deploy/pages-request.json'
record.parent.mkdir(parents=True, exist_ok=True)
record.write_text(json.dumps(info, indent=2) + '\n', encoding='utf-8')
print(json.dumps(info, indent=2))
