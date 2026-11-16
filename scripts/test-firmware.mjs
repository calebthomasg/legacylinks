import {test} from 'node:test';
import assert from 'node:assert/strict';
import {makeRelease,validateVersion} from './publish-firmware.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
test('release builder rejects malformed versions, wrong chips, factory files, oversized notes',()=>{
 const b=Buffer.alloc(32);b[0]=0xe9;b.writeUInt16LE(9,12);
 assert.equal(makeRelease('0.1.9',b,'test').size,32);
 for(const v of ['1.2','01.2.3','-1.2.3','1.2.3-beta','1.2.10000'])assert.equal(validateVersion(v),false);
 assert.throws(()=>makeRelease('1.2.3',Buffer.alloc(16777216),'test'));
 b.writeUInt16LE(0,12);assert.throws(()=>makeRelease('1.2.3',b,'test'));
 b.writeUInt16LE(9,12);assert.throws(()=>makeRelease('1.2.3',b,'x'.repeat(161)));
});
test('committed catalogs match immutable firmware bytes and stable is withheld',()=>{
 const root='public/firmware/trailhead/';
 assert.equal(JSON.parse(readFileSync(root+'stable.json')).release,null);
 const catalog=JSON.parse(readFileSync(root+'test.json'));
 assert.equal(catalog.schema,1);assert.equal(catalog.channel,'test');
 const r=catalog.release;const bytes=readFileSync('public'+new URL(r.url).pathname);
 assert.equal(bytes.length,r.size);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);
 assert.deepEqual(makeRelease(r.version,bytes,r.notes),r);
});
