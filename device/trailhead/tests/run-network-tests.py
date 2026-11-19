from pathlib import Path
import subprocess,tempfile
root=Path(__file__).resolve().parents[1]
s=(root/'firmware/TrailheadFirstBoot/TrailheadFirstBoot.ino').read_text()
helpers=s[s.index('static std::atomic<unsigned>'):s.index('static Page page=')]
service=s[s.index('static void serviceNetwork('):s.index('void setup(){')]
t=(root/'tests/test-network.cpp.template').read_text().replace('// SOURCE_HELPERS',helpers).replace('// SOURCE_SERVICE',service)
with tempfile.TemporaryDirectory() as folder:
 p=Path(folder);(p/'test.cpp').write_text(t);subprocess.run(['g++','-std=c++17',str(p/'test.cpp'),'-o',str(p/'test')],check=True);subprocess.run([str(p/'test')],check=True)
