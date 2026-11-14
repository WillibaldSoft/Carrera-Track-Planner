#!/usr/bin/env python3
"""Package already built planner and supplied Node runtimes. Never install."""
INSTALLER_VERSION = 5
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import tarfile
import zipfile

parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
parser.add_argument('--linux-node',required=True)
parser.add_argument('--windows-node', help='Optional trusted Windows Node executable; omit for Linux-only builds')
parser.add_argument('--node-license',required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
source=root/'addons/track-planner'
version=json.loads((root/'package.json').read_text())['version']
output=Path(args.output).resolve()
output.mkdir(parents=True,exist_ok=True)
stage=Path(tempfile.mkdtemp(prefix='planner-packaging-',dir=root.parent))

def common(target):
 target.mkdir(parents=True)
 shutil.copytree(source/'dist',target/'dist')
 shutil.copytree(source/'updater',target/'updater')
 (target/'update-installation.json').write_text(json.dumps({'application':'carrera-track-planner','distribution':'portable','format':1})+'\n')
 for name in ['standalone-server.mjs','launcher.mjs','README.md']:shutil.copy2(source/name,target/name)
 shutil.copy2(root/'LICENSE',target/'LICENSE')
 shutil.copy2(root/'NOTICE',target/'NOTICE')
 shutil.copytree(root/'LICENSES',target/'LICENSES')
 (target/'SOURCE.txt').write_text(f'AGPL-3.0-only\nCorresponding Source: https://github.com/WillibaldSoft/Carrera-Track-Planner/archive/refs/tags/v{version}.tar.gz\nBuild: npm ci; npm run build\nSee NOTICE for retained upstream and third-party licenses.\n')
 shutil.copy2(args.node_license,target/'NODE-LICENSE')
 notices=source/'dist/THIRD-PARTY-NOTICES.txt'
 if notices.exists():shutil.copy2(notices,target/'THIRD-PARTY-NOTICES.txt')

linux=stage/'racehubos-track-planner-linux-x64'
common(linux)
shutil.copy2(args.linux_node,linux/'node');(linux/'node').chmod(0o755)
(linux/'Start.sh').write_text('#!/bin/sh\ncd -- "$(dirname -- "$0")" || exit 1\nexec ./node launcher.mjs\n')
(linux/'Start.sh').chmod(0o755)
with tarfile.open(output/'RaceHubOS-Streckenplaner-Linux-x64.tar.gz','w:gz',compresslevel=1) as archive:archive.add(linux,arcname=linux.name)
if args.windows_node:
 windows=stage/'RaceHubOS-Streckenplaner-Windows-x64'
 common(windows)
 shutil.copy2(args.windows_node,windows/'node.exe')
 (windows/'Start.cmd').write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\nnode.exe launcher.mjs\r\nif errorlevel 1 pause\r\n')
 with zipfile.ZipFile(output/'RaceHubOS-Streckenplaner-Windows-x64.zip','w',zipfile.ZIP_DEFLATED) as archive:
  for p in windows.rglob('*'):
   if p.is_file():archive.write(p,p.relative_to(stage))
deb=stage/'deb'
app=deb/'opt/racehubos-track-planner'
shutil.copytree(linux,app)
(app/'update-installation.json').write_text(json.dumps({'application':'carrera-track-planner','distribution':'deb','format':1})+'\n')
launcher=deb/'usr/bin/racehubos-track-planner';launcher.parent.mkdir(parents=True)
launcher.write_text('#!/bin/sh\nexec /opt/racehubos-track-planner/node /opt/racehubos-track-planner/launcher.mjs\n');launcher.chmod(0o755)
desktop=deb/'usr/share/applications/racehubos-track-planner.desktop';desktop.parent.mkdir(parents=True)
desktop.write_text('[Desktop Entry]\nType=Application\nName=RaceHubOS Track Planner\nName[de]=RaceHubOS Streckenplaner\nExec=racehubos-track-planner\nTerminal=true\nCategories=Game;Graphics;\n')
control=deb/'DEBIAN';control.mkdir()
(control/'control').write_text(f'Package: racehubos-track-planner\nVersion: {version}\nArchitecture: amd64\nSection: games\nPriority: optional\nMaintainer: RaceHubOS contributors <noreply@localhost>\nDepends: libc6 (>= 2.28), libstdc++6, libgcc-s1, xdg-utils\nDescription: Independent offline track planner for Carrera layouts\n Separate optional planner with its own local plans and stock.\n No RaceHubOS installation or Python runtime required.\n')
subprocess.run(['dpkg-deb','--threads-max=1','-Zgzip','-z1','--root-owner-group','--build',str(deb),str(output/f'racehubos-track-planner_{version}_amd64.deb')],check=True)
shutil.copy2(source/'track-planner.racehub-addon.json',output/'track-planner.racehub-addon.json')
shutil.copy2(source/'Carrera-Track-Planner-update.json',output/'Carrera-Track-Planner-update.json')
bridge=stage/f'RaceHubOS-Planer-Direktupdate-{version}'
bridge.mkdir()
for name in ['package.json','LICENSE','NOTICE']:
 shutil.copy2(root/name,bridge/name)
shutil.copytree(root/'integrations/racehubos-1.32',bridge/'integrations/racehubos-1.32')
(bridge/'addons/track-planner/updater').mkdir(parents=True)
for name in ['addon.mjs','release.mjs']:
 shutil.copy2(source/'updater'/name,bridge/'addons/track-planner/updater'/name)
shutil.copy2(source/'track-planner.racehub-addon.json',bridge/'addons/track-planner/track-planner.racehub-addon.json')
with zipfile.ZipFile(output/f'RaceHubOS-Planer-Direktupdate-{version}.zip','w',zipfile.ZIP_DEFLATED) as archive:
 for p in bridge.rglob('*'):
  if p.is_file():archive.write(p,p.relative_to(stage))
print(output)
