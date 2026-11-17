// Export only the public project, without this checkout's hosting identity or Git history.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
if(!process.argv[2])throw Error('Usage: node scripts/export-github.mjs <new-output-directory>');
const output=path.resolve(process.argv[2]);
if(output===path.parse(output).root||output===path.resolve(root)||output.startsWith(root))throw Error('Choose a new directory outside the project checkout.');
if(fs.existsSync(output))throw Error('Output already exists; choose a new directory to preserve its contents.');
const entries=['.gitignore','README.md','DEPLOYMENT.md','edgeone.json','package.json','package-lock.json','requirements-assets.txt','dist','scripts'];
for(const entry of entries)if(!fs.existsSync(path.join(root,entry)))throw Error('Missing export file: '+entry);
fs.mkdirSync(output,{recursive:true});
for(const entry of entries)fs.cpSync(path.join(root,entry),path.join(output,entry),{recursive:true,filter:source=>!['__pycache__','.DS_Store'].includes(path.basename(source))});
console.log('GitHub-ready project exported to '+output);
