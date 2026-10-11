'use strict';
const digits='零一二三四五六七八九';
function integer(n){if(!Number.isSafeInteger(n)||n<0||n>999999999999)throw Error('SPOKEN_INTEGER_RANGE');if(n===0)return '零';const small=x=>{let out='',zero=false;for(const [v,u] of [[1000,'千'],[100,'百'],[10,'十'],[1,'']]){const d=Math.floor(x/v)%10;if(d){if(zero&&out)out+='零';out+=digits[d]+u;zero=false}else if(out)zero=true;}return out.replace(/^一十/,'十')};let parts=[],pending=false;for(const [v,u] of [[100000000,'億'],[10000,'萬'],[1,'']]){let chunk=Math.floor(n/v)%10000;if(chunk){if(parts.length&&(pending||chunk<1000))parts.push('零');parts.push(small(chunk)+u);pending=false}else if(parts.length)pending=true;}return parts.join('');}
function decimal(n,places=2){if(!Number.isFinite(n)||n<0||!Number.isInteger(places)||places<0||places>4)throw Error('SPOKEN_DECIMAL_INVALID');const s=n.toFixed(places);let [a,b]=s.split('.');b=b?.replace(/0+$/,'');return integer(Number(a))+(b?'點'+[...b].map(x=>digits[Number(x)]).join(''):'');}
function toYi(twd){if(!Number.isSafeInteger(twd)||twd<0)throw Error('SPOKEN_TWD_INVALID');return decimal(Math.round(twd/1e6)/100);}
module.exports={integer,decimal,toYi};
