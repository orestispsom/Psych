// Restricted Lua DATA parser. Never evaluates Lua or executes input.
export function parseSavedVariables(input) {
  if(Buffer.byteLength(input)>64*1024*1024) throw new Error('SavedVariables exceeds 64 MiB');
  let i=0;
  function ws(){ while(i<input.length) {if(/\s/.test(input[i])) {i++;continue;} if(input.slice(i,i+2)==='--'){while(i<input.length&&input[i]!=='\n')i++;continue;}break;} }
  function take(c){ws();if(input[i]!==c)throw new Error('Expected '+c+' at '+i);i++;}
  function string(){const quote=input[i++];let out='';while(i<input.length){let c=input[i++];if(c===quote)return out;if(c==='\\'){c=input[i++];if(/\d/.test(c)){let digits=c;for(let n=0;n<2&&/\d/.test(input[i]||'');n++)digits+=input[i++];const b=Number(digits);if(b>255)throw new Error('Invalid escape');out+=String.fromCharCode(b);}else{const escapes={n:'\n',r:'\r',t:'\t','\\':'\\','"':'"',"'":"'"};if(!(c in escapes))throw new Error('Unsupported escape');out+=escapes[c];}}else out+=c;}throw new Error('Unterminated string');}
  function value(depth=0){ws();if(depth>40)throw new Error('Too deeply nested');const c=input[i];if(c==='"'||c==="'")return string();if(c==='{'){i++;const obj=Object.create(null);let n=1;while(true){ws();if(input[i]==='}'){i++;return obj;}let key;if(input[i]==='['){i++;key=value(depth+1);if(typeof key!=='string'&&typeof key!=='number')throw new Error('Invalid key');take(']');take('=');}else{const m=/^[A-Za-z_][A-Za-z_0-9]*\s*=/.exec(input.slice(i));if(m){key=m[0].split('=')[0].trim();i+=m[0].length;}else key=n++;}if(Object.hasOwn(obj,key))throw new Error('Duplicate table key');obj[key]=value(depth+1);ws();if(input[i]===','||input[i]===';')i++;else if(input[i]!=='}')throw new Error('Expected table separator');}}
    const tail=input.slice(i);for(const [word,v] of [['true',true],['false',false],['nil',null]])if(tail.startsWith(word)&&!/[A-Za-z_0-9]/.test(tail[word.length]||'')){i+=word.length;return v;}
    const m=/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(tail);if(m){i+=m[0].length;const n=Number(m[0]);if(!Number.isFinite(n))throw new Error('Nonfinite number');return n;}throw new Error('Unsupported Lua expression at '+i);
  }
  ws();const name=/^PsychQuizDB\b/.exec(input.slice(i));if(!name)throw new Error('Expected PsychQuizDB');i+=name[0].length;take('=');const result=value();ws();if(i!==input.length)throw new Error('Trailing code rejected');return result;
}
export function tableArray(table) {
  const keys=Object.keys(table||{}).sort((a,b)=>Number(a)-Number(b));
  if(keys.some((k,i)=>k!==String(i+1)))throw new Error('Non-contiguous event array');
  return keys.map(k=>table[k]);
}
