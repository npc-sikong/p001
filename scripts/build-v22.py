from pathlib import Path
import base64,re,subprocess,tempfile,shutil
root=Path(__file__).resolve().parent.parent
temp_dir=root/'.work/tmp'
temp_dir.mkdir(parents=True,exist_ok=True)
# Since V23 this rebuilds the frozen V22 base only; run scripts/build-v23.py afterwards.
src=root/'.work/v22-built.html'
s=src.read_text()
s=re.sub(r'\n/\* V22 START \*/.*?/\* V22 END \*/\n','\n',s,flags=re.S)
s=re.sub(r'/\* V22 STYLE START \*/.*?/\* V22 STYLE END \*/','',s,flags=re.S)
js=(root/'.work/v22.js').read_text().replace('__V22_AUDIO__','data:audio/mp4;base64,'+base64.b64encode((root/'.work/intro.m4a').read_bytes()).decode())
css=(root/'.work/v22.css').read_text()
assert s.count('\nboot();')==1
s=s.replace('\nboot();','\n/* V22 START */\n'+js+'\n/* V22 END */\nboot();')
s=s.replace('</style>','/* V22 STYLE START */\n'+css+'\n/* V22 STYLE END */</style>',1)
for script in re.findall(r'<script[^>]*>(.*?)</script>',s,re.S):
 with tempfile.NamedTemporaryFile(mode='w',suffix='.js',dir=temp_dir,encoding='utf-8') as f:
  f.write(script);f.flush();subprocess.run(['node','--check',f.name],check=True)
src.write_text(s)
print('V22 base rebuilt in .work/v22-built.html; now run python3 scripts/build-v23.py')
