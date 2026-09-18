"""Prepare the CSV leading-empty-field regression and minimal fix."""
import argparse
from pathlib import Path
import shutil
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument('phase', choices=('tests', 'fix'))
phase = parser.parse_args().phase
if phase == 'tests':
    target = Path('test/nodes/core/parsers/70-CSV-leading-empty_spec.js')
    if target.exists():
        raise RuntimeError('Regression test already exists')
    shutil.copyfile(Path(__file__).parent / 'csv-leading-empty_spec.js.txt', target)
else:
    path = Path('packages/node_modules/@node-red/nodes/core/parsers/70-CSV.js')
    blob = subprocess.check_output(['git', 'hash-object', str(path)], text=True).strip()
    if blob != '26fdb636f716d9cacd2e00a6684fd2034573eeae':
        raise RuntimeError('Unexpected CSV parser baseline: ' + blob)
    old = "if (line[i-1] === node.sep || line[i-1].includes('\\n','\\r')) k[j] = null;"
    indent = ' ' * 44
    new = "if (i === 0 || line[i-1] === node.sep || line[i-1] === '\\n' || line[i-1] === '\\r') {\n" + indent + "    k[j] = null;\n" + indent + "}"
    text = path.read_text()
    if text.count(old) != 1:
        raise RuntimeError('Nonunique replacement anchor')
    path.write_text(text.replace(old, new, 1))
